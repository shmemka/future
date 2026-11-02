import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Clock, MapPin, Wifi, Users, Mic2, Pencil, Trash2, Check } from 'lucide-react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { fmtFull, fmtTime, parseDb } from '../lib/format'
import { Avatar, Button, Chip, ErrorBox, Progress, Spinner, TokenGlyph, cx, useToast } from '../components/ui'
import { EventForm } from '../components/EventForm'
import { EVENT_KINDS } from '../../../shared/constants'

export default function EventPage() {
  const { id } = useParams()
  const { user, isStaff, isAdmin } = useSession()
  const q = useQuery({ queryKey: ['event', id], queryFn: () => api.get(`/events/${id}`) })
  const qc = useQueryClient()
  const toast = useToast()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)

  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} />
  const e = q.data
  const kind = EVENT_KINDS[e.kind as keyof typeof EVENT_KINDS]
  const past = parseDb(e.ends_at) < new Date()
  const left = e.capacity - e.registered

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['event', id] })
    qc.invalidateQueries({ queryKey: ['events'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const register = async () => {
    if (!user) return nav(`/login?next=/events/${id}`)
    setBusy(true)
    try { await api.post(`/events/${id}/register`); await refresh(); toast('Ты записан! Напомним за день до встречи.') }
    catch (err: any) { toast(err.message, 'error') } finally { setBusy(false) }
  }
  const cancel = async () => {
    setBusy(true)
    try { await api.del(`/events/${id}/register`); await refresh(); toast('Запись отменена') }
    catch (err: any) { toast(err.message, 'error') } finally { setBusy(false) }
  }
  const mark = async (userId: number, attended: boolean) => {
    try {
      await api.post(`/events/${id}/attendance`, { userId, attended })
      await refresh()
      toast(attended ? `Участие отмечено, +${e.tokens_reward} жетонов` : 'Отметка снята', attended ? 'tokens' : 'ok')
    } catch (err: any) { toast(err.message, 'error') }
  }
  const remove = async () => {
    if (!confirm('Удалить мероприятие? Записи участников тоже удалятся.')) return
    await api.del(`/events/${id}`)
    qc.invalidateQueries({ queryKey: ['events'] })
    nav('/events')
  }
  const canEdit = isAdmin || (isStaff && e.created_by === user?.id)

  return (
    <div className="max-w-4xl">
      <Link to="/events" className="inline-flex items-center gap-1.5 text-ink-soft hover:text-violet font-medium"><ArrowLeft className="size-4" />Все мероприятия</Link>

      <section className="mt-4 panel overflow-hidden">
        <div className={cx('p-6 sm:p-10', past ? 'bg-lavender' : 'hero-surface')}>
          <div className="flex flex-wrap gap-2">
            <Chip tone={past ? 'lavender' : 'white'}>{kind?.emoji} {kind?.title}</Chip>
            <Chip tone={past ? 'lavender' : 'white'}>{e.format === 'online' ? 'Онлайн' : 'Очно'}</Chip>
            {past && <Chip>Завершено</Chip>}
          </div>
          <h1 className="mt-4 text-3xl sm:text-[2.6rem] font-bold leading-tight">{e.title}</h1>
          <p className={cx('mt-4 text-lg capitalize', past ? 'text-ink-soft' : 'text-white/85')}>{fmtFull(e.starts_at)}, {fmtTime(e.starts_at)}–{fmtTime(e.ends_at)} <span className="normal-case">по Новосибирску</span></p>
        </div>
        <div className="p-6 sm:p-10 grid md:grid-cols-[1.4fr_1fr] gap-8">
          <div>
            <p className="text-lg leading-relaxed whitespace-pre-line">{e.description}</p>
            <dl className="mt-6 grid gap-3">
              <Info icon={e.format === 'online' ? <Wifi /> : <MapPin />} label="Где">{e.location}</Info>
              <Info icon={<Clock />} label="Когда">{fmtTime(e.starts_at)} – {fmtTime(e.ends_at)}</Info>
              {e.host && <Info icon={<Mic2 />} label="Ведущие">{e.host}</Info>}
            </dl>
          </div>
          <aside className="rounded-[22px] bg-mist p-5 self-start">
            <p className="flex items-center gap-2 font-display text-2xl font-bold"><TokenGlyph size={26} />{e.tokens_reward}</p>
            <p className="text-sm text-ink-soft">жетонов за участие — начисляются, когда наставник отметит тебя на месте</p>
            <div className="mt-5">
              <div className="flex justify-between text-sm"><span className="inline-flex items-center gap-1"><Users className="size-4" />Записались</span><span className="font-semibold">{e.registered} / {e.capacity}</span></div>
              <Progress value={(e.registered / e.capacity) * 100} className="mt-2" tone={left <= 3 ? 'gold' : 'violet'} />
            </div>
            {!past && user?.role !== 'mentor' && user?.role !== 'admin' && (
              e.my_status === 'registered' ? (
                <div className="mt-5 grid gap-2">
                  <p className="font-semibold text-violet flex items-center gap-1.5"><Check className="size-4" />Ты записан</p>
                  <Button variant="ghost" onClick={cancel} loading={busy}>Отменить запись</Button>
                </div>
              ) : (
                <Button className="mt-5 w-full" onClick={register} loading={busy} disabled={left <= 0}>{left <= 0 ? 'Мест нет' : user ? 'Записаться' : 'Войти и записаться'}</Button>
              )
            )}
            {e.my_status === 'attended' && <p className="mt-5 font-semibold text-[#0b7a5a]">Участие засчитано, жетоны начислены</p>}
            {past && !e.my_status && <p className="mt-5 text-sm text-ink-soft">Мероприятие завершилось. Следи за новыми датами в календаре.</p>}
            {canEdit && (
              <div className="mt-5 pt-5 border-t border-lavender flex gap-2">
                <Button size="sm" variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Изменить</Button>
                {isAdmin && <Button size="sm" variant="danger" icon={<Trash2 className="size-4" />} onClick={remove}>Удалить</Button>}
              </div>
            )}
          </aside>
        </div>
      </section>

      {e.kind === 'openmic' && (
        <div className="mt-5 card p-5 flex gap-3">
          <span className="text-2xl">🤫</span>
          <p className="text-ink-soft"><span className="font-semibold text-ink">Правила открытого микрофона.</span> Не перебиваем, не оцениваем, не снимаем на телефон и не пересказываем чужие истории. На встрече всегда есть психолог — к нему можно подойти после.</p>
        </div>
      )}

      {isStaff && e.attendees && (
        <section className="mt-8">
          <h2 className="text-2xl font-bold mb-1">Участники и отметка посещения</h2>
          <p className="text-ink-soft mb-4">{parseDb(e.starts_at).getTime() - 3600_000 > Date.now()
            ? 'Отметить посещение можно будет с момента начала встречи. Пока здесь список записавшихся.'
            : 'Отметьте тех, кто пришёл, — жетоны начислятся автоматически. Снятие отметки возвращает начисление.'}</p>
          {e.attendees.length === 0 ? <p className="text-ink-soft">Пока никто не записался.</p> : (
            <ul className="card divide-y divide-lavender">
              {e.attendees.map((a: any) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar user={a} size={36} />
                  <span className="flex-1 min-w-0"><span className="block font-semibold truncate">{a.name}</span><span className="text-xs text-ink-soft">{a.city}</span></span>
                  {a.status === 'attended'
                    ? <Button size="sm" variant="secondary" onClick={() => mark(a.id, false)} icon={<Check className="size-4" />}>Был(а)</Button>
                    : parseDb(e.starts_at).getTime() - 3600_000 > Date.now() ? <Chip>записан(а)</Chip> : <Button size="sm" onClick={() => mark(a.id, true)}>Отметить</Button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {editing && <EventForm event={e} onClose={() => setEditing(false)} />}
    </div>
  )
}

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="size-10 rounded-xl bg-lavender text-violet grid place-items-center shrink-0 [&>svg]:size-5">{icon}</span>
      <div><dt className="text-sm text-ink-soft">{label}</dt><dd className="font-medium">{children}</dd></div>
    </div>
  )
}
