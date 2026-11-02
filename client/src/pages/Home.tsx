import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, CalendarDays, MessagesSquare, ShieldCheck, ChevronRight, Sparkles, Inbox, Gavel } from 'lucide-react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { fmtDate, plural, timeAgo, tokensWord, daysUntil } from '../lib/format'
import { Avatar, Button, ButtonLink, Empty, Modal, Progress, Spinner, TokenGlyph, cx, useToast } from '../components/ui'
import { CourseCard, EventTicket, dirOf } from '../components/shared'
import { Section } from '../components/Layout'
import { TRIP } from '../../../shared/constants'

export default function Home() {
  const { user } = useSession()
  const overview = useQuery({ queryKey: ['overview'], queryFn: () => api.get('/public/overview') })
  if (!user) return <Landing data={overview.data} />
  return user.role === 'participant' ? <ParticipantHome overview={overview.data} /> : <StaffHome overview={overview.data} />
}

// ═════════════════════ Гостевая главная ═════════════════════

const SURVEY = [
  { value: 70, text: 'сталкивались с буллингом' },
  { value: 66, text: 'не находят интересных площадок в своём городе' },
  { value: 60, text: 'доверяют только друзьям' },
  { value: 44, text: 'не чувствуют себя в безопасности' },
  { value: 40, text: 'не хватает мастер-классов и квестов' },
]

const TIMELINE = [
  { when: 'Сентябрь 2027', what: 'Собираем команду, определяем проект и ищем решения' },
  { when: 'Сентябрь — декабрь 2027', what: 'Фокус-группы с подростками, первые встречи о буллинге и профориентации' },
  { when: 'Октябрь — ноябрь 2027', what: 'Бета-версия платформы и первые участники. Рассказываем о проекте в СМИ региона' },
  { when: 'С ноября 2027', what: 'Открывается рейтинг: жетоны за курсы, задания, встречи и инициативу' },
  { when: 'Декабрь 2027', what: 'Запуск подросткового центра, работа с менторами, поиск генерального партнёра' },
  { when: 'Декабрь 2027 — май 2028', what: 'Курсы, лекции, мастер-классы, открытые микрофоны и экскурсии' },
  { when: '25 мая 2028', what: 'Рейтинг закрывается — определяем 60 участников путешествия' },
  { when: '3 — 10 июня 2028', what: 'Путешествие по Новосибирской области, мерч проекта и альбом воспоминаний' },
]

