import { db, q, tx } from './db.js'
import { hashPassword } from './lib/auth.js'
import { award, evaluateAchievements, grantAchievement, logActivity } from './lib/progress.js'
import { COURSES, EVENTS, CHANNELS, type SeedEvent } from './seed-content.js'

export const DEMO_PASSWORD = 'future2027'

/** Пользователи. Первые три — демо-входы для презентации. */
const USERS = [
  { email: 'admin@demo.ru', name: 'Ирина Волкова', role: 'admin', city: 'Новосибирск', avatar: 'violet', emoji: '🧭',
    headline: 'Руководитель проекта «Путь в будущее»', bio: 'Отвечаю за то, чтобы платформа и встречи были безопасными и полезными.', interests: ['socialdesign', 'mentoring'] },
  { email: 'mentor@demo.ru', name: 'Дарья Соколова', role: 'mentor', city: 'Новосибирск', avatar: 'pink', emoji: '🫶',
    headline: 'Психолог проекта, 8 лет работаю с подростками', bio: 'Веду курсы про эмоции и безопасное общение. Можно писать с любым вопросом — даже если кажется, что он «глупый».', interests: ['psychology', 'antibullying'] },
  { email: 'participant@demo.ru', name: 'Полина Карпова', role: 'participant', city: 'Новосибирск', avatar: 'lilac', emoji: '🌈', school: '9 класс',
    headline: '', bio: 'Пишу тексты, люблю фотографировать город и разговаривать с людьми. Хочу понять, медиа — это моё или нет.', interests: ['psychology', 'media', 'socialdesign'] },

  { email: 'nikita@demo.ru', name: 'Никита Орлов', role: 'mentor', city: 'Новосибирск', avatar: 'amber', emoji: '🧩',
    headline: 'Социальный проектировщик, автор трёх молодёжных грантовых проектов', bio: 'Помогаю превращать идеи в проекты с целью, командой и планом.', interests: ['socialdesign', 'leadership'] },
  { email: 'maria@demo.ru', name: 'Мария Гончарова', role: 'mentor', city: 'Новосибирск', avatar: 'sky', emoji: '🎙️',
    headline: 'Журналист, редактор молодёжного медиа', bio: 'Учу находить истории вокруг и рассказывать их честно и бережно.', interests: ['media'] },
  { email: 'elena@demo.ru', name: 'Елена Кравец', role: 'mentor', city: 'Бердск', avatar: 'coral', emoji: '🛤️',
    headline: 'Профориентолог, педагог-психолог', bio: 'Помогаю разобраться, чего хочется, и попробовать профессии до выбора.', interests: ['career', 'psychology'] },
  { email: 'artem@demo.ru', name: 'Артём Белов', role: 'mentor', city: 'Новосибирск', avatar: 'mint', emoji: '🏕️',
    headline: 'Старший вожатый, 6 летних смен в детских лагерях', bio: 'Учу работать с детьми так, чтобы им было безопасно и интересно.', interests: ['mentoring', 'leadership'] },

  { email: 'timur@demo.ru', name: 'Тимур Ахмедов', city: 'Бердск', avatar: 'sky', emoji: '🎧', interests: ['leadership', 'socialdesign'], bio: 'Капитан школьной команды КВН. Хочу сделать свой проект для района.' },
  { email: 'sonya@demo.ru', name: 'Соня Миронова', city: 'Новосибирск', avatar: 'pink', emoji: '🦊', interests: ['mentoring', 'psychology'], bio: 'Мечтаю стать вожатой в «Артеке».' },
  { email: 'gleb@demo.ru', name: 'Глеб Зайцев', city: 'Искитим', avatar: 'amber', emoji: '🔥', interests: ['career', 'media'], bio: 'Монтирую видео, думаю про IT.' },
  { email: 'varya@demo.ru', name: 'Варвара Ильина', city: 'Обь', avatar: 'mint', emoji: '🍀', interests: ['antibullying', 'psychology'], bio: 'Хочу, чтобы в моей школе никого не травили.' },
  { email: 'arina@demo.ru', name: 'Арина Морозова', city: 'Новосибирск', avatar: 'violet', emoji: '🪐', interests: ['socialdesign', 'leadership', 'mentoring'], bio: 'Волонтёр, организую субботники во дворе.' },
  { email: 'kirill@demo.ru', name: 'Кирилл Лаптев', city: 'Колывань', avatar: 'coral', emoji: '🐳', interests: ['career', 'leadership'], bio: '' },
  { email: 'eva@demo.ru', name: 'Ева Шевченко', city: 'Бердск', avatar: 'lilac', emoji: '🌟', interests: ['media', 'psychology'], bio: 'Веду блог о книгах.' },
  { email: 'daniil@demo.ru', name: 'Даниил Руденко', city: 'Куйбышев', avatar: 'sky', emoji: '🚀', interests: ['career', 'socialdesign'], bio: 'Интересуюсь железной дорогой и логистикой.' },
  { email: 'liza@demo.ru', name: 'Лиза Ким', city: 'Новосибирск', avatar: 'pink', emoji: '🐼', interests: ['psychology', 'antibullying', 'media'], bio: 'Рисую комиксы.' },
  { email: 'egor@demo.ru', name: 'Егор Пахомов', city: 'Карасук', avatar: 'amber', emoji: '🎧', interests: ['leadership'], bio: '' },
  { email: 'alisa@demo.ru', name: 'Алиса Нестерова', city: 'Искитим', avatar: 'violet', emoji: '🌈', interests: ['mentoring', 'career'], bio: 'Помогаю младшим в художке.' },
  { email: 'yaroslav@demo.ru', name: 'Ярослав Фёдоров', city: 'Новосибирск', avatar: 'mint', emoji: '🔥', interests: ['media', 'socialdesign'], bio: '', show_in_rating: 0 },
  { email: 'milana@demo.ru', name: 'Милана Гусева', city: 'Татарск', avatar: 'coral', emoji: '🦊', interests: ['psychology', 'career'], bio: 'Только присоединилась!' },
] as const

