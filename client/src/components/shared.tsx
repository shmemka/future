import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Flag, MapPin, Wifi, Users, Clock, BookOpen } from 'lucide-react'
import { DIRECTIONS, EVENT_KINDS, REPORT_REASONS, type DirectionKey } from '../../../shared/constants'
import { api } from '../lib/api'
import { fmtDate, fmtDay, fmtTime, parseDb } from '../lib/format'
import { Button, Chip, Field, Modal, Progress, TokenGlyph, cx, useToast } from './ui'

export const dirGradient: Record<string, string> = {
  violet: 'from-[#7b3cff] to-[#4a17c4]', pink: 'from-[#ff7aa6] to-[#e0397a]', amber: 'from-[#ffcf4d] to-[#ff9d1c]',
  sky: 'from-[#5bb8ff] to-[#2f6dff]', mint: 'from-[#4be3b5] to-[#0fa67c]', coral: 'from-[#ff9a7a] to-[#f2545b]',
  lilac: 'from-[#b9a0ff] to-[#8a63f5]',
}
export const dirOf = (k: string) => DIRECTIONS[k as DirectionKey] ?? DIRECTIONS.psychology

/** Обложка курса: цвет направления, эмодзи и фрагмент «маршрута» */
export function CourseCover({ direction, className, big }: { direction: string; className?: string; big?: boolean }) {
  const d = dirOf(direction)
  return (
    <div className={cx('relative overflow-hidden bg-gradient-to-br', dirGradient[d.color], className)}>
      <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden>
        <path d="M-10 85 C 60 85, 70 20, 210 25" fill="none" stroke="white" strokeWidth="2" strokeDasharray="6 6" />
      </svg>
      <span className={cx('absolute drop-shadow-sm', big ? 'right-6 bottom-4 text-7xl' : 'right-4 bottom-2 text-5xl')} aria-hidden>{d.emoji}</span>
    </div>
  )
}

export function CourseCard({ c }: { c: any }) {
  const d = dirOf(c.direction)
  const total = (c.lessons_total ?? 0)
  const progress = c.enrolled && total ? Math.round((c.lessons_done / total) * 100) : 0
  return (
    <Link to={`/courses/${c.slug}`} className="card overflow-hidden flex flex-col hover:shadow-[var(--shadow-lift)] transition-shadow">
      <CourseCover direction={c.direction} className="h-28" />
      <div className="p-5 flex-1 flex flex-col">
        <p className="text-xs font-semibold text-violet">{d.short}</p>
        <h3 className="mt-1 text-lg font-bold leading-snug">{c.title}</h3>
        <p className="mt-2 text-sm text-ink-soft line-clamp-2">{c.short}</p>
        <div className="mt-auto pt-4 flex items-center gap-3 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0"><BookOpen className="size-4" />{total} ур.</span>
          {c.mentor_name && <span className="truncate min-w-0">{c.mentor_name}</span>}
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-ink"><TokenGlyph size={16} />{c.tokens_reward}</span>
        </div>
        {c.enrolled && (
          <div className="mt-3">
            {c.completed_at ? <Chip tone="mint">Курс пройден</Chip> : <><Progress value={progress} /><p className="mt-1 text-xs text-ink-soft">Пройдено уроков: {c.lessons_done} из {total}</p></>}
          </div>
        )}
      </div>
    </Link>
  )
}

