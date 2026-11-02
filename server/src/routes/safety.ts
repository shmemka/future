import { Router } from 'express'
import { z } from 'zod'
import { q, tx } from '../db.js'
import { HttpError, hashPassword, requireAuth, requireRole } from '../lib/auth.js'
import { idParam, parse, text } from '../lib/http.js'
import { award, logActivity, notify, shortName } from '../lib/progress.js'
import { REPORT_REASONS, TOKEN_RULES } from '../../../shared/constants.js'

// ───────── Жалобы и обращения (любой участник) ─────────
export const safety = Router()
safety.use(requireAuth)

safety.post('/reports', (req, res) => {
  const d = parse(z.object({
    target_type: z.enum(['post', 'comment', 'message', 'user']),
    target_id: z.number().int().positive(),
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(1000).default(''),
  }), req.body)
  const exists: Record<string, string> = {
    post: 'SELECT 1 FROM posts WHERE id = ?', comment: 'SELECT 1 FROM comments WHERE id = ?',
    message: 'SELECT 1 FROM messages WHERE id = ? AND recipient_id = ' + Number(req.user!.id), user: 'SELECT 1 FROM users WHERE id = ?',
  }
  if (!q.get(exists[d.target_type], d.target_id)) throw new HttpError(404, 'Объект жалобы не найден')
  const dup = q.get("SELECT 1 FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'open'", req.user!.id, d.target_type, d.target_id)
  if (!dup) {
    q.run('INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES (?, ?, ?, ?, ?)',
      req.user!.id, d.target_type, d.target_id, d.reason, d.details)
    for (const s of q.all<{ id: number }>("SELECT id FROM users WHERE role IN ('admin','mentor') AND status = 'active'")) {
      notify(s.id, `Новая жалоба: ${d.reason.toLowerCase()}`, '/moderation')
    }
  }
  res.status(201).json({ ok: true })
})

safety.post('/help', (req, res) => {
  const d = parse(z.object({
    addressee: z.enum(['moderator', 'mentor', 'psychologist']),
    topic: text(3, 120, 'Тема'),
    body: text(10, 3000, 'Сообщение'),
    anonymous: z.boolean().default(false),
  }), req.body)
  q.run('INSERT INTO help_requests (user_id, addressee, topic, body, anonymous) VALUES (?, ?, ?, ?, ?)',
    req.user!.id, d.addressee, d.topic, d.body, Number(d.anonymous))
  for (const s of q.all<{ id: number }>("SELECT id FROM users WHERE role IN ('admin','mentor') AND status = 'active'")) {
    notify(s.id, 'Новое обращение за помощью', '/moderation?tab=help')
  }
  res.status(201).json({ ok: true })
})

safety.get('/help/mine', (req, res) => {
  res.json(q.all('SELECT id, addressee, topic, body, anonymous, status, response, created_at, handled_at FROM help_requests WHERE user_id = ? ORDER BY id DESC', req.user!.id))
})

// ───────── Модерация (наставники и администраторы) ─────────
export const moderation = Router()
moderation.use(requireRole('mentor', 'admin'))

function targetPreview(type: string, id: number) {
  if (type === 'post') {
    const p = q.get<any>('SELECT p.id, p.title, p.body, p.status, u.name, u.id AS uid FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?', id)
    return p && { text: `${p.title}\n${p.body}`, status: p.status, author: p.name, author_id: p.uid, link: `/community/post/${p.id}` }
  }
  if (type === 'comment') {
    const c = q.get<any>('SELECT c.id, c.body, c.status, c.post_id, u.name, u.id AS uid FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?', id)
    return c && { text: c.body, status: c.status, author: c.name, author_id: c.uid, link: `/community/post/${c.post_id}` }
  }
  if (type === 'message') {
    const m = q.get<any>('SELECT m.body, m.hidden, u.name, u.id AS uid FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?', id)
    return m && { text: m.body, status: m.hidden ? 'hidden' : 'published', author: m.name, author_id: m.uid, link: null }
  }
  const u = q.get<any>('SELECT id, name, status, bio FROM users WHERE id = ?', id)
  return u && { text: u.bio || '(профиль без описания)', status: u.status, author: u.name, author_id: u.id, link: `/people/${u.id}` }
}

