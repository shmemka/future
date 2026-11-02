import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, MessageCircle, MapPin, ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { Avatar, ButtonLink, Chip, Empty, ErrorBox, PageHeader, Spinner, Tabs, cx } from '../components/ui'
import { ReportButton, dirOf } from '../components/shared'
import { ACHIEVEMENTS, DIRECTIONS, DIRECTION_KEYS, ROLE_TITLES } from '../../../shared/constants'

export default function People() {
  const [sp] = useSearchParams()
  const [role, setRole] = useState<'' | 'participant' | 'mentor'>((sp.get('role') as 'mentor') ?? '')
  const [interest, setInterest] = useState('')
  const [search, setSearch] = useState('')
  const params = new URLSearchParams({ ...(role && { role }), ...(interest && { interest }), ...(search && { q: search }) })
  const q = useQuery({ queryKey: ['people', role, interest, search], queryFn: () => api.get<any[]>(`/people?${params}`) })

  return (
    <div>
      <PageHeader title="Участники и наставники" text="Находи единомышленников по интересам и пиши наставникам. Контакты вне платформы не публикуются — общение остаётся здесь." />
      <div className="flex flex-col md:flex-row gap-3 md:items-center mb-4">
        <Tabs value={role} onChange={setRole} tabs={[{ value: '', label: 'Все' }, { value: 'mentor', label: 'Наставники' }, { value: 'participant', label: 'Участники' }]} />
        <div className="relative md:ml-auto md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-soft" />
          <input className="field pl-10" placeholder="Имя или город" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск" />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap mb-6">
        <button onClick={() => setInterest('')} className={cx('shrink-0 rounded-full px-3.5 h-9 text-sm font-semibold', !interest ? 'bg-violet text-white' : 'bg-white shadow-[var(--shadow-soft)] text-ink-soft')}>Любые интересы</button>
        {DIRECTION_KEYS.map((k) => (
          <button key={k} onClick={() => setInterest(k)} className={cx('shrink-0 rounded-full px-3.5 h-9 text-sm font-semibold', interest === k ? 'bg-violet text-white' : 'bg-white shadow-[var(--shadow-soft)] text-ink-soft')}>{DIRECTIONS[k].emoji} {DIRECTIONS[k].short}</button>
        ))}
      </div>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : q.data!.length === 0 ? <Empty emoji="🔍" title="Никого не нашли" text="Попробуй другой интерес или очисти поиск." /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {q.data!.map((u) => (
            <div key={u.id} className="card p-5 flex flex-col">
              <Link to={`/people/${u.id}`} className="flex items-center gap-3">
                <Avatar user={u} size={48} />
                <span className="min-w-0">
                  <span className="block font-semibold truncate">{u.name}</span>
                  <span className="block text-sm text-ink-soft truncate">{u.role === 'mentor' ? u.headline || 'Наставник' : u.city || 'Участник'}</span>
                </span>
              </Link>
              <div className="mt-3 flex flex-wrap gap-1.5">{u.interests.slice(0, 3).map((k: string) => <Chip key={k}>{dirOf(k).emoji} {dirOf(k).short}</Chip>)}</div>
              <div className="mt-auto pt-4 flex gap-2">
                <ButtonLink to={`/people/${u.id}`} variant="secondary" size="sm">Профиль</ButtonLink>
                {(u.role === 'mentor' || u.allow_messages) && <ButtonLink to={`/messages/${u.id}`} size="sm" icon={<MessageCircle className="size-4" />}>Написать</ButtonLink>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Person() {
  const { id } = useParams()
  const { user } = useSession()
  const q = useQuery({ queryKey: ['person', id], queryFn: () => api.get(`/people/${id}`) })
  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} />
  const u = q.data
  const me = user?.id === u.id
  const canWrite = !me && (u.role !== 'participant' || u.allow_messages || user?.role !== 'participant')
  return (
    <div className="max-w-3xl">
      <Link to="/people" className="inline-flex items-center gap-1.5 text-ink-soft hover:text-violet font-medium"><ArrowLeft className="size-4" />Участники и наставники</Link>
      <section className="panel mt-4 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar user={u} size={88} />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">{u.name}</h1>
            <p className="mt-1 text-ink-soft flex flex-wrap gap-x-3">
              <span>{ROLE_TITLES[u.role as keyof typeof ROLE_TITLES]}{u.level ? ` · станция «${u.level}»` : ''}</span>
              {u.city && <span className="inline-flex items-center gap-1"><MapPin className="size-4" />{u.city}</span>}
            </p>
            {u.headline && <p className="mt-1 font-medium">{u.headline}</p>}
          </div>
          {canWrite && <ButtonLink to={`/messages/${u.id}`} icon={<MessageCircle className="size-4" />}>Написать</ButtonLink>}
          {me && <ButtonLink to="/me" variant="secondary">Мой кабинет</ButtonLink>}
        </div>
        {u.bio && <p className="mt-5 leading-relaxed">{u.bio}</p>}
        <div className="mt-4 flex flex-wrap gap-2">{u.interests.map((k: string) => <Chip key={k}>{dirOf(k).emoji} {dirOf(k).short}</Chip>)}</div>
        {u.achievements.length > 0 && (
          <div className="mt-6">
            <p className="font-semibold mb-2">Достижения</p>
            <div className="flex flex-wrap gap-2">
              {ACHIEVEMENTS.filter((a) => u.achievements.includes(a.code)).map((a) => <span key={a.code} title={a.desc} className="inline-flex items-center gap-1.5 rounded-full bg-gold/25 px-3 py-1 text-sm font-semibold text-[#7a5200]">{a.emoji} {a.title}</span>)}
            </div>
          </div>
        )}
        {u.courses.length > 0 && (
          <div className="mt-6">
            <p className="font-semibold mb-2">{u.role === 'mentor' ? 'Ведёт курсы' : 'Прошёл курсы'}</p>
            <div className="flex flex-wrap gap-2">{u.courses.map((c: any) => <Link key={c.slug} to={`/courses/${c.slug}`} className="rounded-full bg-lavender px-3 py-1.5 text-sm font-semibold hover:bg-lilac/60">{dirOf(c.direction).emoji} {c.title}</Link>)}</div>
          </div>
        )}
        {u.ideas.length > 0 && (
          <div className="mt-6">
            <p className="font-semibold mb-2">Идеи и проекты</p>
            <ul className="grid gap-1.5">{u.ideas.map((i: any) => <li key={i.id}><Link to={`/community/post/${i.id}`} className="text-violet font-medium hover:underline">💡 {i.title}</Link></li>)}</ul>
          </div>
        )}
        {!me && <div className="mt-6 pt-4 border-t border-lavender"><ReportButton type="user" id={u.id}>Пожаловаться на профиль</ReportButton></div>}
      </section>
    </div>
  )
}
