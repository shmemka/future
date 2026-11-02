import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isEmpty } from './db.js'
import { initNodeDb } from './db-node.js'
import { seed } from './seed.js'
import { setSessionStore } from './lib/auth.js'
import { cookieSessions } from './lib/session-node.js'
import { errorHandler } from './lib/http.js'
import { buildApi } from './api.js'

initNodeDb()
setSessionStore(cookieSessions)
if (isEmpty()) {
  console.log('База пустая — заполняю демонстрационными данными…')
  seed()
}

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(express.json({ limit: '200kb' }))
app.use(cookieParser())

// Простейшая защита от перебора паролей
const attempts = new Map<string, { n: number; until: number }>()
app.use('/api/auth/login', (req, res, next) => {
  const key = req.ip ?? 'x'
  const a = attempts.get(key)
  if (a && a.until > Date.now() && a.n >= 10) {
    return res.status(429).json({ error: 'Слишком много попыток входа. Подождите 5 минут.' })
  }
  res.on('finish', () => {
    if (res.statusCode === 401) {
      const cur = attempts.get(key)
      attempts.set(key, { n: (cur && cur.until > Date.now() ? cur.n : 0) + 1, until: Date.now() + 5 * 60_000 })
    } else if (res.statusCode === 200) attempts.delete(key)
  })
  next()
})

app.use('/api', buildApi())

// В продакшене сервер отдаёт собранный фронтенд
const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(here, '../../dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '7d' }))
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.use(errorHandler)

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`«Путь в будущее» API → http://localhost:${port}`)
})
