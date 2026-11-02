import { Router } from 'express'
import { q } from '../db.js'
import { shortName } from '../lib/progress.js'

export const publicApi = Router()

/** Данные для главной: доступны и гостям. Имена участников гостям не показываем. */
publicApi.get('/overview', (req, res) => {
  const n = (sql: string) => q.get<{ n: number }>(sql)!.n
  const stats = {
    participants: n("SELECT COUNT(*) n FROM users WHERE role = 'participant' AND status = 'active'"),
    mentors: n("SELECT COUNT(*) n FROM users WHERE role = 'mentor' AND status = 'active'"),
    courses: n('SELECT COUNT(*) n FROM courses WHERE published = 1'),
    completions: n('SELECT COUNT(*) n FROM enrollments WHERE completed_at IS NOT NULL'),
    eventsHeld: n("SELECT COUNT(*) n FROM events WHERE ends_at < datetime('now') AND published = 1"),
    tokens: n('SELECT COALESCE(SUM(amount),0) n FROM token_tx WHERE amount > 0'),
    ideas: n("SELECT COUNT(*) n FROM posts WHERE kind = 'idea' AND status = 'published'"),
    attendance: n("SELECT COUNT(*) n FROM event_registrations WHERE status = 'attended'"),
  }
  const events = q.all(
    `SELECT e.id, e.title, e.kind, e.starts_at, e.ends_at, e.location, e.format, e.capacity, e.tokens_reward,
       (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) AS registered
     FROM events e WHERE e.published = 1 AND e.starts_at >= datetime('now') ORDER BY e.starts_at LIMIT 3`,
  )
  const courses = q.all(
    `SELECT c.id, c.slug, c.title, c.direction, c.short, c.tokens_reward, c.duration_weeks, u.name AS mentor_name,
       (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS learners,
       (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lessons_total
     FROM courses c LEFT JOIN users u ON u.id = c.mentor_id WHERE c.published = 1 ORDER BY learners DESC LIMIT 4`,
  )
  // Лента достижений сообщества — только для вошедших и только по тем, кто не скрыл себя из рейтинга
  const feed = req.user
    ? q.all<any>(
        `SELECT a.text, a.kind, a.created_at, u.name, u.avatar, u.avatar_emoji FROM activity a JOIN users u ON u.id = a.user_id
         WHERE a.kind IN ('course','achievement','post') AND u.role = 'participant' AND u.show_in_rating = 1 AND u.status = 'active'
         ORDER BY a.created_at DESC, a.id DESC LIMIT 8`,
      ).map((a) => ({ ...a, name: shortName(a.name) }))
    : []
  res.json({ stats, events, courses, feed })
})
