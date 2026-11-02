// Слой доступа к базе. Один и тот же код маршрутов работает с двумя «движками»:
//  • на сервере — better-sqlite3 (см. db-node.ts),
//  • в браузере (сайт на GitHub Pages) — sql.js, SQLite в WebAssembly (см. client/src/offline).
// Оба синхронные, поэтому интерфейс общий.

export interface RunResult { changes: number; lastInsertRowid: number | bigint }
export interface Driver {
  get(sql: string, params: unknown[]): any
  all(sql: string, params: unknown[]): any[]
  run(sql: string, params: unknown[]): RunResult
  exec(sql: string): void
}

let driver: Driver | null = null
export function setDriver(d: Driver) { driver = d }
const d = () => {
  if (!driver) throw new Error('База данных не инициализирована')
  return driver
}

export const q = {
  get: <T = any>(sql: string, ...params: unknown[]) => d().get(sql, params) as T | undefined,
  all: <T = any>(sql: string, ...params: unknown[]) => d().all(sql, params) as T[],
  run: (sql: string, ...params: unknown[]) => d().run(sql, params),
  exec: (sql: string) => d().exec(sql),
}

let depth = 0
/** Транзакция. Вложенные вызовы выполняются внутри внешней. */
export function tx<T>(fn: () => T): T {
  if (depth > 0) return fn()
  depth++
  q.exec('BEGIN')
  try {
    const r = fn()
    q.exec('COMMIT')
    return r
  } catch (e) {
    q.exec('ROLLBACK')
    throw e
  } finally {
    depth--
  }
}

export function migrate(schemaSql: string) {
  q.exec(schemaSql)
}

export function isEmpty() {
  const row = q.get<{ n: number }>('SELECT COUNT(*) AS n FROM users')
  return !row || row.n === 0
}