moderation.get('/', (_req, res) => {
  const posts = q.all(
    `SELECT p.id, p.kind, p.title, p.body, p.moderation_note, p.created_at, ch.title AS channel, u.name AS author, u.id AS author_id
     FROM posts p JOIN channels ch ON ch.id = p.channel_id JOIN users u ON u.id = p.author_id
     WHERE p.status = 'pending' ORDER BY p.created_at`,
  )
  const comments = q.all(
    `SELECT c.id, c.body, c.created_at, c.post_id, p.title AS post_title, u.name AS author
     FROM comments c JOIN posts p ON p.id = c.post_id JOIN users u ON u.id = c.author_id
     WHERE c.status = 'pending' ORDER BY c.created_at`,
  )
  const reports = q.all<any>(
    `SELECT r.*, u.name AS reporter FROM reports r JOIN users u ON u.id = r.reporter_id
     ORDER BY r.status = 'open' DESC, r.created_at DESC LIMIT 60`,
  ).map((r) => ({ ...r, target: targetPreview(r.target_type, r.target_id) }))
  const help = q.all<any>(
    `SELECT h.*, u.name AS user_name, u.city FROM help_requests h JOIN users u ON u.id = h.user_id
     ORDER BY h.status = 'closed', h.created_at DESC LIMIT 60`,
  ).map((h) => ({ ...h, user_name: h.anonymous ? 'Анонимно' : h.user_name, city: h.anonymous ? '' : h.city, user_id: h.anonymous ? null : h.user_id }))
  res.json({ posts, comments, reports, help })
})

moderation.post('/posts/:id', (req, res) => {
  const d = parse(z.object({ action: z.enum(['approve', 'reject', 'hide']), note: z.string().trim().max(500).default('') }), req.body)
  const p = q.get<any>('SELECT * FROM posts WHERE id = ?', idParam(req.params.id))
  if (!p) throw new HttpError(404, 'Публикация не найдена')
  tx(() => {
    if (d.action === 'approve') {
      q.run("UPDATE posts SET status = 'published', moderation_note = '' WHERE id = ?", p.id)
      logActivity(p.author_id, 'post', `Опубликовано: «${p.title}»`, `/community/post/${p.id}`)
      if (p.kind === 'idea') {
        award(p.author_id, TOKEN_RULES.ideaApproved, 'initiative', `Идея «${p.title}» одобрена`, { ref: `idea:${p.id}`, by: req.user!.id, link: `/community/post/${p.id}` })
      } else {
        notify(p.author_id, `Публикация «${p.title}» прошла модерацию`, `/community/post/${p.id}`)
      }
    } else {
      const status = d.action === 'reject' ? 'rejected' : 'hidden'
      q.run('UPDATE posts SET status = ?, moderation_note = ? WHERE id = ?', status, d.note || 'Не соответствует правилам сообщества', p.id)
      notify(p.author_id, `Публикация «${p.title}» не прошла модерацию${d.note ? ': ' + d.note : ''}`, '/community?mine=1')
    }
  })
  res.json({ ok: true })
})

moderation.post('/comments/:id', (req, res) => {
  const d = parse(z.object({ action: z.enum(['approve', 'hide']) }), req.body)
  const c = q.get<any>('SELECT * FROM comments WHERE id = ?', idParam(req.params.id))
  if (!c) throw new HttpError(404, 'Комментарий не найден')
  q.run('UPDATE comments SET status = ? WHERE id = ?', d.action === 'approve' ? 'published' : 'hidden', c.id)
  res.json({ ok: true })
})

