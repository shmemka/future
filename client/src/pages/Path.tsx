import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Train, MapPin } from 'lucide-react'
import { api } from '../lib/api'
import { fmtDate, timeAgo, tokensWord, daysUntil, plural } from '../lib/format'
import { ButtonLink, Chip, PageHeader, Spinner, ErrorBox, TokenGlyph, cx } from '../components/ui'
import { Section } from '../components/Layout'
import { LEVELS, TOKEN_CATEGORIES, TOKEN_RULES, TRIP, type TokenCategory } from '../../../shared/constants'
import { useSession } from '../lib/session'

/** Позиция на линии маршрута (0–100%) по количеству жетонов: станции стоят равномерно */
function trackPosition(tokens: number) {
  const stations = [...LEVELS.map((l) => l.min), TRIP.threshold + 150]
  const seg = 100 / (stations.length - 1)
  for (let i = 0; i < stations.length - 1; i++) {
    if (tokens < stations[i + 1]) return i * seg + ((tokens - stations[i]) / (stations[i + 1] - stations[i])) * seg
  }
  return 100
}

export default function Path() {
  const { user } = useSession()
  const q = useQuery({ queryKey: ['tokens'], queryFn: () => api.get('/me/tokens') })
  // Поезд въезжает на свою позицию один раз после загрузки
  const [arrived, setArrived] = useState(false)
  useEffect(() => { if (q.data) { const t = setTimeout(() => setArrived(true), 150); return () => clearTimeout(t) } }, [q.data])
  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} />
  const { summary: s, transactions } = q.data
  const pos = trackPosition(s.total)
  const inSeats = s.rank <= TRIP.seats
  const passed = s.total >= TRIP.threshold
  const toTrip = Math.max(0, TRIP.threshold - s.total)

  const stations: { title: string; sub: string; reached: boolean; current: boolean; final?: boolean }[] = [
    ...LEVELS.map((l, i) => ({ title: l.title as string, sub: `${l.min}`, reached: s.total >= l.min, current: s.level.index === i })),
    { title: 'Путешествие', sub: '3–10 июня', reached: false, current: false, final: true },
  ]

  return (
    <div>
      <PageHeader title="Мой путь" text={`Каждый жетон приближает к путешествию по Новосибирской области. В поездку едут ${TRIP.seats} самых активных участников с ${TRIP.threshold}+ жетонами.`} />

      {/* Маршрут */}
      <section className="hero-surface rounded-[28px] p-6 sm:p-10 overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-white/75 font-medium">Сейчас ты на станции</p>
            <p className="font-display text-3xl sm:text-4xl font-bold mt-1">{s.level.title}</p>
            <p className="text-white/80 mt-2 max-w-md">{s.level.hint}</p>
          </div>
          <div className="flex gap-6 sm:gap-10">
            <div><p className="font-display text-4xl font-bold flex items-center gap-2"><TokenGlyph size={32} />{s.total}</p><p className="text-white/75 text-sm mt-1">{tokensWord(s.total)}</p></div>
            <div><p className="font-display text-4xl font-bold">{s.rank}</p><p className="text-white/75 text-sm mt-1">место из {s.participants}</p></div>
          </div>
        </div>

        {/* Горизонтальная линия — планшет и десктоп */}
        <div className="hidden md:block relative mt-14 mb-4 mx-4">
          <div className="h-2 rounded-full bg-white/20" />
          <div className="absolute left-0 top-0 h-2 rounded-full bg-gold" style={{ width: `${arrived ? pos : 0}%`, transition: 'width 1.4s cubic-bezier(.6,0,.2,1)' }} />
          {stations.map((st, i) => {
            const left = (i / (stations.length - 1)) * 100
            return (
              <div key={st.title} className="absolute top-1 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: `${left}%` }}>
                <span className={cx('rounded-full grid place-items-center', st.final ? 'size-9 bg-gold text-violet-deep' : st.reached ? 'size-5 bg-gold ring-4 ring-violet' : 'size-5 bg-white/30 ring-4 ring-violet')}>
                  {st.final && <MapPin className="size-5" />}
                </span>
                <span className={cx('absolute top-9 w-28 text-center text-sm leading-tight', st.current ? 'font-bold' : 'text-white/80')}>
                  {st.title}<span className="block text-xs text-white/60 mt-0.5">{st.final ? st.sub : `от ${st.sub}`}</span>
                </span>
              </div>
            )
          })}
          {/* Поезд */}
          <div className="absolute -top-11 -translate-x-1/2" style={{ left: `${arrived ? pos : 0}%`, transition: 'left 1.4s cubic-bezier(.6,0,.2,1)' }} aria-label={`Твоя позиция: ${s.total} жетонов`}>
            <span className="grid place-items-center size-10 rounded-2xl bg-white text-violet shadow-lg"><Train className="size-5" /></span>
          </div>
          <div className="h-16" />
        </div>

        {/* Вертикальная линия — телефон */}
        <ol className="md:hidden mt-8 relative">
          <span className="absolute left-[11px] top-3 bottom-3 w-[3px] bg-white/20 rounded-full" />
          {stations.map((st) => (
            <li key={st.title} className="relative flex items-center gap-4 py-2.5">
              <span className={cx('relative z-10 size-6 rounded-full grid place-items-center shrink-0', st.final ? 'bg-gold text-violet-deep' : st.reached ? 'bg-gold' : 'bg-white/25')}>
                {st.current && <Train className="size-3.5 text-violet-deep" />}
              </span>
              <span className={cx(st.current ? 'font-bold' : 'text-white/80')}>{st.title}</span>
              <span className="ml-auto text-sm text-white/60">{st.final ? st.sub : `от ${st.sub}`}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Статус по путешествию */}
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        <div className={cx('card p-6 md:col-span-2', passed && inSeats && 'ring-2 ring-mint')}>
          <p className="font-display text-xl font-bold">
            {passed && inSeats ? 'Ты в зоне путешествия' : passed ? 'Порог пройден — борьба за место' : `Ещё ${toTrip} ${tokensWord(toTrip)} до порога`}
          </p>
          <p className="mt-2 text-ink-soft leading-relaxed">
            {passed && inSeats
              ? `Сейчас ты в первых ${TRIP.seats}. Рейтинг закрывается ${fmtDate(TRIP.ratingCloses + 'T12:00:00Z', { day: 'numeric', month: 'long', year: 'numeric' })} — продолжай учиться и участвовать во встречах, чтобы сохранить место.`
              : `Чтобы поехать, нужно набрать ${TRIP.threshold} жетонов и войти в число ${TRIP.seats} самых активных. До закрытия рейтинга ${daysUntil(TRIP.ratingCloses)} ${plural(daysUntil(TRIP.ratingCloses), 'день', 'дня', 'дней')}.`}
          </p>
          <div className="mt-4 h-3 rounded-full bg-lavender overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-violet to-violet-bright" style={{ width: `${Math.min(100, (s.total / TRIP.threshold) * 100)}%` }} /></div>
          <p className="mt-2 text-sm text-ink-soft">{s.total} из {TRIP.threshold} жетонов</p>
        </div>
        <div className="card p-6">
          <p className="font-semibold">Путешествие</p>
          <p className="font-display text-2xl font-bold mt-1">3 — 10 июня 2028</p>
          <p className="mt-3 text-sm text-ink-soft">Маршрут: {TRIP.route.join(' — ')}. Мерч проекта, альбом воспоминаний и встречи с людьми, которые меняют свои города.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-x-8">
        <Section title="Откуда жетоны">
          <div className="card p-5 grid gap-4">
            {(['course', 'task', 'event', 'team', 'initiative'] as TokenCategory[]).map((k) => {
              const v = s.byCategory.find((b: any) => b.category === k)?.sum ?? 0
              const max = Math.max(1, ...s.byCategory.map((b: any) => b.sum))
              return (
                <div key={k}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{TOKEN_CATEGORIES[k].emoji} {TOKEN_CATEGORIES[k].title}</span><span className="font-semibold tabular-nums">{v}</span></div>
                  <div className="mt-1.5 h-2 rounded-full bg-lavender"><div className="h-full rounded-full bg-violet" style={{ width: `${(v / max) * 100}%` }} /></div>
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="Как заработать">
          <ul className="card divide-y divide-lavender">
            {[
              ['🎓', 'Пройти курс целиком', '30–45', '/courses'],
              ['✍️', 'Задание или тест в курсе', '10–20', '/courses'],
              ['🎟️', 'Прийти на мероприятие', '15–35', '/events'],
              ['🤝', 'Командная работа (отмечает наставник)', `до ${TOKEN_RULES.maxTeamAward}`, '/events'],
              ['💡', 'Идея, одобренная наставником', `${TOKEN_RULES.ideaApproved}`, '/community?channel=idei'],
            ].map(([e, t, n, to]) => (
              <li key={t}><Link to={to} className="flex items-center gap-3 px-5 py-3.5 hover:bg-mist">
                <span className="text-xl">{e}</span><span className="flex-1 font-medium">{t}</span>
                <span className="inline-flex items-center gap-1 font-semibold"><TokenGlyph size={15} />{n}</span>
              </Link></li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-soft">Жетоны дают за учёбу и участие — не за лайки и подписчиков.</p>
        </Section>
      </div>

      <Section title="История начислений" action={user && <ButtonLink to="/rating" variant="secondary" size="sm">Рейтинг</ButtonLink>}>
        {transactions.length === 0 ? <p className="text-ink-soft">Пока пусто. Пройди первый урок — и здесь появится запись.</p> : (
          <ul className="card divide-y divide-lavender">
            {transactions.map((t: any) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-lg">{TOKEN_CATEGORIES[t.category as TokenCategory]?.emoji}</span>
                <span className="flex-1 min-w-0"><span className="block font-medium truncate">{t.reason}</span><span className="text-xs text-ink-soft">{timeAgo(t.created_at)}</span></span>
                <Chip tone={t.amount > 0 ? 'gold' : 'coral'}><TokenGlyph size={14} />{t.amount > 0 ? `+${t.amount}` : t.amount}</Chip>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
