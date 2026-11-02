import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, MessageCircle, Heart, Pin, Users, ShieldCheck } from 'lucide-react'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'
import { Avatar, Button, ButtonLink, Chip, Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Tabs, cx, useToast } from '../components/ui'

const KINDS = { discussion: 'Обсуждение', idea: 'Идея или проект', question: 'Вопрос наставникам' } as const

export default function Community() {
  const [sp, setSp] = useSearchParams()
  const channel = sp.get('channel') ?? ''
  const [kind, setKind] = useState<'' | keyof typeof KINDS>('')
  const [composer, setComposer] = useState(false)
  const channels = useQuery({ queryKey: ['channels'], queryFn: () => api.get<any[]>('/community/channels') })
  const posts = useQuery({
    queryKey: ['posts', channel, kind],
    queryFn: () => api.get<any[]>(`/community/posts?${new URLSearchParams({ ...(channel && { channel }), ...(kind && { kind }) })}`),
  })
  const current = channels.data?.find((c) => c.slug === channel)

  return (
    <div>
      <PageHeader
        title="Сообщество"
        text="Обсуждения по темам, вопросы наставникам и ваши идеи. Здесь критикуют идеи, а не людей."
        actions={<>
          <ButtonLink to="/people" variant="secondary" icon={<Users className="size-4" />}>Найти участников</ButtonLink>
          <Button icon={<Plus className="size-4" />} onClick={() => setComposer(true)}>Новая публикация</Button>
        </>}
      />
      <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
        <aside className="lg:sticky lg:top-20">
          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 pb-1" aria-label="Разделы">
            <ChannelBtn active={!channel} onClick={() => setSp({})} emoji="✨" title="Вся лента" />
            {channels.data?.map((c) => <ChannelBtn key={c.slug} active={channel === c.slug} onClick={() => setSp({ channel: c.slug })} emoji={c.emoji} title={c.title} count={c.posts} />)}
          </nav>
          <div className="hidden lg:flex mt-5 card p-4 gap-3 text-sm text-ink-soft">
            <ShieldCheck className="size-5 text-violet shrink-0" />
            <p>Сообщество модерируют наставники. Увидел травлю — нажми «Пожаловаться». <Link to="/safety#rules" className="text-violet font-semibold">Правила</Link></p>
          </div>
        </aside>
        <div className="min-w-0">
          {current && <div className="card p-5 mb-4"><p className="font-display text-lg font-bold">{current.emoji} {current.title}</p><p className="text-ink-soft mt-1">{current.description}</p></div>}
          <Tabs className="mb-4" value={kind} onChange={setKind} tabs={[
            { value: '', label: 'Все' }, { value: 'discussion', label: 'Обсуждения' }, { value: 'idea', label: 'Идеи' }, { value: 'question', label: 'Вопросы' },
          ]} />
          {posts.isLoading ? <Spinner /> : posts.error ? <ErrorBox error={posts.error} /> : posts.data!.length === 0 ? (
            <Empty emoji="💬" title="Здесь пока тихо" text="Начни разговор первым — задай вопрос или поделись идеей." action={<Button onClick={() => setComposer(true)}>Написать публикацию</Button>} />
          ) : (
            <div className="grid gap-3">{posts.data!.map((p) => <PostCard key={p.id} p={p} />)}</div>
          )}
        </div>
      </div>
      {composer && <Composer channels={channels.data ?? []} defaultChannel={channel} onClose={() => setComposer(false)} />}
    </div>
  )
}

function ChannelBtn({ active, onClick, emoji, title, count }: { active: boolean; onClick: () => void; emoji: string; title: string; count?: number }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={cx('shrink-0 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left font-medium transition', active ? 'bg-violet text-white' : 'bg-white lg:bg-transparent hover:bg-white text-ink')}>
      <span className="text-lg">{emoji}</span><span className="whitespace-nowrap">{title}</span>
      {count != null && <span className={cx('ml-auto text-xs pl-2', active ? 'text-white/70' : 'text-ink-soft')}>{count}</span>}
    </button>
  )
}

