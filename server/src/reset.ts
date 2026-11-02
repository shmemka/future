// Полный сброс базы и заполнение демонстрационными данными: npm run db:reset
import { migrate } from './db.js'
import { seed, wipe } from './seed.js'

wipe()
migrate()
seed()
