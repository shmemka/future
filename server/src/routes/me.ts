import { Router } from 'express'
import { z } from 'zod'
import { q } from '../db.js'
import { HttpError, requireAuth } from '../lib/auth.js'
import { idParam, parse, text } from '../lib/http.js'
import { assertNoContacts } from '../lib/safety.js'
import { grantAchievement, publicUser, safeJson, shortName, tokenSummary } from '../lib/progress.js'
import { ACHIEVEMENTS, DIRECTION_KEYS, levelFor } from '../../../shared/constants.js'

export const me = Router()
me.use(requireAuth)

/** Курсы пользователя с прогрессом */
export function myCourses(userId: number) {
  return q.all<any>(
    `SELECT c.id, c.slug, c.title, c.direction, c.tokens_reward, e.enrolled_at, e.completed_at,
       (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lessons_total,
       (SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE l.course_id = c.id AND lp.user_id = e.user_id) AS lessons_done,
       (SELECT COUNT(*) FROM tasks t WHERE t.course_id = c.id) AS tasks_total,
       (SELECT COUNT(*) FROM submissions s JOIN tasks t ON t.id = s.task_id WHERE t.course_id = c.id AND s.user_id = e.user_id AND s.status = 'approved') AS tasks_done
     FROM enrollments e JOIN courses c ON c.id = e.course_id
     WHERE e.user_id = ? ORDER BY e.completed_at IS NOT NULL, e.enrolled_at DESC`,
    userId,
  ).map((c) => ({
    ...c,
    progress: Math.round(((c.lessons_done + c.tasks_done) / Math.max(1, c.lessons_total + c.tasks_total)) * 100),
  }))
}

me.get('/dashboard', (req, res) => {
  const uid = req.user!.id
  const u = q.get<any>('SELECT * FROM users WHERE id = ?', uid)
  const interests: string[] = safeJson(u.interests, [])
  const courses = myCourses(uid)

  const events = q.all<any>(
    `SELECT e.id, e.title, e.kind, e.starts_at, e.location, e.format, r.status
     FROM event_registrations r JOIN events e ON e.id = r.event_id
     WHERE r.user_id = ? AND e.ends_at >= datetime('now') ORDER BY e.starts_at LIMIT 5`, uid,
  )

  const earned = q.all<{ code: string; earned_at: string }>('SELECT code, earned_at FROM user_achievements WHERE user_id = ?', uid)
  const achievements = ACHIEVEMENTS.map((a) => ({ ...a, earned_at: earned.find((e) => e.code === a.code)?.earned_at ?? null }))

  const activity = q.all('SELECT kind, text, link, created_at FROM activity WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 25', uid)

  // Рекомендации: курсы по интересам, на которые ещё не записан, затем ближайшие мероприятия
  const enrolledIds = new Set(courses.map((c) => c.id))
  const allCourses = q.all<any>('SELECT id, slug, title, direction, short, tokens_reward FROM courses WHERE published = 1')
  const recommendedCourses = allCourses
    .filter((c) => !enrolledIds.has(c.id))
    .sort((a, b) => Number(interests.includes(b.direction)) - Number(interests.includes(a.direction)))
    .slice(0, 3)
    .map((c) => ({ ...c, why: interests.includes(c.direction) ? 'По твоим интересам' : 'Популярно у участников' }))
  const recommendedEvents = q.all<any>(
    `SELECT id, title, kind, starts_at, location, tokens_reward FROM events
     WHERE published = 1 AND starts_at >= datetime('now')
       AND id NOT IN (SELECT event_id FROM event_registrations WHERE user_id = ?)
     ORDER BY starts_at LIMIT 2`, uid,
  )

  res.json({
    tokens: tokenSummary(uid),
    courses,
    events,
    achievements,
    activity,
    recommendations: { courses: recommendedCourses, events: recommendedEvents },
    stats: {
      lessons: q.get<{ n: number }>('SELECT COUNT(*) n FROM lesson_progress WHERE user_id = ?', uid)!.n,
      tasks: q.get<{ n: number }>("SELECT COUNT(*) n FROM submissions WHERE user_id = ? AND status = 'approved'", uid)!.n,
      events: q.get<{ n: number }>("SELECT COUNT(*) n FROM event_registrations WHERE user_id = ? AND status = 'attended'", uid)!.n,
      posts: q.get<{ n: number }>("SELECT COUNT(*) n FROM posts WHERE author_id = ? AND status = 'published'", uid)!.n,
    },
  })
})

const profileSchema = z.object({
  name: text(2, 60, 'Имя').optional(),
  city: z.string().trim().max(60).optional(),
  school: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(400, 'О себе: максимум 400 символов').optional(),
  headline: z.string().trim().max(120).optional(),
  interests: z.array(z.enum(DIRECTION_KEYS as [string, ...string[]])).max(7).optional(),
  avatar: z.enum(['violet', 'pink', 'amber', 'sky', 'mint', 'coral', 'lilac']).optional(),
  avatar_emoji: z.string().max(8).optional(),
  show_in_rating: z.boolean().optional(),
  allow_messages: z.boolean().optional(),
})