/** Карточка мероприятия в форме билета: слева корешок с датой */
export function EventTicket({ e, compact }: { e: any; compact?: boolean }) {
  const kind = EVENT_KINDS[e.kind as keyof typeof EVENT_KINDS]
  const past = parseDb(e.ends_at ?? e.starts_at) < new Date()
  const left = e.capacity != null && e.registered != null ? e.capacity - e.registered : null
  return (
    <Link to={`/events/${e.id}`} className={cx('card flex overflow-hidden hover:shadow-[var(--shadow-lift)] transition-shadow', past && 'opacity-80')}>
      <div className={cx('relative shrink-0 w-[84px] sm:w-24 flex flex-col items-center justify-center py-4 text-center', past ? 'bg-lavender text-ink-soft' : 'violet-surface')}>
        <span className="text-xs font-semibold opacity-80 capitalize">{fmtDay(e.starts_at)}</span>
        <span className="font-display text-3xl font-bold leading-none mt-1">{fmtDate(e.starts_at, { day: 'numeric' })}</span>
        <span className="text-xs font-semibold mt-1">{fmtDate(e.starts_at, { month: 'short' }).replace('.', '')}</span>
        {/* перфорация билета */}
        <span className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => <span key={i} className="size-4 rounded-full bg-mist" />)}
        </span>
      </div>
      <div className="p-4 sm:p-5 pl-5 sm:pl-6 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={e.kind === 'openmic' || e.kind === 'excursion' ? 'coral' : 'lavender'}>{kind?.emoji} {kind?.title}</Chip>
          {e.my_status === 'registered' && !past && <Chip tone="violet">Вы записаны</Chip>}
          {e.my_status === 'attended' && <Chip tone="mint">Участие засчитано</Chip>}
          {past && !e.my_status && <Chip>Завершено</Chip>}
        </div>
        <h3 className="mt-2 font-bold text-[17px] leading-snug">{e.title}</h3>
        {!compact && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1"><Clock className="size-4" />{fmtTime(e.starts_at)}</span>
            <span className="inline-flex items-center gap-1 min-w-0">{e.format === 'online' ? <Wifi className="size-4" /> : <MapPin className="size-4" />}<span className="truncate max-w-[220px]">{e.location}</span></span>
            {left != null && !past && <span className="inline-flex items-center gap-1"><Users className="size-4" />{left > 0 ? `свободно ${left}` : 'мест нет'}</span>}
            <span className="inline-flex items-center gap-1 font-semibold text-ink"><TokenGlyph size={16} />{e.tokens_reward}</span>
          </div>
        )}
      </div>
    </Link>
  )
}

/** Кнопка «Пожаловаться» — есть у каждой публикации, комментария, сообщения и профиля */
export function ReportButton({ type, id, className, children }: { type: 'post' | 'comment' | 'message' | 'user'; id: number; className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>(REPORT_REASONS[0])
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const send = async () => {
    setBusy(true)
    try {
      await api.post('/safety/reports', { target_type: type, target_id: id, reason, details })
      toast('Жалоба отправлена. Модератор рассмотрит её в течение суток.')
      setOpen(false); setDetails('')
    } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  return (
    <>
      <button onClick={() => setOpen(true)} className={cx('inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-[#c2185b]', className)}>
        <Flag className="size-3.5" />{children ?? 'Пожаловаться'}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Пожаловаться модератору">
        <p className="text-sm text-ink-soft mb-4">Жалобу увидят только модераторы. Автор не узнает, кто её отправил.</p>
        <fieldset className="grid gap-2">
          <legend className="label">Что случилось?</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r} className={cx('flex items-center gap-3 rounded-2xl border-2 px-4 py-2.5 cursor-pointer transition', reason === r ? 'border-violet bg-lavender/60' : 'border-lavender')}>
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-[#5a1fe0]" />
              <span className="font-medium">{r}</span>
            </label>
          ))}
        </fieldset>
        <div className="mt-4">
          <Field label="Подробности (необязательно)">
            <textarea className="field min-h-24" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} placeholder="Что важно знать модератору" />
          </Field>
        </div>
        <div className="mt-5 flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
          <Button onClick={send} loading={busy}>Отправить жалобу</Button>
        </div>
      </Modal>
    </>
  )
}

/** Простая разметка уроков: абзацы, «## » подзаголовки, «- » списки, «> » выноски */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n\s*\n/)
  return (
    <div className={cx('prose-lesson', className)}>
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        if (lines[0].startsWith('## ')) {
          const rest = lines.slice(1)
          return (
            <div key={i}>
              <h2>{lines[0].slice(3)}</h2>
              {rest.length > 0 && <Block lines={rest} />}
            </div>
          )
        }
        return <Block key={i} lines={lines} />
      })}
    </div>
  )
}
function Block({ lines }: { lines: string[] }) {
  if (lines.every((l) => l.startsWith('- '))) return <ul>{lines.map((l, i) => <li key={i}>{l.slice(2)}</li>)}</ul>
  if (lines[0].startsWith('> ')) return <blockquote>{lines.map((l) => l.replace(/^> ?/, '')).join(' ')}</blockquote>
  return <p>{lines.join(' ')}</p>
}

/** Текст постов и сообщений: переносы строк сохраняются */
export function PlainText({ text, className }: { text: string; className?: string }) {
  return <div className={cx('whitespace-pre-line break-words leading-relaxed', className)}>{text}</div>
}
