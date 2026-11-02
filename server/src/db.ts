import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH ?? path.resolve(here, '../../data/future.db')
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function migrate() {
  db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'))
}

export function isEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }
  return row.n === 0
}

/** Короткие хелперы над prepared statements */
export const q = {
  get: <T = any>(sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) as T | undefined,
  all: <T = any>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[],
  run: (sql: string, ...params: unknown[]) => db.prepare(sql).run(...params),
}

export const tx = <T>(fn: () => T) => db.transaction(fn)()
