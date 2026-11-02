// Полный сброс базы и заполнение демонстрационными данными: npm run db:reset
import { initNodeDb } from './db-node.js'
import { migrate } from './db.js'
import { seed, wipe } from './seed.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

initNodeDb()
wipe()
migrate(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8'))
seed()