moderation.post('/reports/:id', (req, res) => {
  const d = parse(z.object({
    status: z.enum(['resolved', 'dismissed']),
    resolution: z.string().trim().max(800).default(''),
    hideTarget: z.boolean().default(false),
    blockAuthor: z.boolean().default(false),
  }), req.body)
  const r = q.get<any>('SELECT * FROM reports WHERE id = ?', idParam(req.params.id))
  if (!r) throw new HttpError(404, 'Жалоба не найдена')
  if (d.blockAuthor && req.user!.role !== 'admin') throw new HttpError(403, 'Блокировать аккаунты может только администратор')
  tx(() => {
    if (d.hideTarget) {
      if (r.target_type === 'post') q.run("UPDATE posts SET status = 'hidden', moderation_note = 'Скрыто по жалобе' WHERE id = ?", r.target_id)
      if (r.target_type === 'comment') q.run("UPDATE comments SET status = 'hidden' WHERE id = ?", r.target_id)
      if (r.target_type === 'message') q.run('UPDATE messages SET hidden = 1 WHERE id = ?', r.target_id)
    }
    if (d.blockAuthor) {
      const t = targetPreview(r.target_type, r.target_id)
      if (t?.author_id) q.run("UPDATE users SET status = 'blocked' WHERE id = ? AND role != 'admin'", t.author_id)
    }
    q.run("UPDATE reports SET status = ?, resolution = ?, handled_by = ?, handled_at = datetime('now') WHERE id = ?", d.status, d.resolution, req.user!.id, r.id)
    notify(r.reporter_id, d.status === 'resolved'
      ? 'Ваша жалоба рассмотрена, меры приняты. Спасибо, что помогаете держать пространство безопасным.'
      : 'Ваша жалоба рассмотрена: нарушений не нашли. Если ситуация повторится — напишите снова.', '/safety')
  })
  res.json({ ok: true })
})

moderation.post('/help/:id', (req, res) => {
  const d = parse(z.object({ status: z.enum(['in_progress', 'closed']), response: z.string().trim().max(3000).default('') }), req.body)
  const h = q.get<any>('SELECT * FROM help_requests WHERE id = ?', idParam(req.params.id))
  if (!h) throw new HttpError(404, 'Обращение не найдено')
  q.run("UPDATE help_requests SET status = ?, response = ?, handled_by = ?, handled_at = datetime('now') WHERE id = ?",
    d.status, d.response || h.response, req.user!.id, h.id)
  if (d.response) notify(h.user_id, `Ответ на обращение «${h.topic}»`, '/safety#my-requests')
  res.json({ ok: true })
})

// Наставник отмечает командную работу
moderation.post('/team-award', (req, res) => {
  const d = parse(z.object({
    userId: z.number().int(),
    amount: z.number().int().min(1).max(TOKEN_RULES.maxTeamAward),
    reason: text(5, 160, 'За что начисляем'),
  }), req.body)
  const u = q.get<any>("SELECT id, role FROM users WHERE id = ? AND status = 'active'", d.userId)
  if (!u || u.role !== 'participant') throw new HttpError(400, 'Жетоны начисляются только участникам')
  award(u.id, d.amount, 'team', d.reason, { by: req.user!.id })
  res.json({ ok: true })
})

moderation.get('/participants', (_req, res) => {
  res.json(q.all<any>(
    `SELECT u.id, u.name, u.city, u.avatar, u.avatar_emoji, COALESCE(SUM(t.amount),0) AS tokens
     FROM users u LEFT JOIN token_tx t ON t.user_id = u.id
     WHERE u.role = 'participant' AND u.status = 'active' GROUP BY u.id ORDER BY u.name`,
  ))
})

// ───────── Администрирование ─────────
export const admin = Router()
admin.use(requireRole('admin'))

admin.get('/stats', (_req, res) => {
  const n = (sql: string) => q.get<{ n: number }>(sql)!.n
  res.json({
    participants: n("SELECT COUNT(*) n FROM users WHERE role = 'participant' AND status = 'active'"),
    mentors: n("SELECT COUNT(*) n FROM users WHERE role = 'mentor' AND status = 'active'"),
    pendingMentors: n("SELECT COUNT(*) n FROM users WHERE role = 'mentor' AND status = 'pending'"),
    blocked: n("SELECT COUNT(*) n FROM users WHERE status = 'blocked'"),
    courses: n('SELECT COUNT(*) n FROM courses WHERE published = 1'),
    enrollments: n('SELECT COUNT(*) n FROM enrollments'),
    completions: n('SELECT COUNT(*) n FROM enrollments WHERE completed_at IS NOT NULL'),
    events: n('SELECT COUNT(*) n FROM events'),
    attendance: n("SELECT COUNT(*) n FROM event_registrations WHERE status = 'attended'"),
    tokens: n('SELECT COALESCE(SUM(amount),0) n FROM token_tx'),
    posts: n("SELECT COUNT(*) n FROM posts WHERE status = 'published'"),
    openReports: n("SELECT COUNT(*) n FROM reports WHERE status = 'open'"),
    activeWeek: n("SELECT COUNT(*) n FROM users WHERE last_seen_at >= datetime('now','-7 days')"),
    tokensByCategory: q.all('SELECT category, SUM(amount) AS sum FROM token_tx GROUP BY category ORDER BY sum DESC'),
    signupsByWeek: q.all(
      `SELECT strftime('%Y-%W', created_at) AS week, COUNT(*) AS n FROM users WHERE role = 'participant'
       GROUP BY week ORDER BY week DESC LIMIT 8`,
    ),
  })
})

