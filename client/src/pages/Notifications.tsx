import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'
import { Empty, ErrorBox, PageHeader, Spinner, cx } from '../components/ui'

export default function Notifications() {
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<any[]>('/me/notifications') })
  const qc = useQueryClient()
  // Открыл страницу — значит, прочитал. Подсветка новых сохраняется до следующего визита.
  useEffect(() => {
    if (q.data?.some((n) => !n.read_at)) api.post('/me/notifications/read').then(() => qc.invalidateQueries({ queryKey: ['me'] }))
  }, [q.data])
  return (
    <div className="max-w-3xl">
      <PageHeader title="Уведомления" text="Жетоны, ответы наставников, достижения и новости проекта." />
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : q.data!.length === 0 ? <Empty emoji="🔔" title="Пока тихо" text="Здесь появятся начисления жетонов и ответы наставников." /> : (
        <ul className="card divide-y divide-lavender overflow-hidden">
          {q.data!.map((n) => {
            const inner = (
              <>
                <span className={cx('size-2.5 rounded-full shrink-0 mt-2', n.read_at ? 'bg-transparent' : 'bg-coral')} />
                <span className="flex-1 min-w-0"><span className={cx('block', !n.read_at && 'font-semibold')}>{n.text}</span><span className="text-xs text-ink-soft">{timeAgo(n.created_at)}</span></span>
              </>
            )
            return <li key={n.id}>{n.link ? <Link to={n.link} className={cx('flex gap-3 px-5 py-3.5 hover:bg-mist', !n.read_at && 'bg-lavender/40')}>{inner}</Link> : <div className="flex gap-3 px-5 py-3.5">{inner}</div>}</li>
          })}
        </ul>
      )}
    </div>
  )
}
