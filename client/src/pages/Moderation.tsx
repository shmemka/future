import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X, EyeOff, Ban } from 'lucide-react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { timeAgo } from '../lib/format'
import { Button, Chip, Empty, ErrorBox, PageHeader, Spinner, Tabs, cx, useToast } from '../components/ui'
import { PlainText } from '../components/shared'

type Tab = 'posts' | 'comments' | 'reports' | 'help'

export default function Moderation() {
  const [sp, setSp] = useSearchParams()
  const tab = (sp.get('tab') as Tab) || 'posts'
  const q = useQuery({ queryKey: ['moderation'], queryFn: () => api.get('/moderation'), refetchInterval: 20_000 })
  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} />
  const d = q.data
  const openReports = d.reports.filter((r: any) => r.status === 'open').length
  const newHelp = d.help.filter((h: any) => h.status === 'new').length

  return (
    <div>
      <PageHeader title="Модерация" text="Публикации на проверке, жалобы и обращения за помощью. Обращения к психологу — в приоритете." />
      <Tabs className="mb-6" value={tab} onChange={(t) => setSp({ tab: t })} tabs={[
        { value: 'posts', label: 'Публикации', count: d.posts.length },
        { value: 'comments', label: 'Комментарии', count: d.comments.length },
        { value: 'reports', label: 'Жалобы', count: openReports },
        { value: 'help', label: 'Обращения', count: newHelp },
      ]} />
      {tab === 'posts' && (d.posts.length ? <div className="grid gap-4">{d.posts.map((p: any) => <PendingPost key={p.id} p={p} />)}</div> : <Empty emoji="✅" title="Все публикации проверены" />)}
      {tab === 'comments' && (d.comments.length ? <div className="grid gap-4">{d.comments.map((c: any) => <PendingComment key={c.id} c={c} />)}</div> : <Empty emoji="✅" title="Нет комментариев на проверке" />)}
      {tab === 'reports' && (d.reports.length ? <div className="grid gap-4">{d.reports.map((r: any) => <Report key={r.id} r={r} />)}</div> : <Empty emoji="🕊️" title="Жалоб нет" />)}
      {tab === 'help' && (d.help.length ? <div className="grid gap-4">{d.help.map((h: any) => <Help key={h.id} h={h} />)}</div> : <Empty emoji="💜" title="Обращений нет" />)}
    </div>
  )
}

function useAct() {
  const qc = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const act = async (key: string, url: string, body: any, msg: string) => {
    setBusy(key)
    try {
      await api.post(url, body)
      toast(msg)
      qc.invalidateQueries({ queryKey: ['moderation'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['posts'] })
    } catch (e: any) { toast(e.message, 'error') } finally { setBusy(null) }
  }
  return { act, busy }
}

function PendingPost({ p }: { p: any }) {
  const [note, setNote] = useState('')
  const { act, busy } = useAct()
  return (
    <article className="card p-5 sm:p-6">
      <div className="flex flex-wrap gap-2 items-center">
        <Chip tone={p.kind === 'idea' ? 'gold' : 'lavender'}>{p.kind === 'idea' ? '💡 Идея' : p.kind === 'question' ? '🙋 Вопрос' : '💬 Обсуждение'}</Chip>
        <span className="text-sm text-ink-soft">{p.channel} · {p.author} · {timeAgo(p.created_at)}</span>
      </div>
      {p.moderation_note && <p className="mt-2 text-sm font-medium text-[#7a5200]">{p.moderation_note}</p>}
      <h3 className="mt-3 text-lg font-bold">{p.title}</h3>
      <PlainText text={p.body} className="mt-2 text-ink-soft" />
      <input className="field mt-4" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий автору при отклонении (необязательно)" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => act('ok', `/moderation/posts/${p.id}`, { action: 'approve' }, p.kind === 'idea' ? 'Идея одобрена, автору начислено 20 жетонов' : 'Опубликовано')} loading={busy === 'ok'} icon={<Check className="size-4" />}>
          {p.kind === 'idea' ? 'Одобрить идею (+20)' : 'Опубликовать'}
        </Button>
        <Button variant="danger" onClick={() => act('no', `/moderation/posts/${p.id}`, { action: 'reject', note }, 'Публикация отклонена, автор получил уведомление')} loading={busy === 'no'} icon={<X className="size-4" />}>Отклонить</Button>
      </div>
    </article>
  )
}

function PendingComment({ c }: { c: any }) {
  const { act, busy } = useAct()
  return (
    <article className="card p-5">
      <p className="text-sm text-ink-soft">{c.author} в <Link to={`/community/post/${c.post_id}`} className="text-violet font-semibold">«{c.post_title}»</Link> · {timeAgo(c.created_at)}</p>
      <p className="mt-2 rounded-2xl bg-mist p-3">{c.body}</p>
      <p className="mt-2 text-xs text-ink-soft">Автомодерация: найдены слова, похожие на оскорбление</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => act('ok', `/moderation/comments/${c.id}`, { action: 'approve' }, 'Комментарий опубликован')} loading={busy === 'ok'}>Это нормально, опубликовать</Button>
        <Button size="sm" variant="danger" onClick={() => act('hide', `/moderation/comments/${c.id}`, { action: 'hide' }, 'Комментарий скрыт')} loading={busy === 'hide'} icon={<EyeOff className="size-4" />}>Скрыть</Button>
      </div>
    </article>
  )
}