export function PostCard({ p }: { p: any }) {
  return (
    <Link to={`/community/post/${p.id}`} className={cx('card p-5 block hover:shadow-[var(--shadow-lift)] transition-shadow', p.status !== 'published' && 'ring-2 ring-gold/60')}>
      <div className="flex items-center gap-3">
        <Avatar user={p.author} size={36} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{p.author.name}{p.author.role !== 'participant' && <span className="ml-2 text-xs font-semibold text-violet">{p.author.role === 'admin' ? 'команда проекта' : 'наставник'}</span>}</p>
          <p className="text-xs text-ink-soft">{p.channel.emoji} {p.channel.title} · {timeAgo(p.created_at)}</p>
        </div>
        {p.pinned && <Pin className="size-4 text-violet" aria-label="Закреплено" />}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.kind !== 'discussion' && <Chip tone={p.kind === 'idea' ? 'gold' : 'lavender'}>{p.kind === 'idea' ? '💡 Идея' : '🙋 Вопрос наставникам'}</Chip>}
        {p.status === 'pending' && <Chip tone="gold">На модерации — видно только тебе</Chip>}
        {p.status === 'rejected' && <Chip tone="coral">Не прошло модерацию</Chip>}
      </div>
      <h3 className="mt-2 text-lg font-bold leading-snug">{p.title}</h3>
      <p className="mt-1.5 text-ink-soft line-clamp-3 whitespace-pre-line">{p.body}</p>
      <div className="mt-3 flex gap-4 text-sm text-ink-soft">
        <span className="inline-flex items-center gap-1"><MessageCircle className="size-4" />{p.comments_count}</span>
        <span className={cx('inline-flex items-center gap-1', p.supported && 'text-coral')}><Heart className={cx('size-4', p.supported && 'fill-current')} />{p.supports}</span>
      </div>
    </Link>
  )
}

function Composer({ channels, defaultChannel, onClose }: { channels: any[]; defaultChannel: string; onClose: () => void }) {
  const [f, setF] = useState({ channel: defaultChannel || 'obshchiy-vagon', kind: defaultChannel === 'idei' ? 'idea' : defaultChannel === 'sprosi-nastavnika' ? 'question' : 'discussion', title: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const toast = useToast()
  const qc = useQueryClient()
  const nav = useNavigate()
  const submit = async () => {
    setBusy(true); setErr('')
    try {
      const r = await api.post('/community/posts', f)
      await qc.invalidateQueries({ queryKey: ['posts'] })
      qc.invalidateQueries({ queryKey: ['channels'] })
      toast(r.status === 'pending' ? `Отправлено на модерацию. ${r.note}` : 'Опубликовано')
      onClose()
      nav(`/community/post/${r.id}`)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Новая публикация" wide>
      <div className="grid gap-4">
        <div>
          <span className="label">Что это</span>
          <div className="grid sm:grid-cols-3 gap-2">
            {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((k) => (
              <button key={k} type="button" onClick={() => setF({ ...f, kind: k, channel: k === 'idea' ? 'idei' : k === 'question' ? 'sprosi-nastavnika' : f.channel })}
                className={cx('rounded-2xl border-2 px-3 py-2.5 text-sm font-semibold text-left', f.kind === k ? 'border-violet bg-lavender/60' : 'border-lavender')}>
                {k === 'idea' ? '💡' : k === 'question' ? '🙋' : '💬'} {KINDS[k]}
              </button>
            ))}
          </div>
          {f.kind === 'idea' && <p className="mt-2 text-sm text-ink-soft">Идею посмотрит наставник. После одобрения она появится в ленте, а ты получишь 20 жетонов за инициативу.</p>}
        </div>
        <Field label="Раздел">
          <select className="field" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
            {channels.map((c) => <option key={c.slug} value={c.slug}>{c.emoji} {c.title}</option>)}
          </select>
        </Field>
        <Field label="Заголовок"><input className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} /></Field>
        <Field label="Текст" hint="Не публикуй телефоны, ники и ссылки на соцсети — для общения есть личные сообщения.">
          <textarea className="field min-h-40" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={5000} />
        </Field>
        {err && <p className="text-sm font-medium text-[#b0174f]" role="alert">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={busy} disabled={f.title.trim().length < 5 || f.body.trim().length < 20}>{f.kind === 'idea' ? 'Отправить идею' : 'Опубликовать'}</Button>
        </div>
      </div>
    </Modal>
  )
}
