import { q } from '../db.js'
import { ACHIEVEMENTS, TRIP, levelFor, type TokenCategory } from '../../../shared/constants.js'

export function notify(userId: number, text: string, link?: string) {
  q.run('INSERT INTO notifications (user_id, text, link) VALUES (?, ?, ?)', userId, text, link ?? null)
}

export function logActivity(userId: number, kind: string, text: string, link?: string) {
  q.run('INSERT INTO activity (user_id, kind, text, link) VALUES (?, ?, ?, ?)', userId, kind, text, link ?? null)
}

export function balance(userId: number): number {
  return q.get<{ s: number }>('SELECT COALESCE(SUM(amount),0) AS s FROM token_tx WHERE user_id = ?', userId)!.s
}

/**
 * Начисляет жетоны. `ref` — уникальный ключ источника (например, `task:12`):
 * повторное начисление за одно и то же действие невозможно.
 * Возвращает true, если начисление прошло.
 */
export function award(
  userId: number, amount: number, category: TokenCategory, reason: string,
  opts: { ref?: string; by?: number; link?: string } = {},
): boolean {
  if (!amount) return false
  const r = q.run(
    'INSERT OR IGNORE INTO token_tx (user_id, amount, category, reason, ref, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    userId, amount, category, reason, opts.ref ?? null, opts.by ?? null,
  )
  if (r.changes === 0) return false
  const sign = amount > 0 ? `+${amount}` : `${amount}`
  logActivity(userId, 'tokens', `${sign} жетонов: ${reason}`, opts.link)
  notify(userId, `${sign} 🪙 ${reason}`, opts.link ?? '/path')
  evaluateAchievements(userId)
  return true
}

export function grantAchievement(userId: number, code: string) {
  const r = q.run('INSERT OR IGNORE INTO user_achievements (user_id, code) VALUES (?, ?)', userId, code)
  if (r.changes) {
    const a = ACHIEVEMENTS.find((x) => x.code === code)
    if (a) {
      logActivity(userId, 'achievement', `Новое достижение: «${a.title}»`, '/me#achievements')
      notify(userId, `${a.emoji} Достижение «${a.title}» открыто`, '/me#achievements')
    }
  }
}

/** Пересчитывает достижения по фактическим данным пользователя. */
export function evaluateAchievements(userId: number) {
  const n = (sql: string) => q.get<{ n: number }>(sql, userId)!.n
  const tokens = balance(userId)
  const checks: Record<string, boolean> = {
    welcome: true,
    first_lesson: n('SELECT COUNT(*) n FROM lesson_progress WHERE user_id = ?') >= 1,
    first_task: n("SELECT COUNT(*) n FROM submissions WHERE user_id = ? AND status = 'approved'") >= 1,
    first_course: n('SELECT COUNT(*) n FROM enrollments WHERE user_id = ? AND completed_at IS NOT NULL') >= 1,
    three_courses: n('SELECT COUNT(*) n FROM enrollments WHERE user_id = ? AND completed_at IS NOT NULL') >= 3,
    first_event: n("SELECT COUNT(*) n FROM event_registrations WHERE user_id = ? AND status = 'attended'") >= 1,
    five_events: n("SELECT COUNT(*) n FROM event_registrations WHERE user_id = ? AND status = 'attended'") >= 5,
    team: n("SELECT COUNT(*) n FROM token_tx WHERE user_id = ? AND category = 'team' AND amount > 0") >= 1,
    initiator: n("SELECT COUNT(*) n FROM posts WHERE author_id = ? AND kind = 'idea' AND status = 'published'") >= 1,
    tokens_100: tokens >= 100,
    trip_ready: tokens >= TRIP.threshold,
  }
  for (const [code, ok] of Object.entries(checks)) if (ok) grantAchievement(userId, code)
}

/** Сводка по жетонам: баланс, разбивка, уровень, место в рейтинге путешествия. */
export function tokenSummary(userId: number) {
  const total = balance(userId)
  const byCategory = q.all<{ category: string; sum: number }>(
    'SELECT category, SUM(amount) AS sum FROM token_tx WHERE user_id = ? GROUP BY category', userId,
  )
  const rank = q.get<{ r: number }>(
    `SELECT COUNT(*) + 1 AS r FROM (
       SELECT u.id, COALESCE(SUM(t.amount),0) s FROM users u LEFT JOIN token_tx t ON t.user_id = u.id
       WHERE u.role = 'participant' AND u.status = 'active' GROUP BY u.id
     ) WHERE s > ?`, total,
  )!.r
  const participants = q.get<{ n: number }>(
    "SELECT COUNT(*) n FROM users WHERE role = 'participant' AND status = 'active'",
  )!.n
  return { total, byCategory, level: levelFor(total), rank, participants, trip: TRIP }
}

/** Публичное представление пользователя: только то, что безопасно показывать другим. */
export function publicUser(u: any) {
  if (!u) return null
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    avatar: u.avatar,
    avatar_emoji: u.avatar_emoji,
    city: u.city,
    headline: u.headline,
    bio: u.bio,
    interests: safeJson(u.interests, []),
  }
}

export function safeJson<T>(s: string | null | undefined, fallback: T): T {
  try { return s ? JSON.parse(s) : fallback } catch { return fallback }
}

/** «Имя Ф.» — так участники отображаются в рейтинге */
export function shortName(name: string) {
  const [first, last] = name.split(' ')
  return last ? `${first} ${last[0]}.` : first
}