const TARGET = { post: 'Публикация', comment: 'Комментарий', message: 'Личное сообщение', user: 'Профиль' } as const

function Report({ r }: { r: any }) {
  const { isAdmin } = useSession()
  const [resolution, setResolution] = useState(r.resolution ?? '')
  const [block, setBlock] = useState(false)
  const { act, busy } = useAct()
  const open = r.status === 'open'
  return (
    <article className={cx('card p-5 sm:p-6', !open && 'opacity-70')}>
      <div className="flex flex-wrap gap-2 items-center">
        <Chip tone={open ? 'coral' : 'lavender'}>{r.reason}</Chip>
        <Chip>{TARGET[r.target_type as keyof typeof TARGET]}</Chip>
        {!open && <Chip tone={r.status === 'resolved' ? 'mint' : 'lavender'}>{r.status === 'resolved' ? 'Меры приняты' : 'Отклонена'}</Chip>}
        <span className="text-sm text-ink-soft ml-auto">от {r.reporter} · {timeAgo(r.created_at)}</span>
      </div>
      {r.details && <p className="mt-3"><span className="font-semibold">Комментарий заявителя: </span>{r.details}</p>}
      {r.target ? (
        <div className="mt-3 rounded-2xl bg-mist p-4">
          <p className="text-sm text-ink-soft">Автор: <span className="font-semibold text-ink">{r.target.author}</span>{r.target.status !== 'published' && r.target.status !== 'active' && ` · сейчас: ${r.target.status}`}</p>
          <PlainText text={r.target.text} className="mt-1.5" />
          {r.target.link && <Link to={r.target.link} className="mt-2 inline-block text-sm text-violet font-semibold">Открыть в контексте</Link>}
        </div>
      ) : <p className="mt-3 text-ink-soft">Объект жалобы уже удалён.</p>}
      {open && (
        <>
          <input className="field mt-4" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Решение — для журнала модерации" />
          {isAdmin && <label className="mt-3 flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} className="size-4 accent-[#c2185b]" /><Ban className="size-4 text-[#c2185b]" />Заблокировать автора</label>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => act('hide', `/moderation/reports/${r.id}`, { status: 'resolved', resolution, hideTarget: true, blockAuthor: block }, 'Контент скрыт, заявитель получил ответ')} loading={busy === 'hide'} icon={<EyeOff className="size-4" />}>Скрыть и закрыть жалобу</Button>
            <Button variant="secondary" onClick={() => act('ok', `/moderation/reports/${r.id}`, { status: 'resolved', resolution, blockAuthor: block }, 'Жалоба закрыта')} loading={busy === 'ok'}>Меры приняты без скрытия</Button>
            <Button variant="ghost" onClick={() => act('no', `/moderation/reports/${r.id}`, { status: 'dismissed', resolution }, 'Жалоба отклонена')} loading={busy === 'no'}>Нарушений нет</Button>
          </div>
        </>
      )}
      {!open && r.resolution && <p className="mt-3 text-sm"><span className="font-semibold">Решение: </span>{r.resolution}</p>}
    </article>
  )
}

const ADDR = { psychologist: 'Психологу', mentor: 'Наставнику', moderator: 'Модератору' } as const

function Help({ h }: { h: any }) {
  const [response, setResponse] = useState(h.response ?? '')
  const { act, busy } = useAct()
  return (
    <article className={cx('card p-5 sm:p-6', h.status === 'new' && h.addressee === 'psychologist' && 'ring-2 ring-coral/50', h.status === 'closed' && 'opacity-70')}>
      <div className="flex flex-wrap gap-2 items-center">
        <Chip tone={h.addressee === 'psychologist' ? 'coral' : 'lavender'}>{ADDR[h.addressee as keyof typeof ADDR]}</Chip>
        <Chip tone={h.status === 'new' ? 'gold' : h.status === 'closed' ? 'mint' : 'lavender'}>{h.status === 'new' ? 'Новое' : h.status === 'closed' ? 'Закрыто' : 'В работе'}</Chip>
        <span className="text-sm text-ink-soft ml-auto">{h.user_name}{h.city ? `, ${h.city}` : ''} · {timeAgo(h.created_at)}</span>
      </div>
      <h3 className="mt-3 font-bold text-lg">{h.topic}</h3>
      <PlainText text={h.body} className="mt-1.5" />
      {h.status !== 'closed' ? (
        <>
          <textarea className="field mt-4 min-h-24" value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Ответ придёт автору в уведомления. Если ситуация серьёзная — предложите встречу с психологом лично." />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => act('send', `/moderation/help/${h.id}`, { status: 'in_progress', response }, 'Ответ отправлен')} loading={busy === 'send'} disabled={!response.trim()}>Ответить</Button>
            <Button variant="secondary" onClick={() => act('close', `/moderation/help/${h.id}`, { status: 'closed', response }, 'Обращение закрыто')} loading={busy === 'close'}>Закрыть обращение</Button>
            {h.user_id && <Link to={`/messages/${h.user_id}`} className="inline-flex items-center h-11 px-4 font-semibold text-violet">Написать в личные сообщения</Link>}
          </div>
        </>
      ) : h.response && <p className="mt-3 rounded-2xl bg-lavender/60 p-3 text-sm"><span className="font-semibold">Ответ: </span>{h.response}</p>}
    </article>
  )
}