me.patch('/', (req, res) => {
  const d = parse(profileSchema, req.body)
  assertNoContacts(d.bio ?? '', d.headline ?? '', d.school ?? '')
  const fields: string[] = []
  const values: unknown[] = []
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined) continue
    fields.push(`${k} = ?`)
    values.push(k === 'interests' ? JSON.stringify(v) : typeof v === 'boolean' ? Number(v) : v)
  }
  if (fields.length) q.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, ...values, req.user!.id)
  res.json({ ok: true })
})

me.post('/accept-rules', (req, res) => {
  grantAchievement(req.user!.id, 'rules')
  res.json({ ok: true })
})

me.get('/tokens', (req, res) => {
  const uid = req.user!.id
  res.json({
    summary: tokenSummary(uid),
    transactions: q.all('SELECT id, amount, category, reason, created_at FROM token_tx WHERE user_id = ? ORDER BY id DESC LIMIT 200', uid),
  })
})

me.get('/notifications', (req, res) => {
  res.json(q.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 60', req.user!.id))
})

me.post('/notifications/read', (req, res) => {
  q.run("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL", req.user!.id)
  res.json({ ok: true })
})

// ───────── Рейтинг образовательной активности ─────────
export const rating = Router()
rating.use(requireAuth)

rating.get('/', (req, res) => {
  const rows = q.all<any>(
    `SELECT u.id, u.name, u.city, u.avatar, u.avatar_emoji, u.show_in_rating, COALESCE(SUM(t.amount),0) AS tokens,
       (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.completed_at IS NOT NULL) AS courses_done
     FROM users u LEFT JOIN token_tx t ON t.user_id = u.id
     WHERE u.role = 'participant' AND u.status = 'active'
     GROUP BY u.id ORDER BY tokens DESC, u.id ASC`,
  )
  let rank = 0, prev = -1, seen = 0
  const list = rows.map((r) => {
    seen++
    if (r.tokens !== prev) { rank = seen; prev = r.tokens }
    const isMe = r.id === req.user!.id
    const visible = r.show_in_rating || isMe
    return {
      rank,
      me: isMe,
      name: visible ? shortName(r.name) : 'Участник скрыл имя',
      city: visible ? r.city : '',
      avatar: visible ? r.avatar : 'lilac',
      avatar_emoji: visible ? r.avatar_emoji : '🙂',
      tokens: r.tokens,
      courses_done: r.courses_done,
      level: levelFor(r.tokens).title,
    }
  })
  res.json({ list, total: list.length })
})

// ───────── Участники и наставники ─────────
export const people = Router()
people.use(requireAuth)

people.get('/', (req, res) => {
  const d = parse(z.object({
    q: z.string().trim().max(60).optional(),
    interest: z.string().optional(),
    role: z.enum(['participant', 'mentor']).optional(),
  }), req.query)
  const where = ["status = 'active'", "role != 'admin'", 'id != ?']
  const params: unknown[] = [req.user!.id]
  if (d.role) { where.push('role = ?'); params.push(d.role) }
  if (d.q) { where.push('(name LIKE ? OR city LIKE ? OR headline LIKE ?)'); params.push(`%${d.q}%`, `%${d.q}%`, `%${d.q}%`) }
  if (d.interest) { where.push('interests LIKE ?'); params.push(`%"${d.interest}"%`) }
  const rows = q.all<any>(`SELECT * FROM users WHERE ${where.join(' AND ')} ORDER BY role = 'mentor' DESC, name LIMIT 100`, ...params)
  res.json(rows.map((u) => ({ ...publicUser(u), name: u.role === 'mentor' ? u.name : shortName(u.name), allow_messages: !!u.allow_messages })))
})

people.get('/:id', (req, res) => {
  const id = idParam(req.params.id)
  const u = q.get<any>("SELECT * FROM users WHERE id = ? AND status = 'active'", id)
  if (!u || (u.role === 'admin' && req.user!.role !== 'admin')) throw new HttpError(404, 'Профиль не найден')
  const tokens = q.get<{ s: number }>('SELECT COALESCE(SUM(amount),0) s FROM token_tx WHERE user_id = ?', id)!.s
  const achievements = q.all<{ code: string }>('SELECT code FROM user_achievements WHERE user_id = ?', id).map((a) => a.code)
  const courses = u.role === 'mentor'
    ? q.all('SELECT slug, title, direction FROM courses WHERE mentor_id = ? AND published = 1', id)
    : q.all('SELECT c.slug, c.title, c.direction FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ? AND e.completed_at IS NOT NULL', id)
  const ideas = q.all("SELECT id, title, created_at FROM posts WHERE author_id = ? AND kind = 'idea' AND status = 'published' ORDER BY id DESC", id)
  res.json({
    ...publicUser(u),
    name: u.role === 'participant' && u.id !== req.user!.id ? shortName(u.name) : u.name,
    allow_messages: !!u.allow_messages,
    level: u.role === 'participant' ? levelFor(tokens).title : null,
    achievements,
    courses,
    ideas,
  })
})
