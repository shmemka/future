import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, Check, Lock, Clock, Users, CalendarRange, MessageCircle, Pencil } from 'lucide-react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { Avatar, Button, ButtonLink, Chip, ErrorBox, Progress, Spinner, TokenGlyph, cx, useToast } from '../components/ui'
import { CourseCover, dirOf } from '../components/shared'
import { TaskBlock } from '../components/TaskBlock'

const LEVEL = { start: 'С нуля', middle: 'Средний', advanced: 'Продвинутый' } as const

export default function Course() {
  const { slug } = useParams()
  const { user } = useSession()
  const q = useQuery({ queryKey: ['course', slug], queryFn: () => api.get(`/courses/${slug}`) })
  const qc = useQueryClient()
  const toast = useToast()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)

  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} />
  const c = q.data
  const enrolled = !!c.enrollment
  const done = c.lessons.filter((l: any) => l.done).length
  const tasksDone = c.tasks.filter((t: any) => t.submission?.status === 'approved').length
  const progress = Math.round(((done + tasksDone) / Math.max(1, c.lessons.length + c.tasks.length)) * 100)
  const nextLesson = c.lessons.find((l: any) => !l.done) ?? c.lessons[0]
  const canEdit = user && (user.role === 'admin' || c.mentor?.id === user.id)

  const enroll = async () => {
    if (!user) return nav(`/login?next=/courses/${slug}`)
    setBusy(true)
    try {
      await api.post(`/courses/${slug}/enroll`)
      await qc.invalidateQueries({ queryKey: ['course', slug] })
      qc.invalidateQueries({ queryKey: ['courses'] })
      toast('Ты записан на курс. Начнём с первого урока!')
    } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <div>
      <Link to="/courses" className="inline-flex items-center gap-1.5 text-ink-soft hover:text-violet font-medium mb-4"><ArrowLeft className="size-4" />Все курсы</Link>

      <section className="panel overflow-hidden">
        <CourseCover direction={c.direction} className="h-40 sm:h-48" big />
        <div className="p-6 sm:p-8 grid lg:grid-cols-[1.4fr_1fr] gap-8">
          <div>
            <p className="font-semibold text-violet">{dirOf(c.direction).title}</p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-bold leading-tight">{c.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">{c.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Chip><CalendarRange className="size-3.5" />{c.duration_weeks} нед.</Chip>
              <Chip><Clock className="size-3.5" />{c.lessons.reduce((s: number, l: any) => s + l.duration_min, 0)} мин уроков</Chip>
              <Chip>Уровень: {LEVEL[c.level as keyof typeof LEVEL]}</Chip>
              <Chip><Users className="size-3.5" />{c.learners} учатся</Chip>
            </div>
          </div>
          <aside className="rounded-[22px] bg-mist p-5 self-start">
            {enrolled ? (
              <>
                <p className="font-semibold">{c.enrollment.completed_at ? 'Курс пройден 🎉' : 'Твой прогресс'}</p>
                <Progress value={c.enrollment.completed_at ? 100 : progress} className="mt-3 h-3" tone={c.enrollment.completed_at ? 'mint' : 'violet'} />
                <p className="mt-2 text-sm text-ink-soft">Уроки {done}/{c.lessons.length} · задания {tasksDone}/{c.tasks.length}</p>
                {!c.enrollment.completed_at && nextLesson && <ButtonLink to={`/lessons/${nextLesson.id}`} className="mt-4 w-full">{done ? 'Продолжить' : 'Начать первый урок'}</ButtonLink>}
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 font-display text-2xl font-bold"><TokenGlyph size={26} />{c.tokens_reward + c.tasks.reduce((s: number, t: any) => s + t.tokens_reward, 0)}</p>
                <p className="text-sm text-ink-soft mt-1">жетонов за весь курс: {c.tokens_reward} за прохождение и {c.tasks.reduce((s: number, t: any) => s + t.tokens_reward, 0)} за задания</p>
                <Button className="mt-4 w-full" onClick={enroll} loading={busy}>{user ? 'Записаться на курс' : 'Войти и записаться'}</Button>
              </>
            )}
            {c.mentor && (
              <div className="mt-5 pt-5 border-t border-lavender flex items-center gap-3">
                <Avatar user={c.mentor} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{c.mentor.name}</p>
                  <p className="text-xs text-ink-soft line-clamp-2">{c.mentor.headline}</p>
                </div>
                {user && user.id !== c.mentor.id && (
                  <Link to={`/messages/${c.mentor.id}`} className="size-10 grid place-items-center rounded-full bg-white text-violet hover:bg-lavender" aria-label="Написать наставнику" title="Написать наставнику"><MessageCircle className="size-5" /></Link>
                )}
              </div>
            )}
            {canEdit && <ButtonLink to={`/studio/${c.id}`} variant="secondary" size="sm" className="mt-4 w-full" icon={<Pencil className="size-4" />}>Редактировать курс</ButtonLink>}
          </aside>
        </div>
      </section>

      {c.outcomes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Чему научишься</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {c.outcomes.map((o: string) => (
              <li key={o} className="card p-4 flex gap-3 items-start"><span className="size-6 rounded-full bg-mint/15 text-[#0b7a5a] grid place-items-center shrink-0"><Check className="size-4" /></span><span className="font-medium">{o}</span></li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4">Программа</h2>
        <ol className="card divide-y divide-lavender overflow-hidden">
          {c.lessons.map((l: any, i: number) => {
            const inner = (
              <>
                <span className={cx('size-9 rounded-full grid place-items-center shrink-0 font-display font-bold text-sm', l.done ? 'bg-mint text-white' : enrolled ? 'bg-lavender text-violet' : 'bg-mist text-ink-soft')}>
                  {l.done ? <Check className="size-4" /> : enrolled ? i + 1 : <Lock className="size-4" />}
                </span>
                <span className="flex-1 min-w-0 font-semibold">{l.title}</span>
                <span className="text-sm text-ink-soft shrink-0">{l.duration_min} мин</span>
              </>
            )
            return (
              <li key={l.id}>
                {enrolled || (user && user.role !== 'participant')
                  ? <Link to={`/lessons/${l.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-mist">{inner}</Link>
                  : <div className="flex items-center gap-4 px-5 py-4">{inner}</div>}
              </li>
            )
          })}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4">Задания</h2>
        <div className="grid gap-4">
          {c.tasks.map((t: any) => <TaskBlock key={t.id} task={t} enrolled={enrolled} invalidate={[['course', slug!]]} />)}
        </div>
      </section>
    </div>
  )
}