admin.get('/users', (req, res) => {
  const d = parse(z.object({ q: z.string().trim().optional(), role: z.string().optional(), status: z.string().optional() }), req.query)
  const where = ['1=1']
  const params: unknown[] = []
  if (d.q) { where.push('(u.name LIKE ? OR u.email LIKE ?)'); params.push(`%${d.q}%`, `%${d.q}%`) }
  if (d.role) { where.push('u.role = ?'); params.push(d.role) }
  if (d.status) { where.push('u.status = ?'); params.push(d.status) }
  res.json(q.all(
    `SELECT u.id, u.name, u.email, u.role, u.status, u.city, u.avatar, u.avatar_emoji, u.created_at, u.last_seen_at,
       COALESCE((SELECT SUM(amount) FROM token_tx t WHERE t.user_id = u.id), 0) AS tokens
     FROM users u WHERE ${where.join(' AND ')} ORDER BY u.status = 'pending' DESC, u.created_at DESC LIMIT 300`, ...params,
  ))
})

admin.patch('/users/:id', (req, res) => {
  const id = idParam(req.params.id)
  const d = parse(z.object({ role: z.enum(['participant', 'mentor', 'admin']).optional(), status: z.enum(['active', 'blocked', 'pending']).optional() }), req.body)
  if (id === req.user!.id) throw new HttpError(400, 'Нельзя менять роль или статус своего аккаунта')
  const u = q.get<any>('SELECT * FROM users WHERE id = ?', id)
  if (!u) throw new HttpError(404, 'Пользователь не найден')
  if (d.role) q.run('UPDATE users SET role = ? WHERE id = ?', d.role, id)
  if (d.status) q.run('UPDATE users SET status = ? WHERE id = ?', d.status, id)
  if (u.status === 'pending' && d.status === 'active') notify(id, 'Аккаунт наставника подтверждён. Добро пожаловать в команду!', '/mentor')
  res.json({ ok: true })
})

admin.post('/users/:id/password', (req, res) => {
  const id = idParam(req.params.id)
  const d = parse(z.object({ password: z.string().min(8, 'Пароль: минимум 8 символов').max(100) }), req.body)
  const u = q.get<any>('SELECT id, role FROM users WHERE id = ?', id)
  if (!u) throw new HttpError(404, 'Пользователь не найден')
  q.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(d.password), id)
  notify(id, 'Администратор установил вам новый пароль. Смените его при первой возможности.')
  res.json({ ok: true })
})

admin.post('/tokens', (req, res) => {
  const d = parse(z.object({
    userId: z.number().int(),
    amount: z.number().int().min(-500).max(500).refine((v) => v !== 0, 'Сумма не может быть нулевой'),
    category: z.enum(['course', 'task', 'event', 'team', 'initiative', 'bonus', 'correction']),
    reason: text(5, 160, 'Основание'),
  }), req.body)
  if (!q.get('SELECT 1 FROM users WHERE id = ?', d.userId)) throw new HttpError(404, 'Пользователь не найден')
  award(d.userId, d.amount, d.category, d.reason, { by: req.user!.id })
  res.json({ ok: true })
})

admin.get('/tokens', (_req, res) => {
  res.json(q.all<any>(
    `SELECT t.id, t.amount, t.category, t.reason, t.created_at, u.name AS user_name, u.id AS user_id, b.name AS by_name
     FROM token_tx t JOIN users u ON u.id = t.user_id LEFT JOIN users b ON b.id = t.created_by
     ORDER BY t.id DESC LIMIT 150`,
  ).map((t) => ({ ...t, user_short: shortName(t.user_name) })))
})
