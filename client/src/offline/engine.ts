// Браузерный «сервер»: та же SQLite и те же маршруты API, что на сервере, но внутри вкладки.
// База хранится в IndexedDB — данные сохраняются между визитами на этом устройстве.
import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import schema from '../../../server/src/schema.sql?raw'
import { setDriver, migrate, isEmpty } from '../../../server/src/db'
import { setHashRounds, setSessionStore } from '../../../server/src/lib/auth'
import { errorHandler } from '../../../server/src/lib/http'
import { seed, wipe } from '../../../server/src/seed'
import { buildApi } from '../../../server/src/api'

const IDB_NAME = 'put-v-budushchee'
const IDB_KEY = 'db-v1'
const SESSION_KEY = 'pvb_uid'
export const VERSION_KEY = 'pvb_db_version'

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_NAME, 1)
    r.onupgradeneeded = () => r.result.createObjectStore('kv')
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
async function idbGet(): Promise<Uint8Array | null> {
  try {
    const d = await idb()
    return await new Promise((resolve) => {
      const r = d.transaction('kv').objectStore('kv').get(IDB_KEY)
      r.onsuccess = () => resolve(r.result ?? null)
      r.onerror = () => resolve(null)
    })
  } catch { return null }
}
async function idbPut(bytes: Uint8Array) {
  try {
    const d = await idb()
    await new Promise<void>((resolve) => {
      const t = d.transaction('kv', 'readwrite')
      t.objectStore('kv').put(bytes, IDB_KEY)
      t.oncomplete = () => resolve()
      t.onerror = () => resolve()
    })
  } catch { /* приватный режим без IndexedDB — работаем в памяти */ }
}

// Сессия: у каждой вкладки своя (sessionStorage), новая вкладка открывается под последним вошедшим (localStorage).
// Так на одном компьютере можно рядом открыть участника и наставника.
const ss = {
  get: (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch { /* нет доступа */ } },
  del: (k: string) => { try { sessionStorage.removeItem(k) } catch { /* нет доступа */ } },
}
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* нет доступа */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* нет доступа */ } },
}

let SQL: Awaited<ReturnType<typeof initSqlJs>>
let db: Database
let loadedVersion = ''
let api: ReturnType<typeof buildApi>

const norm = (p: unknown[]) => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : typeof v === 'bigint' ? Number(v) : v)) as any[]

function attachDriver() {
  db.exec('PRAGMA foreign_keys = ON')
  setDriver({
    get(sql, p) {
      const st = db.prepare(sql)
      try { st.bind(norm(p)); return st.step() ? st.getAsObject() : undefined } finally { st.free() }
    },
    all(sql, p) {
      const st = db.prepare(sql)
      const rows: any[] = []
      try { st.bind(norm(p)); while (st.step()) rows.push(st.getAsObject()) } finally { st.free() }
      return rows
    },
    run(sql, p) {
      db.run(sql, norm(p))
      const changes = db.getRowsModified()
      const last = db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] as number
      return { changes, lastInsertRowid: last }
    },
    exec(sql) { db.exec(sql) },
  })
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
const currentVersion = () => ls.get(VERSION_KEY) ?? ''

/** Сохраняет базу в IndexedDB. soft — служебные изменения (просмотры): не перезаписываем ими более свежую версию из другой вкладки */
async function persistNow(soft = false) {
  clearTimeout(saveTimer)
  saveTimer = undefined
  if (soft && currentVersion() !== loadedVersion) return
  const bytes = db.export() // export переоткрывает базу — заново включаем внешние ключи
  db.exec('PRAGMA foreign_keys = ON')
  await idbPut(bytes)
  loadedVersion = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  ls.set(VERSION_KEY, loadedVersion) // другие вкладки увидят событие storage и обновятся
}
function persistSoon() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => persistNow(true), 400)
}

/** Если другая вкладка сохранила более свежую базу — подгружаем её перед запросом */
async function syncIfStale() {
  const v = currentVersion()
  if (v === loadedVersion) return
  const bytes = await idbGet()
  if (bytes) {
    clearTimeout(saveTimer)
    saveTimer = undefined
    db.close()
    db = new SQL.Database(bytes)
    attachDriver()
  }
  loadedVersion = v
}

async function boot() {
  SQL = await initSqlJs({ locateFile: () => wasmUrl })
  loadedVersion = currentVersion()
  const saved = await idbGet()
  db = saved ? new SQL.Database(saved) : new SQL.Database()
  attachDriver()
  setHashRounds(8)
  setSessionStore({
    start: (_res, id) => { ss.set(SESSION_KEY, String(id)); ls.set(SESSION_KEY, String(id)) },
    end: () => { ss.del(SESSION_KEY); ls.del(SESSION_KEY) },
    read: () => {
      const own = ss.get(SESSION_KEY)
      if (own) return Number(own) || null
      const last = ls.get(SESSION_KEY)
      if (last) ss.set(SESSION_KEY, last)
      return Number(last) || null
    },
  })
  migrate(schema)
  if (isEmpty()) {
    seed()
    await persistNow()
  }
  api = buildApi()
  addEventListener('pagehide', () => { if (saveTimer) persistNow(true) })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) persistNow(true) })
}

const ready = boot()

// Запросы обрабатываются строго по очереди — как на настоящем сервере с одной базой
let queue: Promise<unknown> = Promise.resolve()
export async function request(method: string, url: string, body?: unknown): Promise<{ status: number; data: any }> {
  const job = queue.then(() => handle(method, url, body))
  queue = job.catch(() => {})
  const result = await job
  // Небольшая пауза, чтобы интерфейс вёл себя как с настоящим сервером (индикаторы загрузки, анимации)
  await new Promise((r) => setTimeout(r, 60))
  return result
}

async function handle(method: string, url: string, body?: unknown): Promise<{ status: number; data: any }> {
  await ready
  await syncIfStale()
  const [path, qs = ''] = url.split('?')
  const req: any = {
    method, path, params: {}, cookies: {}, ip: 'local',
    query: Object.fromEntries(new URLSearchParams(qs)),
    body: body === undefined ? {} : JSON.parse(JSON.stringify(body)),
  }
  const res: any = {
    statusCode: 200, finished: false, body: undefined, req,
    status(n: number) { this.statusCode = n; return this },
    json(d: unknown) { this.body = d === undefined ? null : JSON.parse(JSON.stringify(d)); this.finished = true; return this },
    cookie() { return this }, clearCookie() { return this }, on() { return this },
  }
  await new Promise<void>((resolve) => {
    ;(api as any).handle(req, res, (err?: unknown) => {
      if (err) errorHandler(err, req, res, () => {})
      else if (!res.finished) res.status(404).json({ error: 'Метод API не найден' })
      resolve()
    })
    if (res.finished) resolve()
  })
  // Изменения сохраняем сразу, до ответа интерфейсу: перезагрузка страницы ничего не потеряет.
  // Чтение (GET) тоже может обновить служебные поля — их сохраняем чуть позже.
  if (method === 'GET') persistSoon()
  else await persistNow()
  return { status: res.statusCode, data: res.body }
}

/** Вернуть демо-платформу в исходное состояние на этом устройстве */
export async function resetDemo() {
  await ready
  await syncIfStale()
  wipe()
  migrate(schema)
  seed()
  ls.del(SESSION_KEY)
  ss.del(SESSION_KEY)
  await persistNow()
}
