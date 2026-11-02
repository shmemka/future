import { Router } from 'express'
import { z } from 'zod'
import { q, tx } from '../db.js'
import { HttpError, isStaff, requireAuth, requireRole } from '../lib/auth.js'
import { idParam, parse, text } from '../lib/http.js'
import { assertNoContacts } from '../lib/safety.js'
import { award, evaluateAchievements, logActivity, notify, publicUser, safeJson } from '../lib/progress.js'
import { DIRECTION_KEYS } from '../../../shared/constants.js'

export const courses = Router()

type Quiz = { q: string; options: string[]; answer: number }[]

/** Скрываем правильные ответы теста от участников */
const publicTask = (t: any) => ({
  ...t,
  quiz: t.quiz ? safeJson<Quiz>(t.quiz, []).map(({ q, options }) => ({ q, options })) : null,
})

courses.get('/', (req, res) => {
  const uid = req.user?.id ?? 0
  const rows = q.all<any>(
    `SELECT c.*, u.name AS mentor_name, u.avatar AS mentor_avatar, u.avatar_emoji AS mentor_emoji,
       (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lessons_total,
       (SELECT COUNT(*) FROM tasks t WHERE t.course_id = c.id) AS tasks_total,
       (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS learners,
       (SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.user_id = ?) AS enrolled,
       (SELECT completed_at FROM enrollments e WHERE e.course_id = c.id AND e.user_id = ?) AS completed_at,
       (SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE l.course_id = c.id AND lp.user_id = ?) AS lessons_done
     FROM courses c LEFT JOIN users u ON u.id = c.mentor_id
     WHERE c.published = 1 ORDER BY learners DESC, c.id`,
    uid, uid, uid,
  )
  res.json(rows.map((c) => ({ ...c, outcomes: safeJson(c.outcomes, []), enrolled: !!c.enrolled })))
})

courses.get('/:slug', (req, res) => {
  const c = q.get<any>('SELECT * FROM courses WHERE slug = ?', req.params.slug)
  if (!c || (!c.published && !isStaff(req.user))) throw new HttpError(404, 'Курс не найден')
  const uid = req.user?.id ?? 0
  const lessons = q.all<any>(
    `SELECT l.id, l.position, l.title, l.duration_min,
       (SELECT 1 FROM lesson_progress lp WHERE lp.lesson_id = l.id AND lp.user_id = ?) AS done
     FROM lessons l WHERE l.course_id = ? ORDER BY l.position, l.id`, uid, c.id,
  ).map((l) => ({ ...l, done: !!l.done }))
  const tasks = q.all<any>('SELECT * FROM tasks WHERE course_id = ? ORDER BY position, id', c.id).map(publicTask)
  const submissions = uid
    ? q.all<any>('SELECT s.task_id, s.status, s.feedback, s.score, s.answer, s.created_at FROM submissions s JOIN tasks t ON t.id = s.task_id WHERE t.course_id = ? AND s.user_id = ?', c.id, uid)
    : []
  const enrollment = uid ? q.get('SELECT enrolled_at, completed_at FROM enrollments WHERE user_id = ? AND course_id = ?', uid, c.id) : null
  const mentor = c.mentor_id ? publicUser(q.get('SELECT * FROM users WHERE id = ?', c.mentor_id)) : null
  const learners = q.get<{ n: number }>('SELECT COUNT(*) n FROM enrollments WHERE course_id = ?', c.id)!.n
  res.json({
    ...c, outcomes: safeJson(c.outcomes, []), mentor, lessons,
    tasks: tasks.map((t) => ({ ...t, submission: submissions.find((s) => s.task_id === t.id) ?? null })),
    enrollment, learners,
  })
})

courses.post('/:slug/enroll', requireAuth, (req, res) => {
  const c = q.get<any>('SELECT id, title, slug FROM courses WHERE slug = ? AND published = 1', req.params.slug)
  if (!c) throw new HttpError(404, 'Курс не найден')
  const r = q.run('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)', req.user!.id, c.id)
  if (r.changes) logActivity(req.user!.id, 'enroll', `Запись на курс «${c.title}»`, `/courses/${c.slug}`)
  res.json({ ok: true })
})

