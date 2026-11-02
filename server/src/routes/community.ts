import { Router } from 'express'
import { z } from 'zod'
import { q } from '../db.js'
import { HttpError, isStaff, requireAuth } from '../lib/auth.js'
import { idParam, parse, text } from '../lib/http.js'
import { assertNoContacts, looksToxic } from '../lib/safety.js'
import { logActivity, notify, shortName } from '../lib/progress.js'

export const community = Router()
community.use(requireAuth)

/** Имя автора: участники — «Имя Ф.», наставники — полностью */
const author = (r: any) => ({
  id: r.author_id,
  name: r.author_role === 'participant' ? shortName(r.author_name) : r.author_name,
  role: r.author_role,
  avatar: r.author_avatar,
  avatar_emoji: r.author_emoji,
})

const postSelect = `
  SELECT p.*, ch.slug AS channel_slug, ch.title AS channel_title, ch.emoji AS channel_emoji,
    u.name AS author_name, u.role AS author_role, u.avatar AS author_avatar, u.avatar_emoji AS author_emoji,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.status = 'published') AS comments_count,
    (SELECT COUNT(*) FROM post_supports s WHERE s.post_id = p.id) AS supports,
    (SELECT 1 FROM post_supports s WHERE s.post_id = p.id AND s.user_id = ?) AS supported
  FROM posts p JOIN channels ch ON ch.id = p.channel_id JOIN users u ON u.id = p.author_id`

const shapePost = (p: any) => ({
  id: p.id, kind: p.kind, title: p.title, body: p.body, status: p.status, moderation_note: p.moderation_note,
  pinned: !!p.pinned, created_at: p.created_at, comments_count: p.comments_count, supports: p.supports, supported: !!p.supported,
  channel: { slug: p.channel_slug, title: p.channel_title, emoji: p.channel_emoji },
  author: author(p),
})

community.get('/channels', (_req, res) => {
  res.json(q.all(
    `SELECT ch.*, (SELECT COUNT(*) FROM posts p WHERE p.channel_id = ch.id AND p.status = 'published') AS posts
     FROM channels ch ORDER BY position`,
  ))
})

community.get('/posts', (req, res) => {
  const d = parse(z.object({ channel: z.string().optional(), kind: z.enum(['discussion', 'idea', 'question']).optional() }), req.query)
  const uid = req.user!.id
  const where = ["(p.status = 'published' OR (p.author_id = ? AND p.status IN ('pending','rejected')))"]
  const params: unknown[] = [uid, uid]
  if (d.channel) { where.push('ch.slug = ?'); params.push(d.channel) }
  if (d.kind) { where.push('p.kind = ?'); params.push(d.kind) }
  res.json(q.all(`${postSelect} WHERE ${where.join(' AND ')} ORDER BY p.pinned DESC, p.created_at DESC LIMIT 80`, ...params).map(shapePost))
})

community.get('/posts/:id', (req, res) => {
  const id = idParam(req.params.id)
  const uid = req.user!.id
  const p = q.get<any>(`${postSelect} WHERE p.id = ?`, uid, id)
  const staff = isStaff(req.user)
  if (!p || (p.status !== 'published' && p.author_id !== uid && !staff)) throw new HttpError(404, 'Публикация не найдена или скрыта модератором')
  const comments = q.all<any>(
    `SELECT c.*, u.name AS author_name, u.role AS author_role, u.avatar AS author_avatar, u.avatar_emoji AS author_emoji
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.post_id = ? AND (c.status = 'published' OR c.author_id = ? OR ?)
     ORDER BY c.created_at`, id, uid, Number(staff),
  ).map((c) => ({ id: c.id, body: c.body, status: c.status, created_at: c.created_at, author: author(c) }))
  res.json({ ...shapePost(p), comments })
})

const postSchema = z.object({
  channel: z.string(),
  kind: z.enum(['discussion', 'idea', 'question']),
  title: text(5, 120, 'Заголовок'),
  body: text(20, 5000, 'Текст'),
})

