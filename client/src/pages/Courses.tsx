import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { api } from '../lib/api'
import { Empty, ErrorBox, PageHeader, Spinner, cx } from '../components/ui'
import { CourseCard } from '../components/shared'
import { DIRECTIONS, DIRECTION_KEYS } from '../../../shared/constants'
import { useSession } from '../lib/session'

export default function Courses() {
  const { user } = useSession()
  const q = useQuery({ queryKey: ['courses'], queryFn: () => api.get<any[]>('/courses') })
  const [dir, setDir] = useState<string>('all')
  const [mine, setMine] = useState(false)
  const [search, setSearch] = useState('')

  const list = useMemo(() => (q.data ?? []).filter((c) =>
    (dir === 'all' || c.direction === dir) && (!mine || c.enrolled) &&
    (!search || (c.title + c.short).toLowerCase().includes(search.toLowerCase())),
  ), [q.data, dir, mine, search])

  return (
    <div>
      <PageHeader title="Образование" text="Авторские курсы наставников проекта: уроки по 10–15 минут, задания с личной обратной связью и жетоны за прохождение." />
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center mb-6">
        <div className="relative lg:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-soft" />
          <input className="field pl-10" placeholder="Найти курс" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск курса" />
        </div>
        {user && (
          <label className="flex items-center gap-2 font-medium text-sm">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="size-4 accent-[#5a1fe0]" />Только мои
          </label>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap mb-6">
        <DirButton active={dir === 'all'} onClick={() => setDir('all')}>Все направления</DirButton>
        {DIRECTION_KEYS.map((k) => (
          <DirButton key={k} active={dir === k} onClick={() => setDir(k)}>{DIRECTIONS[k].emoji} {DIRECTIONS[k].short}</DirButton>
        ))}
      </div>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : list.length === 0 ? (
        <Empty emoji="🔭" title="Ничего не нашлось" text="Попробуй другое направление или очисти поиск." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{list.map((c) => <CourseCard key={c.id} c={c} />)}</div>
      )}
    </div>
  )
}

function DirButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={cx('shrink-0 rounded-full px-4 h-10 text-sm font-semibold transition', active ? 'bg-violet text-white' : 'bg-white text-ink-soft hover:text-ink shadow-[var(--shadow-soft)]')}>
      {children}
    </button>
  )
}
