// Сборка API из маршрутов. Используется и сервером (index.ts), и браузерной версией сайта (client/src/offline).
import { Router } from 'express'
import { loadUser } from './lib/auth.js'
import { auth } from './routes/auth.js'
import { me, rating, people } from './routes/me.js'
import { courses, lessons, tasks, studio } from './routes/courses.js'
import { events } from './routes/events.js'
import { community, messages } from './routes/community.js'
import { safety, moderation, admin } from './routes/safety.js'
import { publicApi } from './routes/public.js'

export function buildApi() {
  const api = Router()
  api.use(loadUser)
  api.get('/health', (_req, res) => { res.json({ ok: true }) })
  api.use('/auth', auth)
  api.use('/public', publicApi)
  api.use('/me', me)
  api.use('/rating', rating)
  api.use('/people', people)
  api.use('/courses', courses)
  api.use('/lessons', lessons)
  api.use('/tasks', tasks)
  api.use('/studio', studio)
  api.use('/events', events)
  api.use('/community', community)
  api.use('/messages', messages)
  api.use('/safety', safety)
  api.use('/moderation', moderation)
  api.use('/admin', admin)
  api.use((_req, res) => { res.status(404).json({ error: 'Метод API не найден' }) })
  return api
}
