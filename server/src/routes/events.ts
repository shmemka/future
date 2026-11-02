import { Router } from 'express'
import { z } from 'zod'
import { q } from '../db.js'
import { HttpError, isStaff, requireAuth, requireRole } from '../lib/auth.js'
import { idParam, parse, text } from '../lib/http.js'
import { award, logActivity, notify } from '../lib/progress.js'
import { EVENT_KINDS } from '../../../shared/constants.js'

export const events = Router()

const baseSelect = `
  SELECT e.*,
    (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) AS registered,
    (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.status = 'attended') AS attended,
    (SELECT status FROM event_registrations r WHERE r.event_id = e.id AND r.user_id = ?) AS my_status
  FROM events e`

events.get('/', (req, res) => {
  const scope = (req.query.scope as string) ?? 'all'
  const uid = req.user?.id ?? 0
  const where = ['e.published = 1']
  if (scope === 'upcoming') where.push("e.ends_at >= datetime('now')")
  if (scope === 'past') where.push("e.ends_at < datetime('now')")
  const order = scope === 'past' ? 'DESC' : 'ASC'
  res.json(q.all(`${baseSelect} WHERE ${where.join(' AND ')} ORDER BY e.starts_at ${order}`, uid))
})

events.get('/:id', (req, res) => {
  const id = idParam(req.params.id)
  const e = q.get<any>(`${baseSelect} WHERE e.id = ?`, req.user?.id ?? 0, id)
  if (!e || (!e.published && !isStaff(req.user))) throw new HttpError(404, 'Мероприятие не найдено')
  const attendees = isStaff(req.user)
    ? q.all(
        `SELECT u.id, u.name, u.avatar, u.avatar_emoji, u.city, r.status, r.created_at
         FROM event_registrations r JOIN users u ON u.id = r.user_id WHERE r.event_id = ? ORDER BY u.name`, id,
      )
    : null
  res.json({ ...e, attendees })
})

events.post('/:id/register', requireAuth, (req, res) => {
  const id = idParam(req.params.id)
  const e = q.get<any>(`${baseSelect} WHERE e.id = ?`, req.user!.id, id)
  if (!e || !e.published) throw new HttpError(404, 'Мероприятие не найдено')
  if (new Date(e.ends_at.replace(' ', 'T') + 'Z') < new Date()) throw new HttpError(409, 'Мероприятие уже прошло')
  if (e.my_status) return res.json({ ok: true })
  if (e.registered >= e.capacity) throw new HttpError(409, 'Мест больше нет. Следите за новыми датами — мероприятия повторяются.')
  q.run('INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)', id, req.user!.id)
  logActivity(req.user!.id, 'event', `Запись на «${e.title}»`, `/events/${id}`)
  res.json({ ok: true })
})

events.delete('/:id/register', requireAuth, (req, res) => {
  const id = idParam(req.params.id)
  const r = q.get<any>('SELECT status FROM event_registrations WHERE event_id = ? AND user_id = ?', id, req.user!.id)
  if (r?.status === 'attended') throw new HttpError(409, 'Участие уже отмечено — отменить запись нельзя')
  q.run('DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?', id, req.user!.id)
  res.json({ ok: true })
})

// Отметка посещения — наставник или администратор на месте проведения
events.post('/:id/attendance', requireRole('mentor', 'admin'), (req, res) => {
  const id = idParam(req.params.id)
  const d = parse(z.object({ userId: z.number().int(), attended: z.boolean() }), req.body)
  const e = q.get<any>('SELECT * FROM events WHERE id = ?', id)
  if (!e) throw new HttpError(404, 'Мероприятие не найдено')
  if (new Date(e.starts_at.replace(' ', 'T') + 'Z').getTime() - 60 * 60_000 > Date.now()) {
    throw new HttpError(409, 'Отмечать посещение можно с момента начала встречи (за час до старта)')
  }
  const reg = q.get<any>('SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?', id, d.userId)
  if (!reg) throw new HttpError(404, 'Участник не записан на это мероприятие')
  if (d.attended) {
    q.run("UPDATE event_registrations SET status = 'attended' WHERE event_id = ? AND user_id = ?", id, d.userId)
    logActivity(d.userId, 'event', `Участие в «${e.title}»`, `/events/${id}`)
    award(d.userId, e.tokens_reward, 'event', `Участие: «${e.title}»`, { ref: `event:${id}`, by: req.user!.id, link: `/events/${id}` })
  } else {
    q.run("UPDATE event_registrations SET status = 'registered' WHERE event_id = ? AND user_id = ?", id, d.userId)
    // откат начисления
    const t = q.get<any>('SELECT id, amount FROM token_tx WHERE user_id = ? AND ref = ?', d.userId, `event:${id}`)
    if (t) {
      q.run('DELETE FROM token_tx WHERE id = ?', t.id)
      notify(d.userId, `Отметка участия в «${e.title}» снята, жетоны скорректированы`, '/path')
    }
  }
  res.json({ ok: true })
})

const eventSchema = z.object({
  title: text(4, 120, 'Название'),
  kind: z.enum(Object.keys(EVENT_KINDS) as [string, ...string[]]),
  description: text(20, 3000, 'Описание'),
  starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/, 'Укажите дату и время начала'),
  ends_at: z.string().regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/, 'Укажите дату и время окончания'),
  location: text(2, 160, 'Место'),
  format: z.enum(['offline', 'online']),
  capacity: z.number().int().min(1).max(1000),
  tokens_reward: z.number().int().min(0).max(100),
  host: z.string().trim().max(160).default(''),
  published: z.boolean().default(true),
}).refine((e) => e.ends_at > e.starts_at, { message: 'Окончание должно быть позже начала' })

/** Клиент присылает время в UTC (ISO). Храним как «YYYY-MM-DD HH:MM:SS». */
const toDb = (s: string) => s.replace('T', ' ').slice(0, 16) + ':00'

events.post('/', requireRole('mentor', 'admin'), (req, res) => {
  const d = parse(eventSchema, req.body)
  const r = q.run(
    `INSERT INTO events (title, kind, description, starts_at, ends_at, location, format, capacity, tokens_reward, host, published, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    d.title, d.kind, d.description, toDb(d.starts_at), toDb(d.ends_at), d.location, d.format, d.capacity, d.tokens_reward, d.host, Number(d.published), req.user!.id,
  )
  res.status(201).json({ id: Number(r.lastInsertRowid) })
})

events.put('/:id', requireRole('mentor', 'admin'), (req, res) => {
  const id = idParam(req.params.id)
  const e = q.get<any>('SELECT * FROM events WHERE id = ?', id)
  if (!e) throw new HttpError(404, 'Мероприятие не найдено')
  if (req.user!.role !== 'admin' && e.created_by !== req.user!.id) throw new HttpError(403, 'Редактировать может автор мероприятия или администратор')
  const d = parse(eventSchema, req.body)
  q.run(
    `UPDATE events SET title=?, kind=?, description=?, starts_at=?, ends_at=?, location=?, format=?, capacity=?, tokens_reward=?, host=?, published=? WHERE id = ?`,
    d.title, d.kind, d.description, toDb(d.starts_at), toDb(d.ends_at), d.location, d.format, d.capacity, d.tokens_reward, d.host, Number(d.published), id,
  )
  res.json({ ok: true })
})

events.delete('/:id', requireRole('admin'), (req, res) => {
  q.run('DELETE FROM events WHERE id = ?', idParam(req.params.id))
  res.json({ ok: true })
})
