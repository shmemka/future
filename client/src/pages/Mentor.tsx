import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Check, RotateCcw, Users, BookOpen } from 'lucide-react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { timeAgo, parseDb } from '../lib/format'
import { Avatar, Button, Chip, Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Tabs, TokenGlyph, useToast } from '../components/ui'
import { EventTicket, dirOf } from '../components/shared'
import { DIRECTIONS, DIRECTION_KEYS, TOKEN_RULES } from '../../../shared/constants'

type Tab = 'review' | 'courses' | 'team' | 'events'

export default function Mentor() {
  const [sp, setSp] = useSearchParams()
  const tab = (sp.get('tab') as Tab) || 'review'
  const subs = useQuery({ queryKey: ['studio-subs', 'pending'], queryFn: () => api.get<any[]>('/studio/submissions?status=pending') })
  return (
    <div>
      <PageHeader title="Кабинет наставника" text="Проверяйте задания, ведите курсы, отмечайте командную работу и участие во встречах." />
      <Tabs className="mb-6" value={tab} onChange={(t) => setSp({ tab: t })} tabs={[
        { value: 'review', label: 'Проверка заданий', count: subs.data?.length },
        { value: 'courses', label: 'Курсы' },
        { value: 'team', label: 'Командная работа' },
        { value: 'events', label: 'Мероприятия' },
      ]} />
      {tab === 'review' && <Review />}
      {tab === 'courses' && <MyCourses />}
      {tab === 'team' && <TeamAward />}
      {tab === 'events' && <MentorEvents />}
    </div>
  )
}

function Review() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'revision'>('pending')
  const q = useQuery({ queryKey: ['studio-subs', status], queryFn: () => api.get<any[]>(`/studio/submissions?status=${status}`) })
  return (
    <div>
      <Tabs className="mb-4" value={status} onChange={setStatus} tabs={[{ value: 'pending', label: 'Ждут проверки' }, { value: 'revision', label: 'На доработке' }, { value: 'approved', label: 'Зачтённые' }]} />
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : q.data!.length === 0 ? (
        <Empty emoji="🎉" title={status === 'pending' ? 'Все ответы проверены' : 'Здесь пусто'} text={status === 'pending' ? 'Новые ответы появятся здесь, а вам придёт уведомление.' : undefined} />
      ) : <div className="grid gap-4">{q.data!.map((s) => <SubmissionCard key={s.id} s={s} readonly={status !== 'pending'} />)}</div>}
    </div>
  )
}

