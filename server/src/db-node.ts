// Серверный движок базы: файл SQLite через better-sqlite3
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setDriver, migrate } from './db.js'

const here = path.dirname(fileURLToPath(import.meta.url))

export function initNodeDb() {
  const dbPath = process.env.DB_PATH ?? path.resolve(here, '../../data/future.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  setDriver({
    get: (sql, p) => db.prepare(sql).get(...p),
    all: (sql, p) => db.prepare(sql).all(...p),
    run: (sql, p) => db.prepare(sql).run(...p),
    exec: (sql) => { db.exec(sql) },
  })
  migrate(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'))
}
