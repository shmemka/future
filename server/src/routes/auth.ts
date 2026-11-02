import { Router } from 'express'
import { z } from 'zod'
import { q } from '../db.js'
import { HttpError, checkPassword, endSession, hashPassword, startSession, isStaff } from '../lib/auth.js'
import { parse, text } from '../lib/http.js'
import { evaluateAchievements, logActivity, notify, safeJson } from '../lib/progress.js'
import { DIRECTION_KEYS } from '../../../shared/constants.js'

export const auth = Router()

const AVATARS = ['violet', 'pink', 'amber', 'sky', 'mint', 'coral', 'lilac']
const EMOJIS = ['🚀', '🌟', '🦊', '🐼', '🎧', '🌈', '🪐', '🐳', '🔥', '🍀']

const registerSchema = z.object({
  name: text(2, 60, 'Имя'),
  email: z.string().trim().toLowerCase().email('Укажите корректную почту'),
  password: z.string().min(8, 'Пароль: минимум 8 символов').max(100),
  role: z.enum(['participant', 'mentor']).default('participant'),
  city: z.string().trim().max(60).default(''),
  interests: z.array(z.enum(DIRECTION_KEYS as [string, ...string[]])).max(7).default([]),
  headline: z.string().trim().max(120).default(''),
  consent: z.literal(true, { message: 'Нужно согласие на обработку персональных данных' }),
})

auth.post('/register', (req, res) => {
  const d = parse(registerSchema, req.body)
  if (q.get('SELECT id FROM users WHERE email = ?', d.email)) {
    throw new HttpError(409, 'Этот адрес уже зарегистрирован. Войдите или восстановите доступ через администратора.')
  }
  const status = d.role === 'mentor' ? 'pending' : 'active'
  const r = q.run(
    `INSERT INTO users (name, email, password_hash, role, status, city, interests, headline, avatar, avatar_emoji)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    d.name, d.email, hashPassword(d.password), d.role, status, d.city, JSON.stringify(d.interests), d.headline,
    AVATARS[Math.floor(Math.random() * AVATARS.length)], EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
  )
  const id = Number(r.lastInsertRowid)
  logActivity(id, 'join', 'Регистрация на платформе «Путь в будущее»')
  evaluateAchievements(id)
  if (d.role === 'mentor') {
    for (const a of q.all<{ id: number }>("SELECT id FROM users WHERE role = 'admin'")) {
      notify(a.id, `Новая заявка наставника: ${d.name}`, '/admin?tab=users')
    }
  }
  startSession(res, id)
  res.status(201).json({ ok: true, status })
})

auth.post('/login', (req, res) => {
  const d = parse(z.object({ email: z.string().trim().toLowerCase(), password: z.string() }), req.body)
  const u = q.get<any>('SELECT * FROM users WHERE email = ?', d.email)
  if (!u || !checkPassword(d.password, u.password_hash)) throw new HttpError(401, 'Неверная почта или пароль')
  if (u.status === 'blocked') throw new HttpError(403, 'Аккаунт заблокирован модератором. Напишите администратору проекта.')
  startSession(res, u.id)
  res.json({ ok: true })
})

auth.post('/logout', (_req, res) => {
  endSession(res)
  res.json({ ok: true })
})

auth.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null })
  const u = q.get<any>('SELECT * FROM users WHERE id = ?', req.user.id)
  const unreadNotifications = q.get<{ n: number }>('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL', u.id)!.n
  const unreadMessages = q.get<{ n: number }>('SELECT COUNT(*) n FROM messages WHERE recipient_id = ? AND read_at IS NULL AND hidden = 0', u.id)!.n
  let moderationQueue = 0
  if (isStaff(req.user)) {
    moderationQueue =
      q.get<{ n: number }>("SELECT COUNT(*) n FROM posts WHERE status = 'pending'")!.n +
      q.get<{ n: number }>("SELECT COUNT(*) n FROM comments WHERE status = 'pending'")!.n +
      q.get<{ n: number }>("SELECT COUNT(*) n FROM reports WHERE status = 'open'")!.n +
      q.get<{ n: number }>("SELECT COUNT(*) n FROM help_requests WHERE status = 'new'")!.n
  }
  const rulesAccepted = !!q.get("SELECT 1 FROM user_achievements WHERE user_id = ? AND code = 'rules'", u.id)
  res.json({
    user: {
      id: u.id, name: u.name, email: u.email, role: u.role, status: u.status,
      avatar: u.avatar, avatar_emoji: u.avatar_emoji, city: u.city, school: u.school, bio: u.bio,
      headline: u.headline, interests: safeJson(u.interests, []),
      show_in_rating: !!u.show_in_rating, allow_messages: !!u.allow_messages, created_at: u.created_at,
      rulesAccepted,
    },
    counts: { unreadNotifications, unreadMessages, moderationQueue },
  })
})