function SubmissionCard({ s, readonly }: { s: any; readonly: boolean }) {
  const [feedback, setFeedback] = useState(s.feedback ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const toast = useToast()
  const qc = useQueryClient()
  const review = async (status: 'approved' | 'revision') => {
    setBusy(status)
    try {
      const r = await api.post(`/studio/submissions/${s.id}/review`, { status, feedback })
      toast(status === 'approved' ? `Зачтено, участнику начислено ${s.tokens_reward} жетонов${r.courseCompleted ? ' — и курс пройден целиком!' : ''}` : 'Отправлено на доработку')
      qc.invalidateQueries({ queryKey: ['studio-subs'] })
    } catch (e: any) { toast(e.message, 'error') } finally { setBusy(null) }
  }
  return (
    <article className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar user={s} size={40} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{s.user_name}</p>
          <p className="text-sm text-ink-soft"><Link to={`/courses/${s.slug}`} className="hover:text-violet">{s.course_title}</Link> · {timeAgo(s.created_at)}</p>
        </div>
        <span className="inline-flex items-center gap-1 font-semibold"><TokenGlyph size={16} />{s.tokens_reward}</span>
      </div>
      <p className="mt-4 font-bold">{s.task_title}</p>
      <details className="mt-1 text-sm text-ink-soft"><summary className="cursor-pointer font-medium">Формулировка задания</summary><p className="mt-1">{s.prompt}</p></details>
      <blockquote className="mt-3 rounded-2xl bg-mist p-4 whitespace-pre-line leading-relaxed">{s.answer}</blockquote>
      {readonly ? (
        s.feedback && <p className="mt-3 text-sm"><span className="font-semibold">Ваш комментарий: </span>{s.feedback}</p>
      ) : (
        <>
          <Field label="Комментарий участнику" hint="Для доработки обязателен. Поддерживающий тон помогает больше, чем исправления.">
            <textarea className="field min-h-20 mt-1" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Что получилось хорошо и что можно усилить" />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => review('approved')} loading={busy === 'approved'} icon={<Check className="size-4" />}>Зачесть</Button>
            <Button variant="secondary" onClick={() => review('revision')} loading={busy === 'revision'} icon={<RotateCcw className="size-4" />}>На доработку</Button>
          </div>
        </>
      )}
    </article>
  )
}

function MyCourses() {
  const { isAdmin } = useSession()
  const q = useQuery({ queryKey: ['studio-courses'], queryFn: () => api.get<any[]>('/studio/courses') })
  const [creating, setCreating] = useState(false)
  return (
    <div>
      <div className="flex justify-between items-center mb-4 gap-3">
        <p className="text-ink-soft">{isAdmin ? 'Все курсы платформы' : 'Курсы, которые вы ведёте'}</p>
        <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Новый курс</Button>
      </div>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : q.data!.length === 0 ? <Empty emoji="📚" title="У вас пока нет курсов" text="Создайте первый — уроки и задания добавите в редакторе." /> : (
        <ul className="card divide-y divide-lavender overflow-hidden">
          {q.data!.map((c) => (
            <li key={c.id}>
              <Link to={`/studio/${c.id}`} className="flex flex-wrap items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-mist">
                <span className="text-2xl">{dirOf(c.direction).emoji}</span>
                <span className="flex-1 min-w-[200px]">
                  <span className="block font-semibold">{c.title}</span>
                  <span className="block text-sm text-ink-soft">{c.lessons_total} уроков · {c.tasks_total} заданий{isAdmin && c.mentor_name ? ` · ${c.mentor_name}` : ''}</span>
                </span>
                <span className="text-sm text-ink-soft inline-flex items-center gap-1"><Users className="size-4" />{c.learners} / прошли {c.finished}</span>
                {c.published ? <Chip tone="mint">Опубликован</Chip> : <Chip tone="gold">Черновик</Chip>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating && <NewCourse onClose={() => setCreating(false)} />}
    </div>
  )
}

function NewCourse({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ title: '', direction: 'psychology', short: '', description: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const nav = useNavigate()
  const create = async () => {
    setBusy(true); setErr('')
    try {
      const r = await api.post('/studio/courses', { ...f, published: false })
      nav(`/studio/${r.id}`)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Новый курс">
      <div className="grid gap-4">
        <Field label="Название"><input className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Направление">
          <select className="field" value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}>
            {DIRECTION_KEYS.map((k) => <option key={k} value={k}>{DIRECTIONS[k].emoji} {DIRECTIONS[k].title}</option>)}
          </select>
        </Field>
        <Field label="Коротко о курсе" hint="Одно предложение для карточки в каталоге"><input className="field" value={f.short} onChange={(e) => setF({ ...f, short: e.target.value })} /></Field>
        <Field label="Описание"><textarea className="field min-h-28" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {err && <p className="text-sm font-medium text-[#b0174f]">{err}</p>}
        <p className="text-sm text-ink-soft">Курс создаётся черновиком. Опубликуете, когда добавите уроки и задания.</p>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Отмена</Button><Button onClick={create} loading={busy}>Создать и перейти к урокам</Button></div>
      </div>
    </Modal>
  )
}

function TeamAward() {
  const q = useQuery({ queryKey: ['participants'], queryFn: () => api.get<any[]>('/moderation/participants') })
  const [userId, setUserId] = useState<number | ''>('')
  const [amount, setAmount] = useState(TOKEN_RULES.teamDefault)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const qc = useQueryClient()
  const send = async () => {
    setBusy(true)
    try {
      await api.post('/moderation/team-award', { userId, amount, reason })
      toast(`Начислено ${amount} жетонов за командную работу`, 'tokens')
      setReason(''); setUserId('')
      qc.invalidateQueries({ queryKey: ['participants'] })
    } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-6 items-start">
      <div className="panel p-6 sm:p-8">
        <p className="font-display text-xl font-bold">Отметить командную работу</p>
        <p className="mt-1 text-ink-soft">Начисляйте жетоны тем, кто помог команде, взял на себя организацию или поддержал других. Разово — до {TOKEN_RULES.maxTeamAward}.</p>
        <div className="mt-5 grid gap-4">
          <Field label="Участник">
            <select className="field" value={userId} onChange={(e) => setUserId(Number(e.target.value) || '')}>
              <option value="">Выберите участника</option>
              {q.data?.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.city}</option>)}
            </select>
          </Field>
          <Field label="Сколько жетонов">
            <div className="flex gap-2">{[5, 10, 15, 20, 30].map((n) => <button key={n} type="button" onClick={() => setAmount(n)} className={`h-10 px-4 rounded-full font-semibold ${amount === n ? 'bg-violet text-white' : 'bg-lavender'}`}>{n}</button>)}</div>
          </Field>
          <Field label="За что"><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Например, капитан команды на квесте" maxLength={160} /></Field>
          <Button onClick={send} loading={busy} disabled={!userId || reason.trim().length < 5}>Начислить жетоны</Button>
        </div>
      </div>
      <div className="card p-5">
        <p className="font-semibold mb-3 flex items-center gap-2"><BookOpen className="size-4 text-violet" />Когда начислять</p>
        <ul className="grid gap-2 text-ink-soft">
          <li>— Капитан или организатор команды на мастер-классе или квесте</li>
          <li>— Помог провести игру или мероприятие для младших</li>
          <li>— Поддержал участника в сложной ситуации</li>
          <li>— Вклад в общий проект: монтаж, дизайн, тексты</li>
        </ul>
        <p className="mt-3 text-sm text-ink-soft">Каждое начисление видно администратору в журнале жетонов.</p>
      </div>
    </div>
  )
}

function MentorEvents() {
  const q = useQuery({ queryKey: ['events', 'all'], queryFn: () => api.get<any[]>('/events?scope=all') })
  if (q.isLoading) return <Spinner />
  const now = new Date()
  const recent = (q.data ?? []).filter((e) => parseDb(e.ends_at) < now).reverse().slice(0, 4)
  const soon = (q.data ?? []).filter((e) => parseDb(e.ends_at) >= now).slice(0, 4)
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div>
        <p className="font-display text-lg font-bold mb-1">Отметить посещение</p>
        <p className="text-ink-soft mb-3 text-sm">Откройте прошедшую встречу и отметьте, кто пришёл.</p>
        <div className="grid gap-3">{recent.map((e) => <EventTicket key={e.id} e={e} compact />)}</div>
      </div>
      <div>
        <p className="font-display text-lg font-bold mb-1">Скоро</p>
        <p className="text-ink-soft mb-3 text-sm">Создать новую встречу можно в разделе «Мероприятия».</p>
        <div className="grid gap-3">{soon.map((e) => <EventTicket key={e.id} e={e} compact />)}</div>
      </div>
    </div>
  )
}
