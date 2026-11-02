import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { q } from '../db.js'
import type { Role } from '../../../shared/constants.js'

const SECRET = process.env.JWT_SECRET ?? 'dev-only-secret-change-me'
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  JWT_SECRET не задан — используется небезопасный секрет по умолчанию.')
}

export const COOKIE = 'pvb_session'

export interface SessionUser {
  id: number
  name: string
  role: Role
  status: 'active' | 'pending' | 'blocked'
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: SessionUser }
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message) }
}

export const hashPassword = (p: string) => bcrypt.hashSync(p, 10)
export const checkPassword = (p: string, hash: string) => bcrypt.compareSync(p, hash)

export function startSession(res: Response, userId: number) {
  const token = jwt.sign({ uid: userId }, SECRET, { expiresIn: '30d' })
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: res.req.secure, // только по HTTPS, если сайт открыт по HTTPS (за прокси учитывается X-Forwarded-Proto)
    maxAge: 30 * 24 * 3600 * 1000,
  })
}

export function endSession(res: Response) {
  res.clearCookie(COOKIE)
}

/** Подтягивает пользователя из cookie, если она есть. Не блокирует запрос. */
export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE]
  if (token) {
    try {
      const { uid } = jwt.verify(token, SECRET) as { uid: number }
      const u = q.get<SessionUser>('SELECT id, name, role, status FROM users WHERE id = ?', uid)
      if (u && u.status !== 'blocked') {
        req.user = u
        q.run("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?", u.id)
      }
    } catch { /* просроченная или подделанная сессия — игнорируем */ }
  }
  next()
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new HttpError(401, 'Войдите в аккаунт, чтобы продолжить')
  if (req.user.status === 'pending') throw new HttpError(403, 'Аккаунт наставника ждёт подтверждения администратора', 'pending')
  next()
}

export const requireRole = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) throw new HttpError(401, 'Войдите в аккаунт, чтобы продолжить')
  if (!roles.includes(req.user.role)) throw new HttpError(403, 'Недостаточно прав для этого действия')
  if (req.user.status !== 'active') throw new HttpError(403, 'Аккаунт не активен')
  next()
}

export const isStaff = (u?: SessionUser) => !!u && (u.role === 'mentor' || u.role === 'admin') && u.status === 'active'
