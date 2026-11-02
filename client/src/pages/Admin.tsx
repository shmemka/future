import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Pencil, ShieldOff, ShieldCheck, Coins, UserCheck, KeyRound } from 'lucide-react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { fmtDate, fmtTime, timeAgo } from '../lib/format'
import { Avatar, Button, ButtonLink, Chip, ErrorBox, Field, Modal, PageHeader, Spinner, Tabs, TokenGlyph, cx, useToast } from '../components/ui'
import { EventForm } from '../components/EventForm'
import { dirOf } from '../components/shared'
import { EVENT_KINDS, ROLE_TITLES, TOKEN_CATEGORIES, type TokenCategory } from '../../../shared/constants'

type Tab = 'overview' | 'users' | 'courses' | 'events' | 'tokens'

export default function Admin() {
  const [sp, setSp] = useSearchParams()
  const tab = (sp.get('tab') as Tab) || 'overview'
  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: () => api.get('/admin/stats') })
  return (
    <div>
      <PageHeader title="Администрирование" text="Пользователи, курсы, мероприятия, жетоны и рейтинг проекта." />
      <Tabs className="mb-6" value={tab} onChange={(t) => setSp({ tab: t })} tabs={[
        { value: 'overview', label: 'Обзор' },
        { value: 'users', label: 'Пользователи', count: stats.data?.pendingMentors },
        { value: 'courses', label: 'Курсы' },
        { value: 'events', label: 'Мероприятия' },
        { value: 'tokens', label: 'Жетоны' },
      ]} />
      {tab === 'overview' && <Overview q={stats} />}
      {tab === 'users' && <Users />}
      {tab === 'courses' && <CoursesAdmin />}
      {tab === 'events' && <EventsAdmin />}
      {tab === 'tokens' && <TokensAdmin />}
    </div>
  )
}