/** Добавочное прошедшее мероприятие — фокус-группа на старте проекта */
const EXTRA_EVENTS: SeedEvent[] = [
  {
    title: 'Фокус-группа: какой должна быть платформа', kind: 'meeting', dayOffset: -30, start: '16:00', hours: 2,
    location: 'Подростковый центр проекта, Новосибирск', format: 'offline', capacity: 20, tokens_reward: 15,
    host: 'Ирина Волкова, команда проекта',
    description: 'Собираемся с подростками и вместе решаем, какие разделы, курсы и правила нужны платформе. Всё, что вы видите сейчас, во многом придумано на этой встрече.',
  },
]

/** Время по Новосибирску (UTC+7) → строка UTC для БД */
function nskToUtc(dayOffset: number, hhmm: string, plusHours = 0) {
  const [h, m] = hhmm.split(':').map(Number)
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, h - 7, m))
  d.setTime(d.getTime() + plusHours * 3600_000)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

/** Выполняет действия «в прошлом»: все записи, созданные внутри, получают дату daysAgo дней назад */
function at(daysAgo: number, fn: () => void) {
  const tables: [string, string][] = [
    ['activity', 'created_at'], ['token_tx', 'created_at'], ['notifications', 'created_at'],
    ['user_achievements', 'earned_at'], ['lesson_progress', 'completed_at'], ['enrollments', 'enrolled_at'],
    ['submissions', 'created_at'], ['event_registrations', 'created_at'], ['posts', 'created_at'],
    ['comments', 'created_at'], ['messages', 'created_at'],
  ]
  const before = Object.fromEntries(tables.map(([t]) => [t, q.get<{ m: number }>(`SELECT COALESCE(MAX(rowid),0) m FROM ${t}`)!.m]))
  fn()
  const minutes = Math.floor(Math.random() * 600)
  const stamp = `datetime('now', '-${daysAgo} days', '-${minutes} minutes')`
  for (const [t, col] of tables) q.run(`UPDATE ${t} SET ${col} = ${stamp} WHERE rowid > ?`, before[t])
  q.run(`UPDATE enrollments SET completed_at = ${stamp} WHERE completed_at IS NOT NULL AND rowid > ?`, before.enrollments)
  q.run(`UPDATE submissions SET reviewed_at = ${stamp} WHERE reviewed_at IS NOT NULL AND rowid > ?`, before.submissions)
}

