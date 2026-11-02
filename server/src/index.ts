import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { migrate, isEmpty } from './db.js'
import { seed } from './seed.js'
import { loadUser } from './lib/auth.js'
import { errorHandler } from './lib/http.js'
import { auth } from './routes/auth.js'
import { me, rating, people } from './routes/me.js'
import { courses, lessons, tasks, studio } from './routes/courses.js'
import { events } from './routes/events.js'
import { community, messages } from './routes/community.js'
import { safety, moderation, admin } from './routes/safety.js'
import { publicApi } from './routes/public.js'

migrate()
if (isEmpty()) {
  console.log('База пустая — заполняю демонстрационными данными…')
  seed()
}

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(express.json({ limit: '200kb' }))
app.use(cookieParser())
app.use(loadUser)

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

app.get('/api/health', (_req, res) => { res.json({ ok: true }) })
app.use('/api/auth', auth)
app.use('/api/public', publicApi)
app.use('/api/me', me)
app.use('/api/rating', rating)
app.use('/api/people', people)
app.use('/api/courses', courses)
app.use('/api/lessons', lessons)
app.use('/api/tasks', tasks)
app.use('/api/studio', studio)
app.use('/api/events', events)
app.use('/api/community', community)
app.use('/api/messages', messages)
app.use('/api/safety', safety)
app.use('/api/moderation', moderation)
app.use('/api/admin', admin)
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Метод API не найден' }) })

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