function Overview({ q }: { q: any }) {
  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} />
  const s = q.data
  const cards = [
    ['Участников', s.participants, '/admin?tab=users'], ['Наставников', s.mentors, '/admin?tab=users'], ['Активны за неделю', s.activeWeek],
    ['Записей на курсы', s.enrollments], ['Курсов пройдено', s.completions], ['Посещений встреч', s.attendance],
    ['Публикаций', s.posts], ['Открытых жалоб', s.openReports, '/moderation?tab=reports'],
  ] as const
  const maxCat = Math.max(1, ...s.tokensByCategory.map((c: any) => c.sum))
  return (
    <div>
      {s.pendingMentors > 0 && (
        <Link to="/admin?tab=users" className="mb-4 card p-4 flex items-center gap-3 ring-2 ring-gold">
          <UserCheck className="size-5 text-[#7a5200]" /><span className="font-semibold">Заявок наставников на проверке: {s.pendingMentors}</span>
        </Link>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(([label, n, to]) => {
          const body = <><p className="font-display text-3xl font-bold">{n}</p><p className="mt-1 text-sm text-ink-soft">{label}</p></>
          return to ? <Link key={label} to={to} className="card p-5 hover:shadow-[var(--shadow-lift)]">{body}</Link> : <div key={label} className="card p-5">{body}</div>
        })}
      </div>
      <div className="mt-6 grid lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <p className="font-semibold flex items-center gap-2"><TokenGlyph size={20} />Жетоны по категориям · всего {s.tokens}</p>
          <div className="mt-4 grid gap-3">
            {s.tokensByCategory.map((c: any) => (
              <div key={c.category}>
                <div className="flex justify-between text-sm"><span>{TOKEN_CATEGORIES[c.category as TokenCategory]?.emoji} {TOKEN_CATEGORIES[c.category as TokenCategory]?.title}</span><span className="font-semibold">{c.sum}</span></div>
                <div className="mt-1 h-2 rounded-full bg-lavender"><div className="h-full rounded-full bg-violet" style={{ width: `${(Math.max(0, c.sum) / maxCat) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <p className="font-semibold">Быстрые действия</p>
          <div className="mt-4 grid sm:grid-cols-2 gap-2">
            <ButtonLink to="/admin?tab=events" variant="secondary">Создать мероприятие</ButtonLink>
            <ButtonLink to="/mentor?tab=courses" variant="secondary">Создать курс</ButtonLink>
            <ButtonLink to="/admin?tab=tokens" variant="secondary">Начислить жетоны</ButtonLink>
            <ButtonLink to="/moderation" variant="secondary">Модерация</ButtonLink>
            <ButtonLink to="/rating" variant="secondary">Рейтинг</ButtonLink>
            <ButtonLink to="/admin?tab=users" variant="secondary">Пользователи</ButtonLink>
          </div>
        </div>
      </div>
    </div>
  )
}

function Users() {
  const { user: me } = useSession()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [award, setAward] = useState<any | null>(null)
  const params = new URLSearchParams({ ...(search && { q: search }), ...(role && { role }), ...(status && { status }) })
  const q = useQuery({ queryKey: ['admin-users', search, role, status], queryFn: () => api.get<any[]>(`/admin/users?${params}`) })
  const qc = useQueryClient()
  const toast = useToast()
  const patch = async (id: number, body: any, msg: string) => {
    try { await api.patch(`/admin/users/${id}`, body); toast(msg); qc.invalidateQueries({ queryKey: ['admin-users'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }) }
    catch (e: any) { toast(e.message, 'error') }
  }
  const resetPassword = async (u: any) => {
    const pwd = prompt(`Временный пароль для ${u.name} (минимум 8 символов). Передайте его лично, не через сообщения платформы.`)
    if (!pwd) return
    try { await api.post(`/admin/users/${u.id}/password`, { password: pwd }); toast('Пароль изменён') }
    catch (e: any) { toast(e.message, 'error') }
  }
  return (
    <div>
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-soft" />
          <input className="field pl-10" placeholder="Имя или почта" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск пользователя" />
        </div>
        <select className="field md:!w-48" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Роль"><option value="">Все роли</option><option value="participant">Участники</option><option value="mentor">Наставники</option><option value="admin">Администраторы</option></select>
        <select className="field md:!w-48" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Статус"><option value="">Любой статус</option><option value="pending">Ждут подтверждения</option><option value="active">Активные</option><option value="blocked">Заблокированные</option></select>
      </div>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead><tr className="text-left text-ink-soft border-b border-lavender"><th className="px-4 py-3 font-semibold">Пользователь</th><th className="px-4 py-3 font-semibold">Роль</th><th className="px-4 py-3 font-semibold">Статус</th><th className="px-4 py-3 font-semibold">Жетоны</th><th className="px-4 py-3 font-semibold">Был</th><th className="px-4 py-3" /></tr></thead>
            <tbody className="divide-y divide-lavender">
              {q.data!.map((u) => (
                <tr key={u.id} className={cx(u.status === 'pending' && 'bg-gold/10')}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar user={u} size={34} /><div className="min-w-0"><p className="font-semibold">{u.name}</p><p className="text-xs text-ink-soft">{u.email}{u.city && ` · ${u.city}`}</p></div></div></td>
                  <td className="px-4 py-3">
                    <select className="field !py-1.5 !w-auto" value={u.role} disabled={u.id === me?.id} onChange={(e) => patch(u.id, { role: e.target.value }, 'Роль изменена')} aria-label="Роль">
                      {Object.entries(ROLE_TITLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">{u.status === 'active' ? <Chip tone="mint">Активен</Chip> : u.status === 'pending' ? <Chip tone="gold">Ждёт</Chip> : <Chip tone="coral">Заблокирован</Chip>}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{u.tokens}</td>
                  <td className="px-4 py-3 text-ink-soft">{u.last_seen_at ? timeAgo(u.last_seen_at) : '—'}</td>
                  <td className="px-4 py-3">
                    {u.id !== me?.id && (
                      <div className="flex gap-1 justify-end">
                        {u.status === 'pending' && <Button size="sm" onClick={() => patch(u.id, { status: 'active' }, 'Наставник подтверждён')}>Подтвердить</Button>}
                        <button onClick={() => resetPassword(u)} className="size-9 grid place-items-center rounded-full hover:bg-lavender text-ink-soft" title="Задать временный пароль" aria-label="Задать временный пароль"><KeyRound className="size-4" /></button>
                        {u.role === 'participant' && <button onClick={() => setAward(u)} className="size-9 grid place-items-center rounded-full hover:bg-lavender text-[#7a5200]" title="Начислить жетоны" aria-label="Начислить жетоны"><Coins className="size-4" /></button>}
                        {u.status === 'blocked'
                          ? <button onClick={() => patch(u.id, { status: 'active' }, 'Пользователь разблокирован')} className="size-9 grid place-items-center rounded-full hover:bg-lavender text-[#0b7a5a]" title="Разблокировать" aria-label="Разблокировать"><ShieldCheck className="size-4" /></button>
                          : <button onClick={() => confirm(`Заблокировать ${u.name}?`) && patch(u.id, { status: 'blocked' }, 'Пользователь заблокирован')} className="size-9 grid place-items-center rounded-full hover:bg-coral/10 text-[#c2185b]" title="Заблокировать" aria-label="Заблокировать"><ShieldOff className="size-4" /></button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {award && <AwardModal user={award} onClose={() => setAward(null)} />}
    </div>
  )
}

function AwardModal({ user, onClose }: { user?: any; onClose: () => void }) {
  const participants = useQuery({ queryKey: ['participants'], queryFn: () => api.get<any[]>('/moderation/participants'), enabled: !user })
  const [f, setF] = useState({ userId: user?.id ?? '', amount: 10, category: 'bonus', reason: '' })
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const qc = useQueryClient()
  const save = async () => {
    setBusy(true)
    try {
      await api.post('/admin/tokens', { ...f, userId: Number(f.userId) })
      toast(`${f.amount > 0 ? 'Начислено' : 'Списано'} ${Math.abs(f.amount)} жетонов`, 'tokens')
      qc.invalidateQueries({ queryKey: ['admin-users'] }); qc.invalidateQueries({ queryKey: ['admin-tokens'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] })
      onClose()
    } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={user ? `Жетоны: ${user.name}` : 'Начислить или списать жетоны'}>
      <div className="grid gap-4">
        {!user && (
          <Field label="Участник">
            <select className="field" value={f.userId} onChange={(e) => setF({ ...f, userId: e.target.value })}>
              <option value="">Выберите участника</option>
              {participants.data?.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.tokens}</option>)}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Количество" hint="Отрицательное число — списание"><input className="field" type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></Field>
          <Field label="Категория">
            <select className="field" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {Object.entries(TOKEN_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.title}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Основание" hint="Участник увидит его в истории начислений"><input className="field" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Например, помощь в организации экскурсии" /></Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Отмена</Button><Button onClick={save} loading={busy} disabled={!f.userId || !f.amount || f.reason.trim().length < 5}>Провести</Button></div>
      </div>
    </Modal>
  )
}

function CoursesAdmin() {
  const q = useQuery({ queryKey: ['studio-courses'], queryFn: () => api.get<any[]>('/studio/courses') })
  if (q.isLoading) return <Spinner />
  return (
    <div>
      <div className="flex justify-end mb-3"><ButtonLink to="/mentor?tab=courses" icon={<Plus className="size-4" />}>Новый курс</ButtonLink></div>
      <ul className="card divide-y divide-lavender">
        {q.data!.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <span className="text-2xl">{dirOf(c.direction).emoji}</span>
            <span className="flex-1 min-w-[220px]"><span className="block font-semibold">{c.title}</span><span className="text-xs text-ink-soft">{c.mentor_name} · {c.lessons_total} уроков · {c.tasks_total} заданий · {c.learners} учатся, {c.finished} прошли</span></span>
            {c.published ? <Chip tone="mint">Опубликован</Chip> : <Chip tone="gold">Черновик</Chip>}
            <ButtonLink to={`/studio/${c.id}`} size="sm" variant="secondary" icon={<Pencil className="size-4" />}>Редактировать</ButtonLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EventsAdmin() {
  const q = useQuery({ queryKey: ['events', 'all'], queryFn: () => api.get<any[]>('/events?scope=all') })
  const [edit, setEdit] = useState<any | null>(null)
  if (q.isLoading) return <Spinner />
  return (
    <div>
      <div className="flex justify-end mb-3"><Button icon={<Plus className="size-4" />} onClick={() => setEdit({})}>Новое мероприятие</Button></div>
      <ul className="card divide-y divide-lavender">
        {q.data!.slice().reverse().map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <span className="w-24 text-sm"><span className="block font-semibold">{fmtDate(e.starts_at)}</span><span className="text-ink-soft">{fmtTime(e.starts_at)}</span></span>
            <span className="flex-1 min-w-[220px]"><Link to={`/events/${e.id}`} className="block font-semibold hover:text-violet">{e.title}</Link><span className="text-xs text-ink-soft">{EVENT_KINDS[e.kind as keyof typeof EVENT_KINDS]?.title} · {e.registered}/{e.capacity} записались · {e.attended} пришли</span></span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold"><TokenGlyph size={15} />{e.tokens_reward}</span>
            <Button size="sm" variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEdit(e)}>Изменить</Button>
          </li>
        ))}
      </ul>
      {edit && <EventForm event={edit.id ? edit : undefined} onClose={() => setEdit(null)} />}
    </div>
  )
}

function TokensAdmin() {
  const q = useQuery({ queryKey: ['admin-tokens'], queryFn: () => api.get<any[]>('/admin/tokens') })
  const [award, setAward] = useState(false)
  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <p className="text-ink-soft">Журнал всех начислений и списаний. Автоматические — без автора.</p>
        <Button icon={<Coins className="size-4" />} onClick={() => setAward(true)}>Начислить или списать</Button>
      </div>
      {q.isLoading ? <Spinner /> : (
        <ul className="card divide-y divide-lavender">
          {q.data!.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-3">
              <span className="text-lg">{TOKEN_CATEGORIES[t.category as TokenCategory]?.emoji}</span>
              <span className="flex-1 min-w-0"><span className="block font-medium truncate">{t.user_name} — {t.reason}</span><span className="text-xs text-ink-soft">{timeAgo(t.created_at)}{t.by_name ? ` · начислил(а) ${t.by_name}` : ' · автоматически'}</span></span>
              <Chip tone={t.amount > 0 ? 'gold' : 'coral'}>{t.amount > 0 ? `+${t.amount}` : t.amount}</Chip>
            </li>
          ))}
        </ul>
      )}
      {award && <AwardModal onClose={() => setAward(false)} />}
    </div>
  )
}