/** Курс завершён, когда пройдены все уроки и зачтены все задания */
function checkCourseCompletion(userId: number, courseId: number) {
  const c = q.get<any>('SELECT id, slug, title, tokens_reward FROM courses WHERE id = ?', courseId)
  const e = q.get<any>('SELECT completed_at FROM enrollments WHERE user_id = ? AND course_id = ?', userId, courseId)
  if (!c || !e || e.completed_at) return false
  const left = q.get<{ n: number }>(
    `SELECT
       (SELECT COUNT(*) FROM lessons l WHERE l.course_id = ? AND l.id NOT IN (SELECT lesson_id FROM lesson_progress WHERE user_id = ?)) +
       (SELECT COUNT(*) FROM tasks t WHERE t.course_id = ? AND t.id NOT IN (SELECT task_id FROM submissions WHERE user_id = ? AND status = 'approved')) AS n`,
    courseId, userId, courseId, userId,
  )!.n
  if (left > 0) return false
  q.run("UPDATE enrollments SET completed_at = datetime('now') WHERE user_id = ? AND course_id = ?", userId, courseId)
  logActivity(userId, 'course', `Курс «${c.title}» завершён`, `/courses/${c.slug}`)
  award(userId, c.tokens_reward, 'course', `Курс «${c.title}» пройден`, { ref: `course:${c.id}`, link: `/courses/${c.slug}` })
  evaluateAchievements(userId)
  return true
}

export const lessons = Router()
lessons.use(requireAuth)

lessons.get('/:id', (req, res) => {
  const id = idParam(req.params.id)
  const l = q.get<any>('SELECT * FROM lessons WHERE id = ?', id)
  if (!l) throw new HttpError(404, 'Урок не найден')
  const c = q.get<any>('SELECT id, slug, title, direction, mentor_id FROM courses WHERE id = ?', l.course_id)
  const enrolled = q.get('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?', req.user!.id, c.id)
  if (!enrolled && !isStaff(req.user)) throw new HttpError(403, 'Запишитесь на курс, чтобы открыть уроки', 'not_enrolled')
  const siblings = q.all<any>('SELECT id, title FROM lessons WHERE course_id = ? ORDER BY position, id', c.id)
  const idx = siblings.findIndex((s) => s.id === id)
  const tasks = q.all<any>('SELECT * FROM tasks WHERE lesson_id = ? ORDER BY position, id', id).map(publicTask)
  const subs = q.all<any>('SELECT task_id, status, feedback, score, answer FROM submissions WHERE user_id = ? AND task_id IN (SELECT id FROM tasks WHERE lesson_id = ?)', req.user!.id, id)
  const done = !!q.get('SELECT 1 FROM lesson_progress WHERE user_id = ? AND lesson_id = ?', req.user!.id, id)
  res.json({
    ...l, done, course: c,
    index: idx, total: siblings.length,
    prev: siblings[idx - 1] ?? null, next: siblings[idx + 1] ?? null,
    tasks: tasks.map((t) => ({ ...t, submission: subs.find((s) => s.task_id === t.id) ?? null })),
  })
})

lessons.post('/:id/complete', (req, res) => {
  const id = idParam(req.params.id)
  const l = q.get<any>('SELECT l.id, l.title, l.course_id FROM lessons l WHERE l.id = ?', id)
  if (!l) throw new HttpError(404, 'Урок не найден')
  if (!q.get('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?', req.user!.id, l.course_id)) {
    throw new HttpError(403, 'Сначала запишитесь на курс')
  }
  const completed = tx(() => {
    const r = q.run('INSERT OR IGNORE INTO lesson_progress (user_id, lesson_id) VALUES (?, ?)', req.user!.id, id)
    if (r.changes) logActivity(req.user!.id, 'lesson', `Пройден урок «${l.title}»`)
    evaluateAchievements(req.user!.id)
    return checkCourseCompletion(req.user!.id, l.course_id)
  })
  res.json({ ok: true, courseCompleted: completed })
})

export const tasks = Router()
tasks.use(requireAuth)

