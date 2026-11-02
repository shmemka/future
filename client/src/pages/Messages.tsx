import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { fmtTime, timeAgo, parseDb, fmtDate } from '../lib/format'
import { Avatar, Button, ButtonLink, Empty, ErrorBox, Spinner, cx, useToast } from '../components/ui'
import { ReportButton } from '../components/shared'

export default function Messages() {
  const { userId } = useParams()
  const convs = useQuery({ queryKey: ['convs'], queryFn: () => api.get<any[]>('/messages'), refetchInterval: 10_000 })
  return (
    <div className="pt-2">
      <h1 className={cx('text-[1.75rem] sm:text-4xl font-bold mb-5', userId && 'hidden lg:block')}>Сообщения</h1>
      <div className="lg:grid lg:grid-cols-[320px_1fr] gap-5 items-start">
        <aside className={cx(userId && 'hidden lg:block')}>
          {convs.isLoading ? <Spinner /> : convs.error ? <ErrorBox error={convs.error} /> : convs.data!.length === 0 ? (
            <Empty emoji="✉️" title="Пока нет переписок" text="Напиши наставнику — они отвечают в течение суток." action={<ButtonLink to="/people?role=mentor">Найти наставника</ButtonLink>} />
          ) : (
            <ul className="card divide-y divide-lavender overflow-hidden">
              {convs.data!.map((c) => (
                <li key={c.user.id}>
                  <Link to={`/messages/${c.user.id}`} className={cx('flex items-center gap-3 px-4 py-3.5 hover:bg-mist', String(c.user.id) === userId && 'bg-lavender/60')}>
                    <Avatar user={c.user} size={44} />
                    <span className="flex-1 min-w-0">
                      <span className="flex justify-between gap-2"><span className="font-semibold truncate">{c.user.name}</span><span className="text-xs text-ink-soft shrink-0">{timeAgo(c.last.created_at)}</span></span>
                      <span className="flex justify-between gap-2 mt-0.5">
                        <span className={cx('text-sm truncate', c.unread ? 'text-ink font-medium' : 'text-ink-soft')}>{c.last.body}</span>
                        {c.unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-coral text-white text-[11px] font-bold grid place-items-center shrink-0">{c.unread}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <div className={cx(!userId && 'hidden lg:block')}>
          {userId ? <Thread key={userId} userId={Number(userId)} /> : (
            <div className="panel p-10 text-center text-ink-soft">
              <p className="text-4xl mb-3">💬</p>
              <p>Выбери переписку слева или начни новую из профиля участника или наставника.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Thread({ userId }: { userId: number }) {
  const { user } = useSession()
  const q = useQuery({ queryKey: ['thread', userId], queryFn: () => api.get(`/messages/${userId}`), refetchInterval: 5_000 })
  const qc = useQueryClient()
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  const count = q.data?.messages.length ?? 0
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); qc.invalidateQueries({ queryKey: ['convs'] }); qc.invalidateQueries({ queryKey: ['me'] }) }, [count])

  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} />
  const other = q.data.user
  const send = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      await api.post(`/messages/${userId}`, { body: text })
      setText('')
      await qc.invalidateQueries({ queryKey: ['thread', userId] })
    } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  let lastDay = ''
  return (
    <div className="panel flex flex-col h-[calc(100dvh-11rem)] lg:h-[calc(100dvh-9rem)] overflow-hidden">
      <header className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-lavender">
        <Link to="/messages" className="lg:hidden size-9 grid place-items-center rounded-full hover:bg-lavender" aria-label="К списку"><ArrowLeft className="size-5" /></Link>
        <Link to={`/people/${other.id}`} className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar user={other} size={40} />
          <span className="min-w-0"><span className="block font-semibold truncate">{other.name}</span><span className="block text-xs text-ink-soft truncate">{other.role === 'participant' ? 'Участник' : other.headline || 'Наставник'}</span></span>
        </Link>
        <ReportButton type="user" id={other.id}>Пожаловаться</ReportButton>
      </header>
      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 bg-mist/60">
        <p className="mx-auto max-w-md mb-4 text-center text-xs text-ink-soft flex items-center justify-center gap-1.5"><ShieldCheck className="size-4 text-violet" />Контакты и ссылки на соцсети в сообщениях блокируются. Если что-то тревожит — пожалуйся, модератор поможет.</p>
        {q.data.messages.length === 0 && <p className="text-center text-ink-soft mt-10">Напиши первое сообщение 👋</p>}
        <ul className="grid gap-2">
          {q.data.messages.map((m: any) => {
            const mine = m.sender_id === user?.id
            const day = fmtDate(m.created_at)
            const showDay = day !== lastDay
            lastDay = day
            return (
              <li key={m.id}>
                {showDay && <p className="text-center text-xs font-semibold text-ink-soft my-3">{parseDb(m.created_at).toDateString() === new Date().toDateString() ? 'Сегодня' : day}</p>}
                <div className={cx('group flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={cx('max-w-[80%] rounded-[20px] px-4 py-2.5', mine ? 'bg-violet text-white rounded-br-md' : 'bg-white rounded-bl-md shadow-[var(--shadow-soft)]')}>
                    <p className="whitespace-pre-line break-words">{m.body}</p>
                    <p className={cx('mt-1 text-[11px] flex gap-3 justify-end', mine ? 'text-white/70' : 'text-ink-soft')}>
                      {!mine && <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition"><ReportButton type="message" id={m.id} className="!text-[11px]">жалоба</ReportButton></span>}
                      {fmtTime(m.created_at)}{mine && m.read_at && ' · прочитано'}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        <div ref={bottom} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex gap-2 p-3 border-t border-lavender bg-white">
        <textarea className="field !rounded-2xl min-h-12 max-h-32 flex-1 resize-none" rows={1} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Сообщение" maxLength={2000} aria-label="Сообщение" />
        <Button type="submit" loading={busy} disabled={!text.trim()} aria-label="Отправить" className="!px-4 self-end"><Send className="size-4" /></Button>
      </form>
    </div>
  )
}
