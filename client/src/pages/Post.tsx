import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Heart, Trash2, Send, MessageCircle } from 'lucide-react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { timeAgo } from '../lib/format'
import { Avatar, Button, Chip, ErrorBox, Spinner, cx, useToast } from '../components/ui'
import { PlainText, ReportButton } from '../components/shared'

export default function Post() {
  const { id } = useParams()
  const { user, isStaff } = useSession()
  const q = useQuery({ queryKey: ['post', id], queryFn: () => api.get(`/community/posts/${id}`) })
  const qc = useQueryClient()
  const toast = useToast()
  const nav = useNavigate()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} />
  const p = q.data
  const mine = p.author.id === user?.id

  const support = async () => {
    await api.post(`/community/posts/${id}/support`)
    qc.invalidateQueries({ queryKey: ['post', id] })
    qc.invalidateQueries({ queryKey: ['posts'] })
  }
  const send = async () => {
    setBusy(true)
    try {
      const r = await api.post(`/community/posts/${id}/comments`, { body: text })
      setText('')
      await qc.invalidateQueries({ queryKey: ['post', id] })
      qc.invalidateQueries({ queryKey: ['posts'] })
      if (r.status === 'pending') toast('Комментарий отправлен на проверку модератору: в нём есть слова, похожие на оскорбление.', 'error')
    } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  const removePost = async () => {
    if (!confirm('Удалить публикацию вместе с комментариями?')) return
    await api.del(`/community/posts/${id}`)
    qc.invalidateQueries({ queryKey: ['posts'] })
    toast('Публикация удалена')
    nav('/community')
  }
  const removeComment = async (cid: number) => {
    if (!confirm('Удалить комментарий?')) return
    await api.del(`/community/comments/${cid}`)
    qc.invalidateQueries({ queryKey: ['post', id] })
  }

  return (
    <div className="max-w-3xl">
      <Link to={`/community?channel=${p.channel.slug}`} className="inline-flex items-center gap-1.5 text-ink-soft hover:text-violet font-medium"><ArrowLeft className="size-4" />{p.channel.emoji} {p.channel.title}</Link>

      <article className="panel mt-4 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Link to={`/people/${p.author.id}`}><Avatar user={p.author} size={44} /></Link>
          <div className="flex-1 min-w-0">
            <Link to={`/people/${p.author.id}`} className="font-semibold hover:text-violet">{p.author.name}</Link>
            {p.author.role !== 'participant' && <span className="ml-2 text-xs font-semibold text-violet">{p.author.role === 'admin' ? 'команда проекта' : 'наставник'}</span>}
            <p className="text-sm text-ink-soft">{timeAgo(p.created_at)}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {p.kind === 'idea' && <Chip tone="gold">💡 Идея</Chip>}
          {p.kind === 'question' && <Chip>🙋 Вопрос наставникам</Chip>}
          {p.status === 'pending' && <Chip tone="gold">На модерации · {p.moderation_note || 'скоро проверим'}</Chip>}
          {p.status === 'rejected' && <Chip tone="coral">Не прошло модерацию · {p.moderation_note}</Chip>}
          {p.status === 'hidden' && <Chip tone="coral">Скрыто модератором</Chip>}
        </div>
        <h1 className="mt-3 text-2xl sm:text-3xl font-bold leading-tight">{p.title}</h1>
        <PlainText text={p.body} className="mt-4 text-[17px]" />
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button onClick={support} disabled={p.status !== 'published'} aria-pressed={p.supported}
            className={cx('inline-flex items-center gap-2 h-10 px-4 rounded-full font-semibold transition', p.supported ? 'bg-coral text-white' : 'bg-lavender text-violet-deep hover:bg-lilac/60')}>
            <Heart className={cx('size-4', p.supported && 'fill-current')} />Поддерживаю · {p.supports}
          </button>
          <span className="inline-flex items-center gap-1.5 text-ink-soft"><MessageCircle className="size-4" />{p.comments.filter((c: any) => c.status === 'published').length}</span>
          <span className="ml-auto flex items-center gap-3">
            {!mine && <ReportButton type="post" id={p.id} />}
            {(mine || isStaff) && <button onClick={removePost} className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-[#c2185b]"><Trash2 className="size-3.5" />Удалить</button>}
          </span>
        </div>
      </article>

      <section className="mt-6">
        <h2 className="text-xl font-bold mb-3">Ответы</h2>
        <ul className="grid gap-3">
          {p.comments.length === 0 && <li className="text-ink-soft">Пока никто не ответил. Будь первым!</li>}
          {p.comments.map((c: any) => (
            <li key={c.id} className={cx('card p-4 sm:p-5', c.author.role !== 'participant' && 'ring-2 ring-lavender', c.status !== 'published' && 'opacity-70')}>
              <div className="flex items-center gap-3">
                <Avatar user={c.author} size={32} />
                <p className="flex-1 min-w-0 text-sm"><span className="font-semibold">{c.author.name}</span>{c.author.role !== 'participant' && <span className="ml-2 text-xs font-semibold text-violet">{c.author.role === 'admin' ? 'команда проекта' : 'наставник'}</span>} <span className="text-ink-soft">· {timeAgo(c.created_at)}</span></p>
                {c.status === 'pending' && <Chip tone="gold">на проверке</Chip>}
                {c.status === 'hidden' && <Chip tone="coral">скрыт</Chip>}
              </div>
              <PlainText text={c.body} className="mt-2.5" />
              <div className="mt-2 flex gap-3 justify-end">
                {c.author.id !== user?.id && <ReportButton type="comment" id={c.id} />}
                {(c.author.id === user?.id || isStaff) && <button onClick={() => removeComment(c.id)} className="text-xs font-medium text-ink-soft hover:text-[#c2185b]">Удалить</button>}
              </div>
            </li>
          ))}
        </ul>
        {p.status === 'published' && (
          <div className="mt-4 card p-4 flex gap-3 items-end">
            <textarea className="field min-h-20 flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Поддержи, задай вопрос или поделись опытом" maxLength={2000} aria-label="Ваш ответ" />
            <Button onClick={send} loading={busy} disabled={text.trim().length < 2} aria-label="Отправить ответ" icon={<Send className="size-4" />}>Ответить</Button>
          </div>
        )}
      </section>
    </div>
  )
}
