// Сессии на сервере: подписанный JWT в httpOnly-cookie
import jwt from 'jsonwebtoken'
import type { SessionStore } from './auth.js'

const SECRET = process.env.JWT_SECRET ?? 'dev-only-secret-change-me'
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  JWT_SECRET не задан — используется небезопасный секрет по умолчанию.')
}
const COOKIE = 'pvb_session'

export const cookieSessions: SessionStore = {
  start(res, userId) {
    const token = jwt.sign({ uid: userId }, SECRET, { expiresIn: '30d' })
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: res.req.secure, // только по HTTPS, если сайт открыт по HTTPS
      maxAge: 30 * 24 * 3600 * 1000,
    })
  },
  end(res) { res.clearCookie(COOKIE) },
  read(req) {
    const token = req.cookies?.[COOKIE]
    if (!token) return null
    try { return (jwt.verify(token, SECRET) as { uid: number }).uid } catch { return null }
  },
}