community.post('/posts', (req, res) => {
  const d = parse(postSchema, req.body)
  assertNoContacts(d.title, d.body)
  const ch = q.get<any>('SELECT id, title FROM channels WHERE slug = ?', d.channel)
  if (!ch) throw new HttpError(400, 'Выберите раздел сообщества')
  const staff = isStaff(req.user)
  // Идеи и проекты проходят через наставника: он одобряет и начисляет жетоны за инициативу.
  // Тексты с подозрительными словами — на ручную проверку.
  let status: 'published' | 'pending' = 'published'
  let note = ''
  if (!staff && d.kind === 'idea') { status = 'pending'; note = 'Идеи публикуются после одобрения наставником' }
  if (!staff && looksToxic(`${d.title} ${d.body}`)) { status = 'pending'; note = 'Автомодерация: текст проверит модератор' }
  const r = q.run('INSERT INTO posts (channel_id, author_id, kind, title, body, status, moderation_note) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ch.id, req.user!.id, d.kind, d.title, d.body, status, note)
  const id = Number(r.lastInsertRowid)
  if (status === 'published') logActivity(req.user!.id, 'post', `Публикация «${d.title}»`, `/community/post/${id}`)
  if (d.kind === 'question' && status === 'published') {
    for (const m of q.all<{ id: number }>("SELECT id FROM users WHERE role = 'mentor' AND status = 'active'")) {
      notify(m.id, `Вопрос наставникам: «${d.title}»`, `/community/post/${id}`)
    }
  }
  res.status(201).json({ id, status, note })
})

community.delete('/posts/:id', (req, res) => {
  const p = q.get<any>('SELECT * FROM posts WHERE id = ?', idParam(req.params.id))
  if (!p) throw new HttpError(404, 'Публикация не найдена')
  if (p.author_id !== req.user!.id && !isStaff(req.user)) throw new HttpError(403, 'Удалить может автор или модератор')
  q.run('DELETE FROM posts WHERE id = ?', p.id)
  res.json({ ok: true })
})

community.post('/posts/:id/comments', (req, res) => {
  const id = idParam(req.params.id)
  const d = parse(z.object({ body: text(2, 2000, 'Комментарий') }), req.body)
  assertNoContacts(d.body)
  const p = q.get<any>("SELECT * FROM posts WHERE id = ? AND status = 'published'", id)
  if (!p) throw new HttpError(404, 'Публикация не найдена')
  const status = !isStaff(req.user) && looksToxic(d.body) ? 'pending' : 'published'
  const r = q.run('INSERT INTO comments (post_id, author_id, body, status) VALUES (?, ?, ?, ?)', id, req.user!.id, d.body, status)
  if (status === 'published' && p.author_id !== req.user!.id) {
    notify(p.author_id, `Новый ответ в «${p.title}»`, `/community/post/${id}`)
  }
  res.status(201).json({ id: Number(r.lastInsertRowid), status })
})

community.delete('/comments/:id', (req, res) => {
  const c = q.get<any>('SELECT * FROM comments WHERE id = ?', idParam(req.params.id))
  if (!c) throw new HttpError(404, 'Комментарий не найден')
  if (c.author_id !== req.user!.id && !isStaff(req.user)) throw new HttpError(403, 'Удалить может автор или модератор')
  q.run('DELETE FROM comments WHERE id = ?', c.id)
  res.json({ ok: true })
})

community.post('/posts/:id/support', (req, res) => {
  const id = idParam(req.params.id)
  if (!q.get("SELECT 1 FROM posts WHERE id = ? AND status = 'published'", id)) throw new HttpError(404, 'Публикация не найдена')
  const r = q.run('DELETE FROM post_supports WHERE post_id = ? AND user_id = ?', id, req.user!.id)
  if (!r.changes) q.run('INSERT INTO post_supports (post_id, user_id) VALUES (?, ?)', id, req.user!.id)
  res.json({ supported: !r.changes })
})

// ───────── Личные сообщения ─────────
export const messages = Router()
messages.use(requireAuth)

messages.get('/', (req, res) => {
  const uid = req.user!.id
  const rows = q.all<any>(
    `SELECT other_id, MAX(id) AS last_id FROM (
       SELECT id, recipient_id AS other_id FROM messages WHERE sender_id = ?
       UNION ALL SELECT id, sender_id AS other_id FROM messages WHERE recipient_id = ? AND hidden = 0
     ) GROUP BY other_id ORDER BY last_id DESC`, uid, uid,
  )
  res.json(rows.map((r) => {
    const u = q.get<any>('SELECT id, name, role, avatar, avatar_emoji, headline FROM users WHERE id = ?', r.other_id)
    const last = q.get<any>('SELECT body, sender_id, created_at FROM messages WHERE id = ?', r.last_id)
    const unread = q.get<{ n: number }>('SELECT COUNT(*) n FROM messages WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL AND hidden = 0', r.other_id, uid)!.n
    return { user: u && { ...u, name: u.role === 'participant' ? shortName(u.name) : u.name }, last, unread }
  }).filter((c) => c.user))
})

messages.get('/:userId', (req, res) => {
  const uid = req.user!.id
  const other = idParam(req.params.userId)
  const u = q.get<any>("SELECT id, name, role, avatar, avatar_emoji, headline, allow_messages, status FROM users WHERE id = ?", other)
  if (!u) throw new HttpError(404, 'Пользователь не найден')
  q.run("UPDATE messages SET read_at = datetime('now') WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL", other, uid)
  const list = q.all(
    `SELECT id, sender_id, body, created_at, read_at FROM messages
     WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ? AND hidden = 0))
     ORDER BY id LIMIT 500`, uid, other, other, uid,
  )
  res.json({
    user: { ...u, name: u.role === 'participant' ? shortName(u.name) : u.name, allow_messages: !!u.allow_messages },
    messages: list,
  })
})

messages.post('/:userId', (req, res) => {
  const uid = req.user!.id
  const other = idParam(req.params.userId)
  if (other === uid) throw new HttpError(400, 'Нельзя написать самому себе')
  const d = parse(z.object({ body: text(1, 2000, 'Сообщение') }), req.body)
  const u = q.get<any>('SELECT id, role, status, allow_messages FROM users WHERE id = ?', other)
  if (!u || u.status !== 'active') throw new HttpError(404, 'Пользователь недоступен')
  // Участник может выключить сообщения от других участников. Наставники и модераторы пишут всегда.
  if (req.user!.role === 'participant' && u.role === 'participant' && !u.allow_messages) {
    const replied = q.get('SELECT 1 FROM messages WHERE sender_id = ? AND recipient_id = ?', other, uid)
    if (!replied) throw new HttpError(403, 'Участник принимает сообщения только от наставников. Можно ответить ему в обсуждении.')
  }
  assertNoContacts(d.body)
  if (req.user!.role === 'participant' && looksToxic(d.body)) {
    throw new HttpError(422, 'Сообщение похоже на оскорбление и не отправлено. Попробуй сказать то же самое по-другому — без обидных слов.', 'toxic')
  }
  const r = q.run('INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)', uid, other, d.body)
  res.status(201).json({ id: Number(r.lastInsertRowid) })
})
