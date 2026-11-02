import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Pencil, Trash2, Eye, ListChecks, PenLine, X } from 'lucide-react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { Button, ButtonLink, ErrorBox, Field, Modal, Spinner, TokenGlyph, cx, useToast } from '../components/ui'
import { RichText } from '../components/shared'
import { DIRECTIONS, DIRECTION_KEYS } from '../../../shared/constants'

export default function Studio() {
  const { id } = useParams()
  const { isAdmin } = useSession()
  const q = useQuery({ queryKey: ['studio-course', id], queryFn: () => api.get(`/studio/courses/${id}`) })
  const [lesson, setLesson] = useState<any | null>(null)
  const [task, setTask] = useState<any | null>(null)
  const qc = useQueryClient()
  const toast = useToast()
  const nav = useNavigate()

  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} />
  const c = q.data
  const refresh = () => { qc.invalidateQueries({ queryKey: ['studio-course', id] }); qc.invalidateQueries({ queryKey: ['course', c.slug] }); qc.invalidateQueries({ queryKey: ['courses'] }) }

  const delLesson = async (lid: number) => {
    if (!confirm('Удалить урок? Прогресс участников по нему тоже удалится.')) return
    await api.del(`/studio/lessons/${lid}`); refresh(); toast('Урок удалён')
  }
  const delTask = async (tid: number) => {
    if (!confirm('Удалить задание вместе с ответами участников?')) return
    await api.del(`/studio/tasks/${tid}`); refresh(); toast('Задание удалено')
  }
  const delCourse = async () => {
    if (!confirm(`Удалить курс «${c.title}» целиком? Это действие нельзя отменить.`)) return
    await api.del(`/studio/courses/${c.id}`)
    qc.invalidateQueries({ queryKey: ['studio-courses'] })
    nav('/mentor?tab=courses')
  }

  return (
    <div className="max-w-4xl">
      <Link to="/mentor?tab=courses" className="inline-flex items-center gap-1.5 text-ink-soft hover:text-violet font-medium"><ArrowLeft className="size-4" />Курсы</Link>
      <div className="mt-3 mb-6 flex flex-wrap items-center gap-3 justify-between">
        <h1 className="text-3xl font-bold">Редактор курса</h1>
        <div className="flex gap-2">
          <ButtonLink to={`/courses/${c.slug}`} variant="secondary" icon={<Eye className="size-4" />}>Как видят участники</ButtonLink>
          {isAdmin && <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={delCourse}>Удалить</Button>}
        </div>
      </div>

      <CourseForm c={c} onSaved={refresh} />

      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-bold">Уроки</h2>
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setLesson({})}>Добавить урок</Button>
        </div>
        {c.lessons.length === 0 ? <p className="text-ink-soft">Уроков пока нет.</p> : (
          <ol className="card divide-y divide-lavender">
            {c.lessons.map((l: any, i: number) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="size-8 rounded-full bg-lavender text-violet grid place-items-center font-display font-bold text-sm">{i + 1}</span>
                <span className="flex-1 min-w-0"><span className="block font-semibold truncate">{l.title}</span><span className="text-xs text-ink-soft">{l.duration_min} мин · {l.body.length} симв.</span></span>
                <button onClick={() => setLesson(l)} className="size-9 grid place-items-center rounded-full hover:bg-lavender" aria-label="Редактировать урок"><Pencil className="size-4" /></button>
                <button onClick={() => delLesson(l.id)} className="size-9 grid place-items-center rounded-full hover:bg-coral/10 text-[#c2185b]" aria-label="Удалить урок"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-bold">Задания</h2>
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setTask({ kind: 'text' })}>Добавить задание</Button>
        </div>
        {c.tasks.length === 0 ? <p className="text-ink-soft">Заданий пока нет.</p> : (
          <ul className="card divide-y divide-lavender">
            {c.tasks.map((t: any) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="size-8 rounded-xl bg-lavender text-violet grid place-items-center">{t.kind === 'quiz' ? <ListChecks className="size-4" /> : <PenLine className="size-4" />}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">{t.title}</span>
                  <span className="text-xs text-ink-soft">{t.kind === 'quiz' ? `Тест, ${t.quiz?.length ?? 0} вопр.` : 'Ответ проверяет наставник'} · к уроку {(c.lessons.findIndex((l: any) => l.id === t.lesson_id) + 1) || '—'}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold"><TokenGlyph size={15} />{t.tokens_reward}</span>
                <button onClick={() => setTask(t)} className="size-9 grid place-items-center rounded-full hover:bg-lavender" aria-label="Редактировать задание"><Pencil className="size-4" /></button>
                <button onClick={() => delTask(t.id)} className="size-9 grid place-items-center rounded-full hover:bg-coral/10 text-[#c2185b]" aria-label="Удалить задание"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {lesson && <LessonEditor courseId={c.id} lesson={lesson} onClose={() => setLesson(null)} onSaved={refresh} />}
      {task && <TaskEditor courseId={c.id} lessons={c.lessons} task={task} onClose={() => setTask(null)} onSaved={refresh} />}
    </div>
  )
}

function CourseForm({ c, onSaved }: { c: any; onSaved: () => void }) {
  const { isAdmin } = useSession()
  const [f, setF] = useState({
    title: c.title, direction: c.direction, short: c.short, description: c.description,
    outcomes: (c.outcomes as string[]).join('\n'), level: c.level, duration_weeks: c.duration_weeks,
    tokens_reward: c.tokens_reward, published: c.published, mentor_id: c.mentor_id,
  })
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const save = async () => {
    setBusy(true)
    try {
      await api.put(`/studio/courses/${c.id}`, { ...f, outcomes: f.outcomes.split('\n').map((s: string) => s.trim()).filter(Boolean), mentor_id: f.mentor_id ? Number(f.mentor_id) : undefined })
      toast('Курс сохранён'); onSaved()
    } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  return (
    <section className="panel p-6 sm:p-8 grid gap-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Название"><input className="field" value={f.title} onChange={set('title')} /></Field>
        <Field label="Направление">
          <select className="field" value={f.direction} onChange={set('direction')}>{DIRECTION_KEYS.map((k) => <option key={k} value={k}>{DIRECTIONS[k].emoji} {DIRECTIONS[k].title}</option>)}</select>
        </Field>
      </div>
      <Field label="Коротко"><input className="field" value={f.short} onChange={set('short')} /></Field>
      <Field label="Описание"><textarea className="field min-h-28" value={f.description} onChange={set('description')} /></Field>
      <Field label="Чему научится участник" hint="Каждый результат с новой строки"><textarea className="field min-h-24" value={f.outcomes} onChange={set('outcomes')} /></Field>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label="Уровень"><select className="field" value={f.level} onChange={set('level')}><option value="start">С нуля</option><option value="middle">Средний</option><option value="advanced">Продвинутый</option></select></Field>
        <Field label="Недель"><input className="field" type="number" min={1} max={20} value={f.duration_weeks} onChange={set('duration_weeks')} /></Field>
        <Field label="Жетонов за курс"><input className="field" type="number" min={0} max={100} value={f.tokens_reward} onChange={set('tokens_reward')} /></Field>
        {isAdmin && c.mentors?.length > 0 && (
          <Field label="Наставник"><select className="field" value={f.mentor_id ?? ''} onChange={set('mentor_id')}>{c.mentors.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={f.published} onChange={set('published')} className="size-4 accent-[#5a1fe0]" />Опубликован в каталоге</label>
        <Button onClick={save} loading={busy}>Сохранить курс</Button>
      </div>
    </section>
  )
}

function LessonEditor({ courseId, lesson, onClose, onSaved }: { courseId: number; lesson: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: lesson.title ?? '', body: lesson.body ?? '', duration_min: lesson.duration_min ?? 10, position: lesson.position ?? 0 })
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    setBusy(true); setErr('')
    try {
      if (lesson.id) await api.put(`/studio/lessons/${lesson.id}`, f)
      else await api.post(`/studio/courses/${courseId}/lessons`, f)
      onSaved(); onClose()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={lesson.id ? 'Редактировать урок' : 'Новый урок'} wide>
      <div className="grid gap-4">
        <div className="grid grid-cols-[1fr_120px] gap-4">
          <Field label="Название"><input className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Минут"><input className="field" type="number" min={1} value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: Number(e.target.value) })} /></Field>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="label !mb-0">Текст урока</span>
            <button type="button" onClick={() => setPreview(!preview)} className="text-sm font-semibold text-violet">{preview ? 'Редактировать' : 'Предпросмотр'}</button>
          </div>
          {preview ? <div className="rounded-2xl border-2 border-lavender p-5 max-h-[50vh] overflow-y-auto"><RichText text={f.body || 'Пусто'} /></div> : (
            <textarea className="field min-h-72 font-mono text-sm" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          )}
          <p className="mt-1.5 text-xs text-ink-soft">Абзацы разделяйте пустой строкой. «## » — подзаголовок, «- » — пункт списка, «{'> '}» — выделенная мысль.</p>
        </div>
        {err && <p className="text-sm font-medium text-[#b0174f]">{err}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Отмена</Button><Button onClick={save} loading={busy}>Сохранить урок</Button></div>
      </div>
    </Modal>
  )
}

type QuizItem = { q: string; options: string[]; answer: number }

function TaskEditor({ courseId, lessons, task, onClose, onSaved }: { courseId: number; lessons: any[]; task: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    title: task.title ?? '', prompt: task.prompt ?? '', kind: task.kind ?? 'text',
    lesson_id: task.lesson_id ?? lessons[lessons.length - 1]?.id ?? null, tokens_reward: task.tokens_reward ?? 10,
  })
  const [quiz, setQuiz] = useState<QuizItem[]>(task.quiz ?? [{ q: '', options: ['', ''], answer: 0 }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (f.kind === 'quiz' && !quiz.length) setQuiz([{ q: '', options: ['', ''], answer: 0 }]) }, [f.kind])

  const updQ = (i: number, patch: Partial<QuizItem>) => setQuiz(quiz.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const save = async () => {
    setBusy(true); setErr('')
    try {
      const body = { ...f, lesson_id: f.lesson_id ? Number(f.lesson_id) : null, quiz: f.kind === 'quiz' ? quiz : null }
      if (task.id) await api.put(`/studio/tasks/${task.id}`, body)
      else await api.post(`/studio/courses/${courseId}/tasks`, body)
      onSaved(); onClose()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={task.id ? 'Редактировать задание' : 'Новое задание'} wide>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-2">
          {(['text', 'quiz'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setF({ ...f, kind: k })} className={cx('rounded-2xl border-2 px-4 py-3 text-left', f.kind === k ? 'border-violet bg-lavender/60' : 'border-lavender')}>
              <span className="block font-semibold">{k === 'text' ? 'Развёрнутый ответ' : 'Тест'}</span>
              <span className="text-xs text-ink-soft">{k === 'text' ? 'Проверяет наставник' : 'Проверяется автоматически'}</span>
            </button>
          ))}
        </div>
        <Field label="Название"><input className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Формулировка"><textarea className="field min-h-24" value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="К уроку">
            <select className="field" value={f.lesson_id ?? ''} onChange={(e) => setF({ ...f, lesson_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Ко всему курсу</option>
              {lessons.map((l, i) => <option key={l.id} value={l.id}>{i + 1}. {l.title}</option>)}
            </select>
          </Field>
          <Field label="Жетонов"><input className="field" type="number" min={0} max={50} value={f.tokens_reward} onChange={(e) => setF({ ...f, tokens_reward: Number(e.target.value) })} /></Field>
        </div>
        {f.kind === 'quiz' && (
          <div className="grid gap-4">
            {quiz.map((item, i) => (
              <div key={i} className="rounded-2xl bg-mist p-4">
                <div className="flex gap-2 items-start">
                  <input className="field" value={item.q} onChange={(e) => updQ(i, { q: e.target.value })} placeholder={`Вопрос ${i + 1}`} />
                  {quiz.length > 1 && <button type="button" onClick={() => setQuiz(quiz.filter((_, j) => j !== i))} className="size-11 shrink-0 grid place-items-center rounded-full hover:bg-white" aria-label="Удалить вопрос"><X className="size-4" /></button>}
                </div>
                <div className="mt-3 grid gap-2">
                  {item.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="radio" name={`ans-${i}`} checked={item.answer === oi} onChange={() => updQ(i, { answer: oi })} className="size-4 accent-[#19c995]" aria-label="Верный ответ" />
                      <input className="field !py-2" value={o} onChange={(e) => updQ(i, { options: item.options.map((x, k) => (k === oi ? e.target.value : x)) })} placeholder={`Вариант ${oi + 1}`} />
                      {item.options.length > 2 && <button type="button" onClick={() => updQ(i, { options: item.options.filter((_, k) => k !== oi), answer: item.answer >= oi && item.answer > 0 ? item.answer - 1 : item.answer })} className="size-9 grid place-items-center rounded-full hover:bg-white" aria-label="Удалить вариант"><X className="size-4" /></button>}
                    </div>
                  ))}
                  {item.options.length < 6 && <button type="button" onClick={() => updQ(i, { options: [...item.options, ''] })} className="text-sm font-semibold text-violet text-left">+ вариант</button>}
                </div>
                <p className="mt-2 text-xs text-ink-soft">Отметьте кружком верный ответ</p>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => setQuiz([...quiz, { q: '', options: ['', ''], answer: 0 }])} className="w-fit" icon={<Plus className="size-4" />}>Вопрос</Button>
          </div>
        )}
        {err && <p className="text-sm font-medium text-[#b0174f]">{err}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Отмена</Button><Button onClick={save} loading={busy}>Сохранить задание</Button></div>
      </div>
    </Modal>
  )
}