export function seed() {
  tx(() => {
    // ── пользователи
    const ids: Record<string, number> = {}
    for (const u of USERS) {
      const r = q.run(
        `INSERT INTO users (name, email, password_hash, role, city, school, avatar, avatar_emoji, headline, bio, interests, show_in_rating, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'))`,
        u.name, u.email, hashPassword(DEMO_PASSWORD), (u as any).role ?? 'participant', u.city, (u as any).school ?? '',
        u.avatar, u.emoji, (u as any).headline ?? '', u.bio, JSON.stringify(u.interests), (u as any).show_in_rating ?? 1,
        (u as any).role === 'participant' || !(u as any).role ? 20 + Math.floor(Math.random() * 25) : 45,
      )
      ids[u.email] = Number(r.lastInsertRowid)
    }
    // Заявка наставника, ожидающая подтверждения — для демонстрации админки
    q.run(
      `INSERT INTO users (name, email, password_hash, role, status, city, avatar, avatar_emoji, headline, interests)
       VALUES ('Сергей Лукин', 'sergey@demo.ru', ?, 'mentor', 'pending', 'Новосибирск', 'sky', '🎯', 'Тренер по ораторскому мастерству', '["leadership","media"]')`,
      hashPassword(DEMO_PASSWORD),
    )
    const P = (email: string) => ids[email]

    // ── каналы
    CHANNELS.forEach((c, i) => q.run('INSERT INTO channels (slug, title, emoji, description, position) VALUES (?, ?, ?, ?, ?)', c.slug, c.title, c.emoji, c.description, i))
    const channel = (slug: string) => q.get<{ id: number }>('SELECT id FROM channels WHERE slug = ?', slug)!.id

    // ── курсы, уроки, задания
    const course: Record<string, { id: number; lessons: number[]; tasks: { id: number; kind: string; quiz?: any[]; lesson: number }[] }> = {}
    for (const c of COURSES) {
      const r = q.run(
        `INSERT INTO courses (slug, title, direction, short, description, outcomes, mentor_id, level, duration_weeks, tokens_reward, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-50 days'))`,
        c.slug, c.title, c.direction, c.short, c.description, JSON.stringify(c.outcomes), P(c.mentor), c.level, c.duration_weeks, c.tokens_reward,
      )
      const cid = Number(r.lastInsertRowid)
      const lessonIds = c.lessons.map((l, i) =>
        Number(q.run('INSERT INTO lessons (course_id, position, title, body, duration_min) VALUES (?, ?, ?, ?, ?)', cid, i + 1, l.title, l.body, l.duration_min).lastInsertRowid))
      const taskRows = c.tasks.map((t, i) => ({
        id: Number(q.run(
          'INSERT INTO tasks (course_id, lesson_id, position, title, prompt, kind, quiz, tokens_reward) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          cid, lessonIds[t.lesson - 1], i + 1, t.title, t.prompt, t.kind, t.quiz ? JSON.stringify(t.quiz) : null, t.tokens_reward,
        ).lastInsertRowid),
        kind: t.kind, quiz: t.quiz, lesson: t.lesson,
      }))
      course[c.slug] = { id: cid, lessons: lessonIds, tasks: taskRows }
    }

    // ── мероприятия
    const eventIds: number[] = []
    for (const e of [...EXTRA_EVENTS, ...EVENTS]) {
      const r = q.run(
        `INSERT INTO events (title, kind, description, starts_at, ends_at, location, format, capacity, tokens_reward, host, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        e.title, e.kind, e.description, nskToUtc(e.dayOffset, e.start), nskToUtc(e.dayOffset, e.start, e.hours),
        e.location, e.format, e.capacity, e.tokens_reward, e.host, P('admin@demo.ru'),
      )
      eventIds.push(Number(r.lastInsertRowid))
    }
    const ev = (title: string) => q.get<{ id: number; title: string; tokens_reward: number }>('SELECT id, title, tokens_reward FROM events WHERE title = ?', title)!
    const mentorId = P('mentor@demo.ru')

    // ── хелперы симуляции активности
    const enroll = (uid: number, slug: string) => {
      q.run('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)', uid, course[slug].id)
      logActivity(uid, 'enroll', `Запись на курс «${COURSES.find((c) => c.slug === slug)!.title}»`, `/courses/${slug}`)
    }
    const lesson = (uid: number, slug: string, n: number) => {
      q.run('INSERT OR IGNORE INTO lesson_progress (user_id, lesson_id) VALUES (?, ?)', uid, course[slug].lessons[n - 1])
      logActivity(uid, 'lesson', `Пройден урок «${COURSES.find((c) => c.slug === slug)!.lessons[n - 1].title}»`)
    }
    const passTask = (uid: number, slug: string, idx: number, answer?: string) => {
      const t = course[slug].tasks[idx]
      const meta = COURSES.find((c) => c.slug === slug)!.tasks[idx]
      const body = t.kind === 'quiz' ? JSON.stringify(t.quiz!.map((x: any) => x.answer)) : answer ?? 'Выполнено.'
      q.run(
        `INSERT OR REPLACE INTO submissions (task_id, user_id, answer, score, status, feedback, reviewer_id, reviewed_at)
         VALUES (?, ?, ?, ?, 'approved', ?, ?, datetime('now'))`,
        t.id, uid, body, t.kind === 'quiz' ? t.quiz!.length : null,
        t.kind === 'quiz' ? 'Все ответы верные!' : 'Отличная работа, видно, что ты подумал(а) над заданием.', mentorId,
      )
      award(uid, meta.tokens_reward, 'task', t.kind === 'quiz' ? `Тест «${meta.title}» пройден` : `Задание «${meta.title}» зачтено`, { ref: `task:${t.id}`, link: `/courses/${slug}` })
    }
    const pendingTask = (uid: number, slug: string, idx: number, answer: string) => {
      q.run("INSERT INTO submissions (task_id, user_id, answer, status) VALUES (?, ?, ?, 'pending')", course[slug].tasks[idx].id, uid, answer)
    }
    const complete = (uid: number, slug: string) => {
      const c = COURSES.find((x) => x.slug === slug)!
      enroll(uid, slug)
      c.lessons.forEach((_, i) => lesson(uid, slug, i + 1))
      c.tasks.forEach((_, i) => passTask(uid, slug, i))
      q.run("UPDATE enrollments SET completed_at = datetime('now') WHERE user_id = ? AND course_id = ?", uid, course[slug].id)
      logActivity(uid, 'course', `Курс «${c.title}» завершён`, `/courses/${slug}`)
      award(uid, c.tokens_reward, 'course', `Курс «${c.title}» пройден`, { ref: `course:${course[slug].id}`, link: `/courses/${slug}` })
    }
    const attend = (uid: number, title: string) => {
      const e = ev(title)
      q.run("INSERT OR REPLACE INTO event_registrations (event_id, user_id, status) VALUES (?, ?, 'attended')", e.id, uid)
      logActivity(uid, 'event', `Участие в «${e.title}»`, `/events/${e.id}`)
      award(uid, e.tokens_reward, 'event', `Участие: «${e.title}»`, { ref: `event:${e.id}`, by: P('admin@demo.ru'), link: `/events/${e.id}` })
    }
    const register = (uid: number, title: string) => {
      q.run('INSERT OR IGNORE INTO event_registrations (event_id, user_id) VALUES (?, ?)', ev(title).id, uid)
    }
    const team = (uid: number, amount: number, reason: string, by = 'nikita@demo.ru') => award(uid, amount, 'team', reason, { by: P(by) })

    const FOCUS = 'Фокус-группа: какой должна быть платформа'
    const KOMANDA = 'Командообразование без границ'
    const CONFLICT = 'Как разрулить конфликт: встреча с психологом'
    const MIC = 'Открытый микрофон «Моя история»'

    // Все участники получают базовые достижения
    for (const u of USERS) {
      if ((u as any).role) continue
      at(40, () => { grantAchievement(P(u.email), 'welcome'); grantAchievement(P(u.email), 'rules') })
    }
    for (const e of ['admin@demo.ru', 'mentor@demo.ru', 'nikita@demo.ru', 'maria@demo.ru', 'elena@demo.ru', 'artem@demo.ru']) grantAchievement(P(e), 'welcome')
    at(40, () => { grantAchievement(P('participant@demo.ru'), 'welcome'); grantAchievement(P('participant@demo.ru'), 'rules') })

    // ── Полина (демо-участник): ~145 жетонов, уровень «Первый перегон»
    const polina = P('participant@demo.ru')
    at(30, () => attend(polina, FOCUS))
    at(27, () => { enroll(polina, 'emocii'); lesson(polina, 'emocii', 1); lesson(polina, 'emocii', 2) })
    at(24, () => passTask(polina, 'emocii', 0))
    at(19, () => lesson(polina, 'emocii', 3))
    at(15, () => passTask(polina, 'emocii', 1, 'Самым сложным был второй день: поругалась с сестрой из-за ноутбука, назвала чувство «обида», а потом поняла, что это скорее усталость. Помогла техника 5-4-3-2-1 — смешно, но работает.'))
    at(15, () => {
      q.run("UPDATE enrollments SET completed_at = datetime('now') WHERE user_id = ? AND course_id = ?", polina, course.emocii.id)
      logActivity(polina, 'course', 'Курс «Эмоции под контролем» завершён', '/courses/emocii')
      award(polina, 35, 'course', 'Курс «Эмоции под контролем» пройден', { ref: `course:${course.emocii.id}`, link: '/courses/emocii' })
    })
    at(12, () => attend(polina, KOMANDA))
    at(12, () => team(polina, 10, 'Капитан команды на мастер-классе «Командообразование без границ»'))
    at(10, () => { enroll(polina, 'mediashkola'); lesson(polina, 'mediashkola', 1) })
    at(8, () => { passTask(polina, 'mediashkola', 0); lesson(polina, 'mediashkola', 2) })
    at(5, () => attend(polina, MIC))
    at(3, () => { enroll(polina, 'stop-travlya'); lesson(polina, 'stop-travlya', 1); lesson(polina, 'stop-travlya', 2) })
    at(1, () => pendingTask(polina, 'stop-travlya', 1, 'Привет! Видела, что происходит в общем чате, и хочу сказать: это не нормально, и ты в этом не виноват. Мне правда жаль, что тебе приходится это читать. Если хочешь, можем завтра вместе подойти к классной руководительнице — я расскажу, что видела. И давай на перемене посидим вместе? Я на твоей стороне.'))
    register(polina, 'Профессия — вожатый: встреча с Лигой вожатых')
    register(polina, 'Медиацех: снимаем историю на телефон')

    // ── Остальные участники — разный уровень активности
    const plan: [string, () => void][] = [
      ['arina@demo.ru', () => {
        const u = P('arina@demo.ru')
        at(30, () => attend(u, FOCUS)); at(28, () => complete(u, 'socproekt')); at(20, () => attend(u, CONFLICT))
        at(18, () => complete(u, 'komanda')); at(12, () => attend(u, KOMANDA)); at(12, () => team(u, 15, 'Помогла организовать игры на мастер-классе'))
        at(9, () => complete(u, 'vozhatyi')); at(5, () => attend(u, MIC)); at(4, () => team(u, 10, 'Провела игру для младшей группы', 'artem@demo.ru'))
        register(u, 'Профессия — вожатый: встреча с Лигой вожатых'); register(u, 'Экскурсия: Бердск и Искитим')
      }],
      ['timur@demo.ru', () => {
        const u = P('timur@demo.ru')
        at(29, () => attend(u, FOCUS)); at(26, () => complete(u, 'komanda')); at(16, () => complete(u, 'socproekt'))
        at(12, () => attend(u, KOMANDA)); at(12, () => team(u, 15, 'Лучший капитан мастер-класса')); at(5, () => attend(u, MIC))
        at(6, () => { enroll(u, 'emocii'); lesson(u, 'emocii', 1); lesson(u, 'emocii', 2); lesson(u, 'emocii', 3); passTask(u, 'emocii', 0) })
        at(0, () => pendingTask(u, 'emocii', 1, 'День 1 — злость, когда учитель при всех сказал, что я опять не готов. Сжал кулаки, ушёл в коридор, подышал «квадратом». День 2 — радость, выиграли в футбол. День 3 — тревога перед контрольной, ком в горле. Самым сложным был первый день, но пауза помогла не нагрубить.'))
        register(u, 'Экскурсия: Бердск и Искитим'); register(u, 'Игры на командообразование с наставниками')
      }],
      ['sonya@demo.ru', () => {
        const u = P('sonya@demo.ru')
        at(25, () => complete(u, 'vozhatyi')); at(20, () => attend(u, CONFLICT)); at(14, () => complete(u, 'emocii'))
        at(12, () => attend(u, KOMANDA)); at(5, () => attend(u, MIC))
        register(u, 'Профессия — вожатый: встреча с Лигой вожатых')
      }],
      ['varya@demo.ru', () => {
        const u = P('varya@demo.ru')
        at(22, () => complete(u, 'stop-travlya')); at(20, () => attend(u, CONFLICT)); at(5, () => attend(u, MIC))
        at(4, () => { enroll(u, 'emocii'); lesson(u, 'emocii', 1) })
        register(u, 'Свидетель — не зритель: лекция о травле')
      }],
      ['gleb@demo.ru', () => {
        const u = P('gleb@demo.ru')
        at(21, () => complete(u, 'mediashkola')); at(12, () => attend(u, KOMANDA))
        at(7, () => { enroll(u, 'kem-byt'); lesson(u, 'kem-byt', 1); lesson(u, 'kem-byt', 2); passTask(u, 'kem-byt', 0) })
        register(u, 'Медиацех: снимаем историю на телефон'); register(u, 'Карта профессий Новосибирской области')
      }],
      ['eva@demo.ru', () => {
        const u = P('eva@demo.ru')
        at(18, () => complete(u, 'mediashkola')); at(5, () => attend(u, MIC))
        at(3, () => { enroll(u, 'emocii'); lesson(u, 'emocii', 1) })
        register(u, 'Медиацех: снимаем историю на телефон')
      }],
      ['daniil@demo.ru', () => {
        const u = P('daniil@demo.ru')
        at(17, () => complete(u, 'kem-byt')); at(12, () => attend(u, KOMANDA))
        register(u, 'Карта профессий Новосибирской области'); register(u, 'Экскурсия: Колывань — город с историей')
      }],
      ['liza@demo.ru', () => {
        const u = P('liza@demo.ru')
        at(16, () => { enroll(u, 'stop-travlya'); lesson(u, 'stop-travlya', 1); passTask(u, 'stop-travlya', 0); lesson(u, 'stop-travlya', 2) })
        at(1, () => pendingTask(u, 'stop-travlya', 1, 'Слушай, я видела сообщения в чате. Мне правда неприятно, что так с тобой поступают, и я с ними не согласна. Ты не один. Если хочешь, давай поговорим после уроков или я схожу с тобой к психологу — мне тоже будет спокойнее вдвоём.'))
        at(5, () => attend(u, MIC))
      }],
      ['alisa@demo.ru', () => {
        const u = P('alisa@demo.ru')
        at(14, () => { enroll(u, 'vozhatyi'); lesson(u, 'vozhatyi', 1); lesson(u, 'vozhatyi', 2) })
        at(12, () => attend(u, KOMANDA))
        register(u, 'Профессия — вожатый: встреча с Лигой вожатых')
      }],
      ['kirill@demo.ru', () => {
        const u = P('kirill@demo.ru')
        at(11, () => { enroll(u, 'kem-byt'); lesson(u, 'kem-byt', 1) }); at(12, () => attend(u, KOMANDA))
      }],
      ['yaroslav@demo.ru', () => {
        const u = P('yaroslav@demo.ru')
        at(13, () => complete(u, 'socproekt')); at(5, () => attend(u, MIC))
      }],
      ['egor@demo.ru', () => {
        const u = P('egor@demo.ru')
        at(9, () => { enroll(u, 'komanda'); lesson(u, 'komanda', 1); lesson(u, 'komanda', 2); passTask(u, 'komanda', 0) })
      }],
      ['milana@demo.ru', () => {
        const u = P('milana@demo.ru')
        at(1, () => { enroll(u, 'emocii') })
        register(u, 'Карта профессий Новосибирской области')
      }],
    ]
    for (const [, fn] of plan) fn()
    // Записались на прошедший микрофон, но посещение ещё не отмечено — для демонстрации отметки наставником
    for (const e of ['kirill@demo.ru', 'milana@demo.ru', 'alisa@demo.ru']) {
      at(6, () => q.run('INSERT OR IGNORE INTO event_registrations (event_id, user_id) VALUES (?, ?)', ev(MIC).id, P(e)))
    }

    // ── Сообщество
    const post = (daysAgo: number, slug: string, email: string, kind: string, title: string, body: string, status = 'published', pinned = 0, note = '') => {
      let id = 0
      at(daysAgo, () => {
        id = Number(q.run('INSERT INTO posts (channel_id, author_id, kind, title, body, status, pinned, moderation_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          channel(slug), P(email), kind, title, body, status, pinned, note).lastInsertRowid)
        if (status === 'published') logActivity(P(email), 'post', `Публикация «${title}»`, `/community/post/${id}`)
      })
      return id
    }
    const comment = (daysAgo: number, postId: number, email: string, body: string, status = 'published') =>
      at(daysAgo, () => { q.run('INSERT INTO comments (post_id, author_id, body, status) VALUES (?, ?, ?, ?)', postId, P(email), body, status) })
    const support = (postId: number, ...emails: string[]) => emails.forEach((e) => q.run('INSERT OR IGNORE INTO post_supports (post_id, user_id) VALUES (?, ?)', postId, P(e)))

    const rules = post(40, 'obshchiy-vagon', 'admin@demo.ru', 'discussion', 'Добро пожаловать в «Путь в будущее»! Правила вагона',
      `Привет! Это пространство, где можно говорить о важном и не бояться, что тебя высмеют.

Коротко о правилах:
- Уважаем друг друга: критикуем идеи, а не людей.
- Не публикуем контакты — телефоны, ники и ссылки на соцсети блокируются автоматически. Общайтесь в личных сообщениях платформы.
- Не пересказываем чужие истории без согласия.
- Видишь травлю — жми «Пожаловаться». Это не стукачество, это забота.

Полные правила — в разделе «Безопасность». Рады, что ты с нами!`, 'published', 1)
    support(rules, 'participant@demo.ru', 'timur@demo.ru', 'arina@demo.ru', 'sonya@demo.ru', 'varya@demo.ru')
    comment(39, rules, 'arina@demo.ru', 'Ура, наконец-то своя платформа! Спасибо, что сделали её вместе с нами на фокус-группе.')
    comment(38, rules, 'gleb@demo.ru', 'А можно будет предлагать свои курсы?')
    comment(38, rules, 'admin@demo.ru', 'Глеб, можно! Пиши идею в разделе «Идеи и проекты» — наставники помогут её упаковать.')

    const intro = post(25, 'obshchiy-vagon', 'timur@demo.ru', 'discussion', 'Кто из Бердска? Давайте знакомиться',
      'Я Тимур, 15 лет, капитан команды КВН в школе. Хочу собрать ребят из Бердска на открытый микрофон, который будет у нас в молодёжном центре. Кто тоже из Бердска — откликнитесь в комментариях!')
    comment(24, intro, 'eva@demo.ru', 'Я из Бердска! Веду блог о книгах, приду на микрофон 🙂')
    comment(23, intro, 'milana@demo.ru', 'Я из Татарска, но очень хочу на экскурсию в Бердск.')
    support(intro, 'eva@demo.ru', 'participant@demo.ru')

    const career = post(14, 'kem-stat', 'daniil@demo.ru', 'discussion', 'Кто думает про работу на железной дороге?',
      'Мне интересна логистика и всё, что связано с поездами. Прошёл курс «Кем быть» и понял, что хочу попробовать профпробу. Может, кто-то знает, где в Новосибирске есть дни открытых дверей в транспортных колледжах?')
    comment(13, career, 'elena@demo.ru', 'Даниил, отличный вопрос! Приходи на «Карту профессий Новосибирской области» — там будет отдельный блок про транспорт и логистику, расскажу про дни открытых дверей.')
    comment(12, career, 'gleb@demo.ru', 'Мне тоже интересно, но больше IT в транспорте — расписания, навигация.')
    support(career, 'gleb@demo.ru', 'kirill@demo.ru')

    const safe = post(11, 'pogovorim', 'varya@demo.ru', 'discussion', 'Как поддержать подругу, если её травят в чате класса',
      'В нашем классе есть общий чат, и там уже неделю пересылают фотку одной девочки с обидными подписями. Я не участвую, но и не знаю, что делать — боюсь, что начнут травить и меня. Что бы вы сделали?')
    comment(11, safe, 'mentor@demo.ru', 'Варя, спасибо, что не прошла мимо — это уже очень много. Три шага, которые безопасны для тебя: 1) напиши ей лично, что ты на её стороне; 2) пожалуйся на сообщения в самом мессенджере; 3) расскажи классному руководителю или школьному психологу — можно вместе с подругой. Если хочешь, напиши мне в личные сообщения, разберём ситуацию подробнее.')
    comment(10, safe, 'liza@demo.ru', 'У нас было похожее. Помогло, когда несколько человек написали в чат «это не смешно, хватит». Одной страшно, а вместе — нет.')
    comment(10, safe, 'participant@demo.ru', 'Поддерживаю Лизу. И ещё: не пересылать дальше — это реально важно.')
    support(safe, 'participant@demo.ru', 'liza@demo.ru', 'sonya@demo.ru', 'arina@demo.ru', 'timur@demo.ru', 'eva@demo.ru')

    const media = post(7, 'mediatseh', 'participant@demo.ru', 'discussion', 'Мой первый репортаж: открытый микрофон глазами слушателя',
      `Попробовала написать текст по курсу «Медиашкола» — без имён и без пересказа чужих историй, как нас учили.

Зал был полон, хотя никто никого не заставлял говорить. Первые десять минут все молчали, а потом одна девушка вышла и сказала: «Я никогда этого никому не рассказывала». И стало очень тихо. Я поняла, что это тот редкий случай, когда слушать — тоже участие.

Буду рада советам по тексту!`)
    comment(6, media, 'maria@demo.ru', 'Полина, очень бережно и точно. Сильный приём — начать с тишины. Совет: в первом абзаце добавь, где и когда это было, — читатель должен сразу понимать контекст.')
    comment(6, media, 'eva@demo.ru', 'Мурашки. Я тоже там была.')
    support(media, 'eva@demo.ru', 'varya@demo.ru', 'maria@demo.ru', 'sonya@demo.ru')

    const idea1 = post(9, 'idei', 'arina@demo.ru', 'idea', 'Книжный обмен в подростковом центре',
      'Предлагаю поставить в центре полку буккроссинга: приносишь книгу — берёшь другую. Раз в месяц устраивать встречу, где каждый рассказывает о прочитанной книге за 2 минуты. Нужны: полка, 2–3 ответственных и анонс на платформе. Могу взять организацию на себя.')
    at(8, () => award(P('arina@demo.ru'), 20, 'initiative', 'Идея «Книжный обмен в подростковом центре» одобрена', { ref: `idea:${idea1}`, by: P('nikita@demo.ru') }))
    comment(8, idea1, 'nikita@demo.ru', 'Арина, одобряю! Давай обсудим запуск на следующей неделе. Ищем ещё двух помощников — кто в деле?')
    comment(7, idea1, 'eva@demo.ru', 'Я в деле! Могу вести анонсы.')
    support(idea1, 'eva@demo.ru', 'participant@demo.ru', 'timur@demo.ru')

    const idea2 = post(6, 'idei', 'participant@demo.ru', 'idea', 'Подкаст «Голоса пути»',
      'Хочу записывать короткие (10–15 минут) разговоры с участниками и наставниками: как кто выбирал профессию, что помогло пережить сложный период. Только с согласия героев и без фамилий. Нужны: диктофон или телефон, тихая комната в центре, помощь с монтажом.')
    at(5, () => award(polina, 20, 'initiative', 'Идея «Подкаст „Голоса пути“» одобрена', { ref: `idea:${idea2}`, by: P('maria@demo.ru') }))
    comment(5, idea2, 'maria@demo.ru', 'Полина, это отличная идея для медиацеха. Помогу со сценарием первого выпуска!')
    comment(4, idea2, 'gleb@demo.ru', 'Могу монтировать!')
    support(idea2, 'gleb@demo.ru', 'maria@demo.ru', 'eva@demo.ru')

    const idea3 = post(2, 'idei', 'timur@demo.ru', 'idea', 'Турнир по настольным играм между городами',
      'Раз в месяц проводить турнир по настолкам между командами Бердска, Новосибирска и Искитима — онлайн и очно по очереди. Это поможет познакомиться ребятам из разных городов ещё до путешествия.',
      'pending', 0, 'Идеи публикуются после одобрения наставником')

    const ask = post(4, 'sprosi-nastavnika', 'sonya@demo.ru', 'question', 'Со скольки лет можно поехать помощником вожатого?',
      'Очень хочу попробовать себя вожатой уже следующим летом. Мне 15. Это реально?')
    comment(4, ask, 'artem@demo.ru', 'Соня, реально! Во многих лагерях берут помощников вожатых с 16 лет, а до этого можно пробовать себя на мероприятиях проекта. Приходи на встречу с Лигой вожатых — там расскажут про педотряды и стажировки.')
    support(ask, 'alisa@demo.ru', 'arina@demo.ru')

    const exam = post(3, 'sprosi-nastavnika', 'gleb@demo.ru', 'question', 'Как не сойти с ума перед экзаменами?',
      'ОГЭ ещё не скоро, но уже тревожно. Все вокруг говорят «готовься», а у меня ступор. Что делать?')
    comment(3, exam, 'mentor@demo.ru', 'Глеб, ступор — нормальная реакция на большую неопределённость. Попробуй разбить подготовку на маленькие шаги: не «готовиться к ОГЭ», а «решить 5 задач по теме X в среду». И обязательно оставляй время на отдых — без него голова работает хуже. В курсе «Эмоции под контролем» есть урок про технику заземления, она хорошо помогает при тревоге.')
    // Комментарий, отправленный автомодерацией на проверку
    comment(1, exam, 'egor@demo.ru', 'Да ты просто тупой, вот и ступор', 'pending')

    // Открытая жалоба и обращение за помощью — для демонстрации модерации
    at(1, () => {
      const cid = q.get<{ id: number }>('SELECT id FROM comments WHERE body LIKE ?', 'Да ты просто тупой%')!.id
      q.run("INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES (?, 'comment', ?, 'Оскорбления или травля', 'Это уже не первый раз, он пишет такое Глебу и в личку')", P('liza@demo.ru'), cid)
      q.run(`INSERT INTO help_requests (user_id, addressee, topic, body, anonymous)
             VALUES (?, 'psychologist', 'Не хочу идти в школу', 'Последний месяц каждое утро не хочется идти в школу, в классе со мной почти не разговаривают. Не знаю, кому рассказать.', 1)`, P('kirill@demo.ru'))
    })

    // ── Личные сообщения
    const dm = (daysAgo: number, from: string, to: string, body: string, read = true) =>
      at(daysAgo, () => { q.run(`INSERT INTO messages (sender_id, recipient_id, body, read_at) VALUES (?, ?, ?, ${read ? "datetime('now')" : 'NULL'})`, P(from), P(to), body) })
    dm(16, 'participant@demo.ru', 'mentor@demo.ru', 'Дарья, здравствуйте! Я прошла урок про саморегуляцию. Можно вопрос: что делать, если тревожно не в моменте, а постоянно фоном?')
    dm(16, 'mentor@demo.ru', 'participant@demo.ru', 'Здравствуй, Полина! Хороший вопрос. Фоновая тревога часто связана с тем, что много всего «висит» в голове. Попробуй вечером выписывать всё, что беспокоит, и рядом — что из этого зависит от тебя. И давай обсудим подробнее на встрече после открытого микрофона?')
    dm(15, 'participant@demo.ru', 'mentor@demo.ru', 'Спасибо! Да, давайте 🙂')
    dm(2, 'mentor@demo.ru', 'participant@demo.ru', 'Полина, видела твою идею подкаста — классная. Если захочешь записать выпуск про эмоции, я с радостью стану гостем.', false)
    dm(6, 'gleb@demo.ru', 'participant@demo.ru', 'Привет! Прочитал твой репортаж, круто. Давай вместе сделаем подкаст? Я могу монтировать.')
    dm(6, 'participant@demo.ru', 'gleb@demo.ru', 'Привет! Давай! Мария обещала помочь со сценарием. Встретимся на медиацехе?')
    dm(1, 'gleb@demo.ru', 'participant@demo.ru', 'Договорились, я записался 👍', false)

    // Достижения по фактическим данным
    for (const id of Object.values(ids)) evaluateAchievements(id)
    // Небольшие уведомления для демо-участника
    q.run("UPDATE notifications SET read_at = datetime('now') WHERE created_at < datetime('now', '-2 days')")
  })
  console.log(`Демо-данные созданы. Пароль для всех демо-аккаунтов: ${DEMO_PASSWORD}`)
}

export function wipe() {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS help_requests; DROP TABLE IF EXISTS reports; DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS post_supports; DROP TABLE IF EXISTS comments; DROP TABLE IF EXISTS posts; DROP TABLE IF EXISTS channels;
    DROP TABLE IF EXISTS notifications; DROP TABLE IF EXISTS activity; DROP TABLE IF EXISTS user_achievements; DROP TABLE IF EXISTS token_tx;
    DROP TABLE IF EXISTS event_registrations; DROP TABLE IF EXISTS events; DROP TABLE IF EXISTS submissions;
    DROP TABLE IF EXISTS lesson_progress; DROP TABLE IF EXISTS enrollments; DROP TABLE IF EXISTS tasks; DROP TABLE IF EXISTS lessons;
    DROP TABLE IF EXISTS courses; DROP TABLE IF EXISTS users;
    PRAGMA foreign_keys = ON;
  `)
}
