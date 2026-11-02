import type { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import { q } from '../db.js'
import type { Role } from '../../../shared/constants.js'


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

let rounds = 10
/** В браузере хеширование медленнее — там используется меньше раундов */
export const setHashRounds = (n: number) => { rounds = n }
export const hashPassword = (p: string) => bcrypt.hashSync(p, rounds)
export const checkPassword = (p: string, hash: string) => bcrypt.compareSync(p, hash)

/** Как хранится сессия, решает среда: на сервере — cookie с JWT, в браузере — localStorage */
export interface SessionStore {
  start(res: Response, userId: number): void
  end(res: Response): void
  read(req: Request): number | null
}
let store: SessionStore | null = null
export const setSessionStore = (s: SessionStore) => { store = s }

export function startSession(res: Response, userId: number) { store!.start(res, userId) }
export function endSession(res: Response) { store!.end(res) }

/** Подтягивает пользователя из сессии, если она есть. Не блокирует запрос. */
export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const uid = store?.read(req)
  if (uid) {
    const u = q.get<SessionUser>('SELECT id, name, role, status FROM users WHERE id = ?', uid)
    if (u && u.status !== 'blocked') {
      req.user = u
      q.run("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?", u.id)
    }
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
