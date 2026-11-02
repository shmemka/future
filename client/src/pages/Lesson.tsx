import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Clock } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { Button, ButtonLink, Chip, Empty, ErrorBox, Spinner, useToast } from '../components/ui'
import { RichText, dirOf } from '../components/shared'
import { TaskBlock } from '../components/TaskBlock'

export default function Lesson() {
  const { id } = useParams()
  const q = useQuery({ queryKey: ['lesson', id], queryFn: () => api.get(`/lessons/${id}`), retry: false })
  const qc = useQueryClient()
  const toast = useToast()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)

  if (q.isLoading) return <Spinner />
  if (q.error) {
    if (q.error instanceof ApiError && q.error.code === 'not_enrolled') {
      return <Empty emoji="🔒" title="Урок откроется после записи на курс" text="Запись бесплатная и занимает секунду." action={<Button onClick={() => nav(-1)}>Вернуться к курсу</Button>} />
    }
    return <ErrorBox error={q.error} />
  }
  const l = q.data

  const complete = async () => {
    setBusy(true)
    try {
      const r = await api.post(`/lessons/${id}/complete`)
      await qc.invalidateQueries({ queryKey: ['lesson', id] })
      qc.invalidateQueries({ queryKey: ['course', l.course.slug] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      if (r.courseCompleted) toast('Курс пройден целиком! Жетоны за курс начислены', 'tokens')
      else toast('Урок пройден')
      if (l.next && !l.tasks.some((t: any) => t.submission?.status !== 'approved')) nav(`/lessons/${l.next.id}`)
    } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <div className="max-w-3xl">
      <Link to={`/courses/${l.course.slug}`} className="inline-flex items-center gap-1.5 text-ink-soft hover:text-violet font-medium"><ArrowLeft className="size-4" />{l.course.title}</Link>

      <article className="panel mt-4 p-6 sm:p-10">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Chip>{dirOf(l.course.direction).emoji} Урок {l.index + 1} из {l.total}</Chip>
          <Chip><Clock className="size-3.5" />{l.duration_min} мин</Chip>
          {l.done && <Chip tone="mint"><Check className="size-3.5" />Пройден</Chip>}
        </div>
        <h1 className="mt-4 text-3xl sm:text-[2.4rem] font-bold leading-tight">{l.title}</h1>
        <RichText text={l.body} className="mt-4" />
        {!l.done && (
          <div className="mt-8 rounded-[20px] bg-lavender/60 p-5 flex flex-wrap items-center gap-4 justify-between">
            <p className="font-medium">Дочитал(а)? Отметь урок — прогресс сохранится.</p>
            <Button onClick={complete} loading={busy} icon={<Check className="size-4" />}>Урок пройден</Button>
          </div>
        )}
      </article>

      {l.tasks.length > 0 && (
        <section className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Задание к уроку</h2>
          <div className="grid gap-4">{l.tasks.map((t: any) => <TaskBlock key={t.id} task={t} enrolled invalidate={[['lesson', id!], ['course', l.course.slug]]} />)}</div>
        </section>
      )}

      <nav className="mt-8 flex justify-between gap-3">
        {l.prev ? <ButtonLink to={`/lessons/${l.prev.id}`} variant="secondary" icon={<ArrowLeft className="size-4" />}>Назад</ButtonLink> : <span />}
        {l.next
          ? <ButtonLink to={`/lessons/${l.next.id}`} variant={l.done ? 'primary' : 'secondary'}>Следующий урок<ArrowRight className="size-4" /></ButtonLink>
          : <ButtonLink to={`/courses/${l.course.slug}`} variant="secondary">К программе курса</ButtonLink>}
      </nav>
    </div>
  )
}
