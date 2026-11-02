import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, List, CalendarDays, Plus } from 'lucide-react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { TZ, fmtDate, parseDb } from '../lib/format'
import { Button, Empty, ErrorBox, PageHeader, Spinner, Tabs, cx } from '../components/ui'
import { EventTicket } from '../components/shared'
import { EventForm } from '../components/EventForm'
import { EVENT_KINDS } from '../../../shared/constants'

/** Ключ дня по Новосибирску: YYYY-MM-DD */
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)

export default function Events() {
  const { isStaff } = useSession()
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [kind, setKind] = useState('all')
  const [creating, setCreating] = useState(false)
  const nav = useNavigate()
  const all = useQuery({ queryKey: ['events', 'all'], queryFn: () => api.get<any[]>('/events?scope=all') })

  const now = new Date()
  const list = useMemo(() => {
    const items = (all.data ?? []).filter((e) => kind === 'all' || e.kind === kind)
    const up = items.filter((e) => parseDb(e.ends_at) >= now)
    const past = items.filter((e) => parseDb(e.ends_at) < now).reverse()
    return { up, past }
  }, [all.data, kind])

  return (
    <div>
      <PageHeader
        title="Мероприятия"
        text="Встречи вживую в подростковых центрах и онлайн. Запишись заранее — на месте наставник отметит участие и начислит жетоны."
        actions={isStaff && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Создать мероприятие</Button>}
      />
      <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
        <Tabs value={scope} onChange={setScope} tabs={[
          { value: 'upcoming', label: `Предстоящие${list.up.length ? ` · ${list.up.length}` : ''}` },
          { value: 'past', label: 'Прошедшие' },
        ]} />
        <div className="flex gap-2">
          <select className="field !w-auto !py-2 !rounded-full" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Тип мероприятия">
            <option value="all">Все форматы</option>
            {Object.entries(EVENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.title}</option>)}
          </select>
          <div className="flex rounded-full bg-white p-1 shadow-[var(--shadow-soft)]">
            <button onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="Списком" className={cx('size-9 grid place-items-center rounded-full', view === 'list' ? 'bg-violet text-white' : 'text-ink-soft')}><List className="size-4" /></button>
            <button onClick={() => setView('calendar')} aria-pressed={view === 'calendar'} aria-label="Календарь" className={cx('size-9 grid place-items-center rounded-full', view === 'calendar' ? 'bg-violet text-white' : 'text-ink-soft')}><CalendarDays className="size-4" /></button>
          </div>
        </div>
      </div>

      {all.isLoading ? <Spinner /> : all.error ? <ErrorBox error={all.error} /> : view === 'calendar' ? (
        <Calendar events={(all.data ?? []).filter((e) => kind === 'all' || e.kind === kind)} />
      ) : (
        (() => {
          const items = scope === 'upcoming' ? list.up : list.past
          return items.length === 0
            ? <Empty emoji="🗓️" title={scope === 'upcoming' ? 'Скоро здесь появятся новые встречи' : 'Прошедших мероприятий пока нет'} text="Следи за уведомлениями." />
            : <div className="grid gap-3 xl:grid-cols-2">{items.map((e) => <EventTicket key={e.id} e={e} />)}</div>
        })()
      )}
      {creating && <EventForm onClose={() => setCreating(false)} onSaved={(id) => nav(`/events/${id}`)} />}
    </div>
  )
}

function Calendar({ events }: { events: any[] }) {
  const today = new Date()
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState<string>(dayKey(today))

  const byDay = useMemo(() => {
    const m = new Map<string, any[]>()
    for (const e of events) {
      const k = dayKey(parseDb(e.starts_at))
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return m
  }, [events])

  const first = new Date(cursor)
  const startOffset = (first.getDay() + 6) % 7 // неделя с понедельника
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1))]
  while (cells.length % 7) cells.push(null)
  const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const selectedEvents = byDay.get(selected) ?? []
  const todayKey = dayKey(today)

  return (
    <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6 items-start">
      <div className="panel p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="size-10 grid place-items-center rounded-full hover:bg-lavender" aria-label="Предыдущий месяц"><ChevronLeft className="size-5" /></button>
          <p className="font-display text-lg font-bold capitalize">{cursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</p>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="size-10 grid place-items-center rounded-full hover:bg-lavender" aria-label="Следующий месяц"><ChevronRight className="size-5" /></button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-ink-soft mb-2">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={i} />
            const k = keyOf(d)
            const evs = byDay.get(k) ?? []
            const isSel = k === selected
            return (
              <button key={i} onClick={() => setSelected(k)} aria-pressed={isSel} aria-label={`${d.getDate()}, мероприятий: ${evs.length}`}
                className={cx('aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 text-sm font-semibold transition',
                  isSel ? 'bg-violet text-white' : evs.length ? 'bg-lavender text-violet-deep hover:bg-lilac/60' : 'hover:bg-mist',
                  k === todayKey && !isSel && 'ring-2 ring-violet')}>
                {d.getDate()}
                {evs.length > 0 && <span className="flex gap-0.5">{evs.slice(0, 3).map((e, j) => <span key={j} className={cx('size-1.5 rounded-full', isSel ? 'bg-gold' : e.kind === 'openmic' || e.kind === 'excursion' ? 'bg-coral' : 'bg-violet')} />)}</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <p className="font-display text-lg font-bold mb-3">{fmtDate(selected + 'T05:00:00Z', { day: 'numeric', month: 'long', weekday: 'long' })}</p>
        {selectedEvents.length ? <div className="grid gap-3">{selectedEvents.map((e) => <EventTicket key={e.id} e={e} />)}</div>
          : <p className="text-ink-soft">В этот день мероприятий нет. Дни с событиями отмечены цветом.</p>}
      </div>
    </div>
  )
}
