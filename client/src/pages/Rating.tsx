import { Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { api } from '../lib/api'
import { Avatar, Chip, ErrorBox, PageHeader, Spinner, TokenGlyph, cx } from '../components/ui'
import { TRIP } from '../../../shared/constants'

export default function Rating() {
  const q = useQuery({ queryKey: ['rating'], queryFn: () => api.get('/rating') })
  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} />
  const list: any[] = q.data.list
  return (
    <div>
      <PageHeader title="Рейтинг активности" text={`Жетоны за учёбу, встречи, командную работу и инициативу. ${TRIP.seats} лучших с ${TRIP.threshold}+ жетонами едут в путешествие по области.`} />
      <div className="card p-4 flex gap-3 text-sm text-ink-soft mb-5">
        <Info className="size-5 text-violet shrink-0" />
        <p>Здесь нет лайков, подписчиков и «популярности» — только образовательная активность. Если не хочешь, чтобы другие видели твоё имя, скрой его в настройках профиля.</p>
      </div>
      <ol className="card divide-y divide-lavender overflow-hidden">
        {list.map((r, i) => (
          <Fragment key={i}>
            {i === TRIP.seats && (
              <li className="px-5 py-2 bg-gold/20 text-sm font-semibold text-[#7a5200]">Граница мест в путешествии — {TRIP.seats} участников</li>
            )}
            <li className={cx('flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3', r.me && 'bg-lavender/60')}>
              <span className={cx('w-8 text-center font-display font-bold tabular-nums', r.rank <= 3 ? 'text-violet text-lg' : 'text-ink-soft')}>{r.rank}</span>
              <Avatar user={r} size={38} />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate">{r.name}{r.me && <span className="text-violet"> · это ты</span>}</span>
                <span className="block text-xs text-ink-soft truncate">{[r.level, r.city].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="hidden sm:block text-sm text-ink-soft">{r.courses_done} курс.</span>
              {r.tokens >= TRIP.threshold && <Chip tone="mint" className="hidden sm:inline-flex">порог пройден</Chip>}
              <span className="inline-flex items-center gap-1 font-display font-bold tabular-nums w-16 justify-end"><TokenGlyph size={18} />{r.tokens}</span>
            </li>
          </Fragment>
        ))}
      </ol>
    </div>
  )
}