tasks.post('/:id/submit', (req, res) => {
  const id = idParam(req.params.id)
  const t = q.get<any>('SELECT t.*, c.title AS course_title, c.slug, c.mentor_id FROM tasks t JOIN courses c ON c.id = t.course_id WHERE t.id = ?', id)
  if (!t) throw new HttpError(404, 'Задание не найдено')
  const uid = req.user!.id
  if (!q.get('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?', uid, t.course_id)) throw new HttpError(403, 'Сначала запишитесь на курс')
  const prev = q.get<any>('SELECT status FROM submissions WHERE task_id = ? AND user_id = ?', id, uid)
  if (prev?.status === 'approved') throw new HttpError(409, 'Это задание уже зачтено')

  let result: { status: string; score?: number; total?: number; courseCompleted?: boolean }

  if (t.kind === 'quiz') {
    const d = parse(z.object({ answers: z.array(z.number().int()) }), req.body)
    const quiz = safeJson<Quiz>(t.quiz, [])
    if (d.answers.length !== quiz.length) throw new HttpError(400, 'Ответьте на все вопросы теста')
    const score = quiz.reduce((s, item, i) => s + Number(item.answer === d.answers[i]), 0)
    const passed = score === quiz.length
    const status = passed ? 'approved' : 'revision'
    const feedback = passed ? 'Все ответы верные!' : `Верно ${score} из ${quiz.length}. Перечитай урок и попробуй ещё раз.`
    q.run(
      `INSERT INTO submissions (task_id, user_id, answer, score, status, feedback, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(task_id, user_id) DO UPDATE SET answer = excluded.answer, score = excluded.score, status = excluded.status,
         feedback = excluded.feedback, reviewed_at = excluded.reviewed_at, created_at = datetime('now')`,
      id, uid, JSON.stringify(d.answers), score, status, feedback,
    )
    result = { status, score, total: quiz.length }
    if (passed) {
      award(uid, t.tokens_reward, 'task', `Тест «${t.title}» пройден`, { ref: `task:${id}`, link: `/courses/${t.slug}` })
      result.courseCompleted = checkCourseCompletion(uid, t.course_id)
    }
  } else {
    const d = parse(z.object({ answer: text(20, 4000, 'Ответ') }), req.body)
    assertNoContacts(d.answer)
    q.run(
      `INSERT INTO submissions (task_id, user_id, answer, status) VALUES (?, ?, ?, 'pending')
       ON CONFLICT(task_id, user_id) DO UPDATE SET answer = excluded.answer, status = 'pending', feedback = '', created_at = datetime('now')`,
      id, uid, d.answer,
    )
    logActivity(uid, 'task', `Отправлено на проверку: «${t.title}»`, `/courses/${t.slug}`)
    if (t.mentor_id) notify(t.mentor_id, `Новый ответ на задание «${t.title}»`, '/mentor?tab=review')
    result = { status: 'pending' }
  }
  res.json(result)
})

// ───────── Студия: наставники и администраторы управляют курсами ─────────
export const studio = Router()
studio.use(requireRole('mentor', 'admin'))

function ownCourse(req: any, courseId: number) {
  const c = q.get<any>('SELECT * FROM courses WHERE id = ?', courseId)
  if (!c) throw new HttpError(404, 'Курс не найден')
  if (req.user.role !== 'admin' && c.mentor_id !== req.user.id) throw new HttpError(403, 'Это курс другого наставника')
  return c
}

const courseSchema = z.object({
  title: text(4, 90, 'Название'),
  direction: z.enum(DIRECTION_KEYS as [string, ...string[]]),
  short: text(10, 160, 'Короткое описание'),
  description: text(20, 3000, 'Описание'),
  outcomes: z.array(z.string().trim().min(2).max(140)).max(8).default([]),
  level: z.enum(['start', 'middle', 'advanced']).default('start'),
  duration_weeks: z.number().int().min(1).max(20).default(3),
  tokens_reward: z.number().int().min(0).max(100).default(30),
  published: z.boolean().default(false),
  mentor_id: z.number().int().optional(),
})

const slugify = (s: string) => {
  const map: Record<string, string> = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' }
  return s.toLowerCase().split('').map((ch) => map[ch] ?? ch).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'course'
}

studio.get('/courses', (req, res) => {
  const own = req.user!.role === 'admin' ? '' : 'WHERE c.mentor_id = ' + Number(req.user!.id)
  res.json(q.all(
    `SELECT c.id, c.slug, c.title, c.direction, c.published, c.tokens_reward, u.name AS mentor_name,
       (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) AS lessons_total,
       (SELECT COUNT(*) FROM tasks WHERE course_id = c.id) AS tasks_total,
       (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) AS learners,
       (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id AND completed_at IS NOT NULL) AS finished
     FROM courses c LEFT JOIN users u ON u.id = c.mentor_id ${own} ORDER BY c.id DESC`,
  ))
})

