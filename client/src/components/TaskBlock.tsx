import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, RotateCcw, ListChecks, PenLine } from 'lucide-react'
import { api } from '../lib/api'
import { Button, Chip, TokenGlyph, cx, useToast } from './ui'

const STATUS = {
  approved: { label: 'Зачтено', tone: 'mint' as const, icon: CheckCircle2 },
  pending: { label: 'На проверке у наставника', tone: 'gold' as const, icon: Clock },
  revision: { label: 'Нужно доработать', tone: 'coral' as const, icon: RotateCcw },
}

export function TaskBlock({ task, enrolled, invalidate }: { task: any; enrolled: boolean; invalidate: string[][] }) {
  const sub = task.submission
  const status = sub?.status as keyof typeof STATUS | undefined
  const [open, setOpen] = useState(false)
  const [answer, setAnswer] = useState(sub?.answer && task.kind === 'text' ? sub.answer : '')
  const [picks, setPicks] = useState<(number | null)[]>(() => (task.quiz ?? []).map(() => null))
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const qc = useQueryClient()

  const submit = async () => {
    setBusy(true)
    try {
      const body = task.kind === 'quiz' ? { answers: picks } : { answer }
      const r = await api.post(`/tasks/${task.id}/submit`, body)
      if (r.status === 'approved') toast(`Тест пройден! +${task.tokens_reward} жетонов`, 'tokens')
      else if (r.status === 'revision') toast(`Верно ${r.score} из ${r.total}. Попробуй ещё раз`, 'error')
      else toast('Ответ отправлен наставнику. Обычно проверка занимает до двух дней.')
      if (r.courseCompleted) toast('Курс пройден целиком! Жетоны за курс начислены', 'tokens')
      for (const k of invalidate) await qc.invalidateQueries({ queryKey: k })
      qc.invalidateQueries({ queryKey: ['me'] })
      setOpen(false)
      if (task.kind === 'quiz') setPicks((task.quiz ?? []).map(() => null))
    } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  const S = status ? STATUS[status] : null
  const canSubmit = enrolled && status !== 'approved' && (status !== 'pending' || task.kind === 'quiz')

  return (
    <div className={cx('rounded-[20px] border-2 p-5', status === 'approved' ? 'border-mint/40 bg-mint/5' : 'border-lavender bg-white')}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="size-10 rounded-xl bg-lavender text-violet grid place-items-center shrink-0">
          {task.kind === 'quiz' ? <ListChecks className="size-5" /> : <PenLine className="size-5" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-violet">{task.kind === 'quiz' ? 'Тест — проверяется автоматически' : 'Задание — проверяет наставник'}</p>
          <h3 className="font-bold text-lg leading-snug mt-0.5">{task.title}</h3>
        </div>
        <span className="inline-flex items-center gap-1 font-semibold"><TokenGlyph size={16} />{task.tokens_reward}</span>
      </div>
      <p className="mt-3 text-ink-soft leading-relaxed">{task.prompt}</p>

      {S && (
        <div className="mt-3">
          <Chip tone={S.tone}><S.icon className="size-3.5" />{S.label}</Chip>
          {sub.feedback && <p className="mt-2 rounded-2xl bg-mist p-3 text-sm"><span className="font-semibold">Комментарий: </span>{sub.feedback}</p>}
        </div>
      )}

      {!enrolled && <p className="mt-3 text-sm text-ink-soft">Запишись на курс, чтобы выполнить задание.</p>}

      {canSubmit && !open && (
        <Button className="mt-4" variant={status === 'revision' ? 'primary' : 'secondary'} onClick={() => setOpen(true)}>
          {task.kind === 'quiz' ? (status ? 'Пройти тест ещё раз' : 'Начать тест') : status === 'revision' ? 'Доработать ответ' : 'Написать ответ'}
        </Button>
      )}

      {open && task.kind === 'quiz' && (
        <div className="mt-5 grid gap-5">
          {task.quiz.map((item: any, qi: number) => (
            <fieldset key={qi}>
              <legend className="font-semibold mb-2">{qi + 1}. {item.q}</legend>
              <div className="grid gap-2">
                {item.options.map((o: string, oi: number) => (
                  <label key={oi} className={cx('flex items-center gap-3 rounded-2xl border-2 px-4 py-2.5 cursor-pointer transition', picks[qi] === oi ? 'border-violet bg-lavender/60' : 'border-lavender hover:border-lilac')}>
                    <input type="radio" name={`q-${task.id}-${qi}`} checked={picks[qi] === oi} onChange={() => setPicks(picks.map((p, i) => (i === qi ? oi : p)))} className="accent-[#5a1fe0]" />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="flex gap-2">
            <Button onClick={submit} loading={busy} disabled={picks.some((p) => p === null)}>Проверить ответы</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
          </div>
        </div>
      )}

      {open && task.kind === 'text' && (
        <div className="mt-4">
          <textarea className="field min-h-40" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Твой ответ. Не указывай контакты и фамилии других людей." maxLength={4000} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button onClick={submit} loading={busy} disabled={answer.trim().length < 20}>Отправить наставнику</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
            <span className="ml-auto text-xs text-ink-soft">{answer.trim().length < 20 ? `ещё ${20 - answer.trim().length} симв. минимум` : `${answer.length} / 4000`}</span>
          </div>
        </div>
      )}
    </div>
  )
}