function Landing({ data }: { data: any }) {
  const stats = data?.stats
  return (
    <div className="pt-2">
      {/* Герой */}
      <section className="hero-surface rounded-[32px] px-6 py-10 sm:p-12 lg:p-14 relative overflow-hidden">
        <div className="relative grid lg:grid-cols-[1.15fr_1fr] gap-10 items-center">
          <div>
            <h1 className="font-display font-extrabold leading-[0.95] text-[clamp(2.75rem,8vw,5.5rem)] tracking-[-0.04em]">
              Путь в<br />будущее
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-white/85 max-w-lg leading-relaxed">
              Платформа для подростков Новосибирской области: курсы, наставники и встречи вживую. Активность приносит жетоны, а 60 самых активных отправятся в путешествие по региону.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/register" variant="gold" size="lg">Присоединиться</ButtonLink>
              <ButtonLink to="/login" variant="light" size="lg" className="!bg-white/10 !text-white hover:!bg-white/20">У меня есть аккаунт</ButtonLink>
            </div>
          </div>
          <HeroRoute />
        </div>
      </section>

      {/* Почему */}
      <section className="mt-16 grid lg:grid-cols-[0.9fr_1.1fr] gap-8 lg:gap-14 items-start">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold">Почему мы это делаем</h2>
          <p className="mt-4 text-lg text-ink-soft leading-relaxed">
            Мы спросили подростков региона, что мешает им общаться и развиваться. Ответы стали основой платформы: безопасное пространство, взрослые, которым можно доверять, и живые встречи рядом с домом.
          </p>
        </div>
        <ul className="grid gap-3">
          {SURVEY.map((s) => (
            <li key={s.text} className="card p-4 sm:p-5 flex items-center gap-4 sm:gap-6">
              <span className="font-display text-3xl sm:text-4xl font-bold text-violet w-20 sm:w-24 shrink-0 tabular-nums">{s.value}%</span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium">{s.text}</span>
                <span className="mt-2 block h-1.5 rounded-full bg-lavender"><span className="block h-full rounded-full bg-violet" style={{ width: `${s.value}%` }} /></span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Возможности */}
      <section className="mt-16">
        <h2 className="text-3xl sm:text-4xl font-bold max-w-2xl">Что есть на платформе</h2>
        <div className="mt-6 grid md:grid-cols-6 gap-4">
          <Feature className="md:col-span-4 violet-surface" icon={<GraduationCap />} title="Авторские курсы" light
            text="Семь направлений — от психологии и защиты от травли до медиа, профориентации и работы вожатым. Уроки, задания с проверкой наставника и тесты." />
          <Feature className="md:col-span-2" icon={<CalendarDays />} title="Встречи вживую"
            text="Мастер-классы, открытые микрофоны, встречи с психологами и экскурсии по области." />
          <Feature className="md:col-span-2" icon={<MessagesSquare />} title="Сообщество и наставники"
            text="Обсуждения по темам, личные сообщения, вопросы наставникам, свои идеи и проекты." />
          <Feature className="md:col-span-2" icon={<ShieldCheck />} title="Безопасное пространство"
            text="Модерация, жалобы в один клик, запрет на публикацию контактов, анонимные обращения к психологу." />
          <Feature className="md:col-span-2 bg-gold/30" icon={<TokenGlyph size={24} />} title="Жетоны и путешествие"
            text="Жетоны — за учёбу, встречи, командную работу и инициативу. Рейтинг считает активность, а не популярность." />
        </div>
      </section>

      {/* Мероприятия */}
      {data?.events?.length > 0 && (
        <Section title="Ближайшие мероприятия" action={<Link to="/events" className="text-violet font-semibold inline-flex items-center">Все<ChevronRight className="size-4" /></Link>}>
          <div className="grid gap-3 lg:grid-cols-3">{data.events.map((e: any) => <EventTicket key={e.id} e={e} compact />)}</div>
        </Section>
      )}

      {/* Курсы */}
      {data?.courses?.length > 0 && (
        <Section title="Популярные курсы" action={<Link to="/courses" className="text-violet font-semibold inline-flex items-center">Каталог<ChevronRight className="size-4" /></Link>}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{data.courses.map((c: any) => <CourseCard key={c.id} c={c} />)}</div>
        </Section>
      )}

      {/* Сообщество */}
      {stats && (
        <Section title="Сообщество уже в пути">
          <div className="panel p-6 sm:p-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Stat n={stats.participants} label={plural(stats.participants, 'участник', 'участника', 'участников')} />
            <Stat n={stats.completions} label={plural(stats.completions, 'курс пройден', 'курса пройдено', 'курсов пройдено')} />
            <Stat n={stats.attendance} label="посещений встреч" />
            <Stat n={stats.tokens} label={`${tokensWord(stats.tokens)} заработано`} gold />
          </div>
        </Section>
      )}

      {/* Таймлайн */}
      <Section title="Как устроен проект">
        <ol className="relative grid gap-0 lg:grid-cols-2 lg:gap-x-12">
          {TIMELINE.map((t, i) => (
            <li key={t.when} className="relative flex gap-4 pb-6">
              <span className="flex flex-col items-center">
                <span className={cx('size-9 rounded-full grid place-items-center font-display font-bold text-sm shrink-0', i === TIMELINE.length - 1 ? 'bg-gold text-violet-deep' : 'bg-violet text-white')}>{i + 1}</span>
                {i < TIMELINE.length - 1 && <span className="w-[3px] flex-1 bg-lavender mt-1 lg:hidden" />}
              </span>
              <span className="pt-1">
                <span className="block text-sm font-semibold text-violet">{t.when}</span>
                <span className="block mt-0.5 font-medium">{t.what}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <section className="mt-12 panel p-8 sm:p-12 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold">Билет на твой путь — бесплатный</h2>
        <p className="mt-3 text-ink-soft max-w-xl mx-auto">Регистрация занимает минуту. Первые жетоны — за первый пройденный урок.</p>
        <div className="mt-6 flex justify-center gap-3 flex-wrap">
          <ButtonLink to="/register" size="lg">Присоединиться</ButtonLink>
          <ButtonLink to="/courses" variant="secondary" size="lg">Посмотреть курсы</ButtonLink>
        </div>
      </section>
    </div>
  )
}

function Feature({ icon, title, text, className, light }: { icon: React.ReactNode; title: string; text: string; className?: string; light?: boolean }) {
  return (
    <div className={cx('rounded-[24px] p-6 sm:p-7 bg-white shadow-[var(--shadow-soft)]', className)}>
      <span className={cx('size-11 rounded-2xl grid place-items-center [&>svg]:size-6', light ? 'bg-white/15' : 'bg-lavender text-violet')}>{icon}</span>
      <h3 className="mt-4 text-xl font-bold">{title}</h3>
      <p className={cx('mt-2 leading-relaxed', light ? 'text-white/85 text-lg max-w-xl' : 'text-ink-soft')}>{text}</p>
    </div>
  )
}

function Stat({ n, label, gold }: { n: number; label: string; gold?: boolean }) {
  return (
    <div>
      <p className="font-display text-3xl sm:text-4xl font-bold tabular-nums flex items-center gap-2">{gold && <TokenGlyph size={28} />}{n.toLocaleString('ru-RU')}</p>
      <p className="mt-1 text-ink-soft">{label}</p>
    </div>
  )
}

/** Маршрут в герое: линия прорисовывается один раз при загрузке */
function HeroRoute() {
  const stops = [
    { x: 40, y: 250, t: 'Курсы', s: 'уроки и задания' },
    { x: 165, y: 190, t: 'Встречи', s: 'с наставниками' },
    { x: 290, y: 150, t: 'Жетоны', s: 'за активность' },
    { x: 390, y: 50, t: 'Путешествие', s: '60 мест · июнь 2028', final: true },
  ]
  const d = 'M40 250 C 110 250, 110 190, 165 190 S 250 150, 290 150 S 370 110, 390 50'
  return (
    <div className="relative">
      <svg viewBox="0 0 440 300" className="w-full h-auto overflow-visible" role="img" aria-label="Маршрут участника: курсы, встречи, жетоны, путешествие">
        <path d={d} fill="none" stroke="rgb(255 255 255 / .18)" strokeWidth="14" strokeLinecap="round" />
        <path d={d} fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray="460" style={{ ['--len' as any]: 460, animation: 'route-draw 1.6s .2s cubic-bezier(.6,0,.2,1) both' }} />
        {stops.map((s, i) => {
          const lx = s.final ? s.x - 26 : s.x - 6
          const ly = s.final ? s.y + 4 : s.y + 34
          return (
            <g key={s.t} style={{ animation: `pop-in .35s ${0.4 + i * 0.35}s both` }}>
              <circle cx={s.x} cy={s.y} r={s.final ? 16 : 11} fill={s.final ? '#ffc93c' : '#fff'} />
              {!s.final && <circle cx={s.x} cy={s.y} r={5} fill="#5a1fe0" />}
              <text x={lx} y={ly} fill="white" fontFamily="Unbounded Variable" fontWeight="700" fontSize="15" textAnchor={s.final ? 'end' : 'start'}>{s.t}</text>
              <text x={lx} y={ly + 18} fill="rgb(255 255 255 / .72)" fontSize="12.5" textAnchor={s.final ? 'end' : 'start'}>{s.s}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ═════════════════════ Главная участника ═════════════════════

function ParticipantHome({ overview }: { overview: any }) {
  const { user } = useSession()
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/me/dashboard') })
  const [sp, setSp] = useSearchParams()
  const showRules = !!user && (!user.rulesAccepted || sp.get('welcome') === '1')
  if (dash.isLoading || !dash.data) return <Spinner />
  const d = dash.data
  const t = d.tokens
  const inProgress = d.courses.filter((c: any) => !c.completed_at)
  const toTrip = Math.max(0, TRIP.threshold - t.total)

  return (
    <div>
      {showRules && <RulesModal onDone={() => setSp({})} />}
      {/* Приветствие и прогресс */}
      <section className="hero-surface rounded-[28px] p-6 sm:p-8 lg:p-10 relative overflow-hidden">
        <div className="relative flex flex-col lg:flex-row lg:items-end gap-6 lg:gap-10">
          <div className="flex-1">
            <p className="text-white/75 font-medium">Станция «{t.level.title}»</p>
            <h1 className="mt-1 text-3xl sm:text-[2.6rem] font-bold leading-tight">Привет, {user!.name.split(' ')[0]}!</h1>
            <p className="mt-3 text-white/85 text-lg max-w-xl">
              {toTrip > 0
                ? <>До порога путешествия — {toTrip} {tokensWord(toTrip)}. Осталось {daysUntil(TRIP.ratingCloses)} дн. до закрытия рейтинга.</>
                : <>Порог путешествия пройден! Держи темп: в поездку едут 60 самых активных.</>}
            </p>
          </div>
          <Link to="/path" className="rounded-[22px] bg-white/12 hover:bg-white/18 transition p-5 lg:w-[340px] block">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-display text-3xl font-bold"><TokenGlyph size={30} />{t.total}</span>
              <span className="text-sm text-white/80">{t.rank} место из {t.participants}</span>
            </div>
            <div className="mt-4 h-2.5 rounded-full bg-white/20 overflow-hidden"><div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, (t.total / TRIP.threshold) * 100)}%` }} /></div>
            <p className="mt-2 text-sm text-white/80 flex justify-between"><span>Мой путь</span><span>{t.total} / {TRIP.threshold}</span></p>
          </Link>
        </div>
      </section>

      {/* Продолжить */}
      <Section title="Продолжить обучение" action={<Link to="/courses" className="text-violet font-semibold inline-flex items-center">Все курсы<ChevronRight className="size-4" /></Link>}>
        {inProgress.length === 0 ? (
          <Empty emoji="🎒" title="Ты пока не записан на курсы" text="Выбери направление — первый урок займёт 10 минут." action={<ButtonLink to="/courses">Выбрать курс</ButtonLink>} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {inProgress.map((c: any) => (
              <Link key={c.id} to={`/courses/${c.slug}`} className="card p-5 flex items-center gap-4 hover:shadow-[var(--shadow-lift)] transition-shadow">
                <span className="size-14 rounded-2xl bg-lavender grid place-items-center text-3xl shrink-0">{dirOf(c.direction).emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold truncate">{c.title}</span>
                  <Progress value={c.progress} className="mt-2" />
                  <span className="mt-1.5 block text-xs text-ink-soft">Уроки {c.lessons_done}/{c.lessons_total} · задания {c.tasks_done}/{c.tasks_total}</span>
                </span>
                <ChevronRight className="size-5 text-ink-soft shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </Section>

      <div className="grid lg:grid-cols-[1.25fr_1fr] gap-x-8">
        <Section title="Ближайшие события">
          {d.events.length ? (
            <div className="grid gap-3">{d.events.map((e: any) => <EventTicket key={e.id} e={{ ...e, my_status: e.status }} compact />)}</div>
          ) : (
            <div className="grid gap-3">
              {(overview?.events ?? []).slice(0, 2).map((e: any) => <EventTicket key={e.id} e={e} compact />)}
              <p className="text-sm text-ink-soft">Ты ещё не записан ни на одно событие. <Link to="/events" className="text-violet font-semibold">Выбрать в календаре</Link></p>
            </div>
          )}
        </Section>

        <Section title="Для тебя">
          <div className="grid gap-3">
            {d.recommendations.courses.map((c: any) => (
              <Link key={c.id} to={`/courses/${c.slug}`} className="card p-4 flex items-center gap-3 hover:shadow-[var(--shadow-lift)] transition-shadow">
                <span className="text-2xl">{dirOf(c.direction).emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-violet">{c.why}</span>
                  <span className="block font-semibold truncate">{c.title}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold"><TokenGlyph size={15} />{c.tokens_reward}</span>
              </Link>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid lg:grid-cols-2 gap-x-8">
        <Section title="Мои достижения" action={<Link to="/me#achievements" className="text-violet font-semibold inline-flex items-center">Коллекция<ChevronRight className="size-4" /></Link>}>
          <div className="card p-5 flex flex-wrap gap-2">
            {d.achievements.filter((a: any) => a.earned_at).map((a: any) => (
              <span key={a.code} className="inline-flex items-center gap-2 rounded-full bg-lavender px-3 py-1.5 text-sm font-semibold" title={a.desc}>{a.emoji} {a.title}</span>
            ))}
            <span className="inline-flex items-center rounded-full border-2 border-dashed border-lilac px-3 py-1 text-sm text-ink-soft">
              ещё {d.achievements.filter((a: any) => !a.earned_at).length} впереди
            </span>
          </div>
        </Section>
        <Section title="Сообщество в пути">
          <CommunityFeed feed={overview?.feed ?? []} />
        </Section>
      </div>

      {overview?.courses && (
        <Section title="Популярные курсы">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{overview.courses.map((c: any) => <CourseCard key={c.id} c={c} />)}</div>
        </Section>
      )}
    </div>
  )
}

function CommunityFeed({ feed }: { feed: any[] }) {
  if (!feed.length) return <p className="text-ink-soft">Здесь появятся успехи участников.</p>
  return (
    <ul className="card divide-y divide-lavender">
      {feed.slice(0, 6).map((f, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <Avatar user={f} size={32} />
          <span className="flex-1 min-w-0 text-sm"><span className="font-semibold">{f.name}</span> <span className="text-ink-soft">· {f.text.replace(/^Новое достижение: /, 'достижение ')}</span></span>
          <span className="text-xs text-ink-soft shrink-0">{timeAgo(f.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Правила сообщества при первом входе */
function RulesModal({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const accept = async () => {
    setBusy(true)
    await api.post('/me/accept-rules')
    await qc.invalidateQueries()
    toast('Добро пожаловать! Достижение «Свой человек» открыто', 'tokens')
    onDone()
  }
  return (
    <Modal open onClose={onDone} title="Добро пожаловать в «Путь в будущее»">
      <p className="text-ink-soft">Прежде чем начать, договоримся о правилах. Они нужны, чтобы здесь было безопасно каждому.</p>
      <ul className="mt-4 grid gap-3">
        {[
          ['🫶', 'Уважаем друг друга', 'Критикуем идеи, а не людей. Травля и оскорбления удаляются.'],
          ['🔒', 'Не публикуем контакты', 'Телефоны, ники и ссылки на соцсети блокируются автоматически.'],
          ['🤐', 'Бережём чужие истории', 'То, что рассказали на встрече или в личке, не пересказываем.'],
          ['🚩', 'Сообщаем о проблемах', 'Кнопка «Пожаловаться» есть у каждого сообщения и профиля.'],
        ].map(([e, t, s]) => (
          <li key={t} className="flex gap-3"><span className="text-2xl">{e}</span><span><span className="block font-semibold">{t}</span><span className="text-sm text-ink-soft">{s}</span></span></li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-2 justify-end">
        <ButtonLink to="/safety#rules" variant="ghost">Полные правила</ButtonLink>
        <Button onClick={accept} loading={busy}>Принимаю правила</Button>
      </div>
    </Modal>
  )
}

// ═════════════════════ Главная наставника и администратора ═════════════════════

function StaffHome({ overview }: { overview: any }) {
  const { user, counts, isAdmin } = useSession()
  const subs = useQuery({ queryKey: ['studio-subs', 'pending'], queryFn: () => api.get('/studio/submissions?status=pending') })
  const myCourses = useQuery({ queryKey: ['studio-courses'], queryFn: () => api.get('/studio/courses') })
  return (
    <div>
      <section className="hero-surface rounded-[28px] p-6 sm:p-10">
        <p className="text-white/75 font-medium">{isAdmin ? 'Администратор проекта' : 'Наставник'}</p>
        <h1 className="mt-1 text-3xl sm:text-[2.6rem] font-bold">Здравствуйте, {user!.name.split(' ')[0]}!</h1>
        <p className="mt-3 text-white/85 text-lg max-w-2xl">Сегодня в работе: {subs.data?.length ?? 0} {plural(subs.data?.length ?? 0, 'ответ', 'ответа', 'ответов')} на проверку и {counts.moderationQueue} {plural(counts.moderationQueue, 'обращение', 'обращения', 'обращений')} в модерации.</p>
      </section>

      <div className="mt-6 grid sm:grid-cols-3 gap-3">
        <QuickCard to="/mentor?tab=review" icon={<Inbox />} n={subs.data?.length ?? 0} label="Ответы на проверку" />
        <QuickCard to="/moderation" icon={<Gavel />} n={counts.moderationQueue} label="Модерация и обращения" alert={counts.moderationQueue > 0} />
        <QuickCard to="/mentor" icon={<Sparkles />} n={myCourses.data?.length ?? 0} label={isAdmin ? 'Курсов на платформе' : 'Моих курсов'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-x-8">
        <Section title="Ближайшие мероприятия" action={<Link to="/events" className="text-violet font-semibold">Календарь</Link>}>
          <div className="grid gap-3">{(overview?.events ?? []).map((e: any) => <EventTicket key={e.id} e={e} compact />)}</div>
        </Section>
        <Section title="Успехи участников">
          <CommunityFeed feed={overview?.feed ?? []} />
        </Section>
      </div>
      {overview?.stats && (
        <p className="mt-8 text-ink-soft">
          На платформе {overview.stats.participants} {plural(overview.stats.participants, 'участник', 'участника', 'участников')}, пройдено {overview.stats.completions} {plural(overview.stats.completions, 'курс', 'курса', 'курсов')}, заработано {overview.stats.tokens} {tokensWord(overview.stats.tokens)}. Обновлено {fmtDate(new Date().toISOString())}.
        </p>
      )}
    </div>
  )
}

function QuickCard({ to, icon, n, label, alert }: { to: string; icon: React.ReactNode; n: number; label: string; alert?: boolean }) {
  return (
    <Link to={to} className="card p-5 flex items-center gap-4 hover:shadow-[var(--shadow-lift)] transition-shadow">
      <span className={cx('size-12 rounded-2xl grid place-items-center [&>svg]:size-6', alert ? 'bg-coral text-white' : 'bg-lavender text-violet')}>{icon}</span>
      <span><span className="block font-display text-2xl font-bold">{n}</span><span className="text-sm text-ink-soft">{label}</span></span>
    </Link>
  )
}