studio.get('/courses/:id', (req, res) => {
  const c = ownCourse(req, idParam(req.params.id))
  res.json({
    ...c, published: !!c.published, outcomes: safeJson(c.outcomes, []),
    lessons: q.all('SELECT * FROM lessons WHERE course_id = ? ORDER BY position, id', c.id),
    tasks: q.all<any>('SELECT * FROM tasks WHERE course_id = ? ORDER BY position, id', c.id).map((t) => ({ ...t, quiz: safeJson(t.quiz, null) })),
    mentors: req.user!.role === 'admin' ? q.all("SELECT id, name FROM users WHERE role IN ('mentor','admin') AND status = 'active'") : [],
  })
})

studio.post('/courses', (req, res) => {
  const d = parse(courseSchema, req.body)
  const mentorId = req.user!.role === 'admin' && d.mentor_id ? d.mentor_id : req.user!.id
  let slug = slugify(d.title)
  while (q.get('SELECT 1 FROM courses WHERE slug = ?', slug)) slug += '-' + Math.floor(Math.random() * 90 + 10)
  const r = q.run(
    `INSERT INTO courses (slug, title, direction, short, description, outcomes, level, duration_weeks, tokens_reward, published, mentor_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    slug, d.title, d.direction, d.short, d.description, JSON.stringify(d.outcomes), d.level, d.duration_weeks, d.tokens_reward, Number(d.published), mentorId,
  )
  res.status(201).json({ id: Number(r.lastInsertRowid), slug })
})

studio.put('/courses/:id', (req, res) => {
  const c = ownCourse(req, idParam(req.params.id))
  const d = parse(courseSchema, req.body)
  const mentorId = req.user!.role === 'admin' && d.mentor_id ? d.mentor_id : c.mentor_id
  q.run(
    `UPDATE courses SET title=?, direction=?, short=?, description=?, outcomes=?, level=?, duration_weeks=?, tokens_reward=?, published=?, mentor_id=? WHERE id = ?`,
    d.title, d.direction, d.short, d.description, JSON.stringify(d.outcomes), d.level, d.duration_weeks, d.tokens_reward, Number(d.published), mentorId, c.id,
  )
  res.json({ ok: true })
})

studio.delete('/courses/:id', requireRole('admin'), (req, res) => {
  const c = ownCourse(req, idParam(req.params.id))
  q.run('DELETE FROM courses WHERE id = ?', c.id)
  res.json({ ok: true })
})

const lessonSchema = z.object({
  title: text(3, 120, 'Название урока'),
  body: text(20, 20000, 'Текст урока'),
  duration_min: z.number().int().min(1).max(240).default(10),
  position: z.number().int().min(0).default(0),
})

studio.post('/courses/:id/lessons', (req, res) => {
  const c = ownCourse(req, idParam(req.params.id))
  const d = parse(lessonSchema, req.body)
  const pos = d.position || (q.get<{ m: number }>('SELECT COALESCE(MAX(position),0)+1 m FROM lessons WHERE course_id = ?', c.id)!.m)
  const r = q.run('INSERT INTO lessons (course_id, title, body, duration_min, position) VALUES (?, ?, ?, ?, ?)', c.id, d.title, d.body, d.duration_min, pos)
  res.status(201).json({ id: Number(r.lastInsertRowid) })
})

studio.put('/lessons/:id', (req, res) => {
  const l = q.get<any>('SELECT * FROM lessons WHERE id = ?', idParam(req.params.id))
  if (!l) throw new HttpError(404, 'Урок не найден')
  ownCourse(req, l.course_id)
  const d = parse(lessonSchema, req.body)
  q.run('UPDATE lessons SET title=?, body=?, duration_min=?, position=? WHERE id = ?', d.title, d.body, d.duration_min, d.position || l.position, l.id)
  res.json({ ok: true })
})

studio.delete('/lessons/:id', (req, res) => {
  const l = q.get<any>('SELECT * FROM lessons WHERE id = ?', idParam(req.params.id))
  if (!l) throw new HttpError(404, 'Урок не найден')
  ownCourse(req, l.course_id)
  q.run('DELETE FROM lessons WHERE id = ?', l.id)
  res.json({ ok: true })
})

const taskSchema = z.object({
  title: text(3, 120, 'Название задания'),
  prompt: text(10, 4000, 'Формулировка'),
  kind: z.enum(['text', 'quiz']),
  lesson_id: z.number().int().nullable().default(null),
  tokens_reward: z.number().int().min(0).max(50).default(10),
  quiz: z.array(z.object({
    q: text(3, 300, 'Вопрос'),
    options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
    answer: z.number().int().min(0),
  })).nullable().default(null),
}).refine((t) => t.kind === 'text' || (t.quiz && t.quiz.length > 0 && t.quiz.every((x) => x.answer < x.options.length)), {
  message: 'В тесте нужен хотя бы один вопрос с отмеченным верным ответом',
})

studio.post('/courses/:id/tasks', (req, res) => {
  const c = ownCourse(req, idParam(req.params.id))
  const d = parse(taskSchema, req.body)
  const pos = q.get<{ m: number }>('SELECT COALESCE(MAX(position),0)+1 m FROM tasks WHERE course_id = ?', c.id)!.m
  const r = q.run(
    'INSERT INTO tasks (course_id, lesson_id, title, prompt, kind, quiz, tokens_reward, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    c.id, d.lesson_id, d.title, d.prompt, d.kind, d.quiz ? JSON.stringify(d.quiz) : null, d.tokens_reward, pos,
  )
  res.status(201).json({ id: Number(r.lastInsertRowid) })
})

studio.put('/tasks/:id', (req, res) => {
  const t = q.get<any>('SELECT * FROM tasks WHERE id = ?', idParam(req.params.id))
  if (!t) throw new HttpError(404, 'Задание не найдено')
  ownCourse(req, t.course_id)
  const d = parse(taskSchema, req.body)
  q.run(
    'UPDATE tasks SET lesson_id=?, title=?, prompt=?, kind=?, quiz=?, tokens_reward=? WHERE id = ?',
    d.lesson_id, d.title, d.prompt, d.kind, d.quiz ? JSON.stringify(d.quiz) : null, d.tokens_reward, t.id,
  )
  res.json({ ok: true })
})

studio.delete('/tasks/:id', (req, res) => {
  const t = q.get<any>('SELECT * FROM tasks WHERE id = ?', idParam(req.params.id))
  if (!t) throw new HttpError(404, 'Задание не найдено')
  ownCourse(req, t.course_id)
  q.run('DELETE FROM tasks WHERE id = ?', t.id)
  res.json({ ok: true })
})

// Проверка ответов на задания
studio.get('/submissions', (req, res) => {
  const status = (req.query.status as string) || 'pending'
  const own = req.user!.role === 'admin' ? '' : 'AND c.mentor_id = ' + Number(req.user!.id)
  res.json(q.all(
    `SELECT s.id, s.answer, s.status, s.feedback, s.created_at, s.reviewed_at,
       t.title AS task_title, t.prompt, t.tokens_reward, c.title AS course_title, c.slug,
       u.id AS user_id, u.name AS user_name, u.avatar, u.avatar_emoji
     FROM submissions s JOIN tasks t ON t.id = s.task_id JOIN courses c ON c.id = t.course_id JOIN users u ON u.id = s.user_id
     WHERE t.kind = 'text' AND s.status = ? ${own} ORDER BY s.created_at ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT 100`,
    status,
  ))
})

studio.post('/submissions/:id/review', (req, res) => {
  const d = parse(z.object({ status: z.enum(['approved', 'revision']), feedback: z.string().trim().max(1500).default('') }), req.body)
  const s = q.get<any>(
    'SELECT s.*, t.title, t.tokens_reward, t.course_id, c.slug, c.mentor_id FROM submissions s JOIN tasks t ON t.id = s.task_id JOIN courses c ON c.id = t.course_id WHERE s.id = ?',
    idParam(req.params.id),
  )
  if (!s) throw new HttpError(404, 'Ответ не найден')
  if (req.user!.role !== 'admin' && s.mentor_id !== req.user!.id) throw new HttpError(403, 'Это задание другого наставника')
  if (d.status === 'revision' && d.feedback.length < 5) throw new HttpError(400, 'Напишите, что доработать — участнику важно понять, куда двигаться')
  let courseCompleted = false
  tx(() => {
    q.run("UPDATE submissions SET status = ?, feedback = ?, reviewer_id = ?, reviewed_at = datetime('now') WHERE id = ?", d.status, d.feedback, req.user!.id, s.id)
    if (d.status === 'approved') {
      award(s.user_id, s.tokens_reward, 'task', `Задание «${s.title}» зачтено`, { ref: `task:${s.task_id}`, by: req.user!.id, link: `/courses/${s.slug}` })
      courseCompleted = checkCourseCompletion(s.user_id, s.course_id)
    } else {
      notify(s.user_id, `Наставник вернул задание «${s.title}» на доработку`, `/courses/${s.slug}`)
    }
  })
  res.json({ ok: true, courseCompleted })
})
