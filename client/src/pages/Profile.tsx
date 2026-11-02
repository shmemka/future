import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, MapPin, Lock, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'
import { useSession, type Me } from '../lib/session'
import { fmtDate, timeAgo } from '../lib/format'
import { Avatar, Button, ButtonLink, Chip, Field, Modal, Progress, Spinner, TokenGlyph, cx, useToast } from '../components/ui'
import { Section } from '../components/Layout'
import { dirOf } from '../components/shared'
import { DIRECTIONS, DIRECTION_KEYS, ROLE_TITLES, TRIP } from '../../../shared/constants'

const ACTIVITY_ICON: Record<string, string> = { tokens: '🪙', achievement: '🏅', course: '🎓', lesson: '📖', task: '✍️', event: '🎟️', post: '💬', enroll: '🧭', join: '🎫' }

export default function Profile() {
  const { user } = useSession()
  const isParticipant = user?.role === 'participant'
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/me/dashboard'), enabled: !!user })
  const [edit, setEdit] = useState(false)

  useEffect(() => {
    if (location.hash === '#achievements' && dash.data) document.getElementById('achievements')?.scrollIntoView({ behavior: 'smooth' })
  }, [dash.data])

  if (!user || dash.isLoading || !dash.data) return <Spinner />
  const d = dash.data
  const t = d.tokens

  return (
    <div>
      {/* Шапка профиля */}
      <section className="panel overflow-hidden">
        <div className="hero-surface h-28 sm:h-36" />
        <div className="px-6 sm:px-8 pb-5">
          <div className="-mt-12 sm:-mt-14 flex items-end justify-between gap-4">
            <Avatar user={user} size={104} ring />
            <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEdit(true)}>Редактировать</Button>
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl font-bold">{user.name}</h1>
          <p className="mt-1 text-ink-soft flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{ROLE_TITLES[user.role]}{user.headline ? ` · ${user.headline}` : ''}</span>
            {user.city && <span className="inline-flex items-center gap-1"><MapPin className="size-4" />{user.city}</span>}
            {user.school && <span>{user.school}</span>}
          </p>
        </div>
        <div className="px-6 sm:px-8 pb-7">
          {user.bio ? <p className="max-w-2xl leading-relaxed">{user.bio}</p> : <button onClick={() => setEdit(true)} className="text-violet font-semibold">Расскажи о себе пару слов</button>}
          <div className="mt-4 flex flex-wrap gap-2">
            {user.interests.length ? user.interests.map((k) => <Chip key={k}>{dirOf(k).emoji} {dirOf(k).short}</Chip>) : <span className="text-sm text-ink-soft">Интересы не выбраны</span>}
          </div>
        </div>
      </section>

      {isParticipant && (
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Жетонов" value={<span className="flex items-center gap-1.5"><TokenGlyph size={24} />{t.total}</span>} to="/path" />
          <StatCard label="Станция" value={t.level.title} small to="/path" />
          <StatCard label="Уроков пройдено" value={d.stats.lessons} />
          <StatCard label="Встреч посещено" value={d.stats.events} />
        </div>
      )}

      {isParticipant && (
        <Section title="Индивидуальный прогресс">
          <div className="card p-6 grid md:grid-cols-[1fr_1.2fr] gap-6">
            <div>
              <p className="text-sm text-ink-soft">До следующей станции</p>
              {t.level.next ? (
                <>
                  <p className="font-display text-xl font-bold mt-1">«{t.level.next.title}»</p>
                  <Progress value={((t.total - t.level.min) / (t.level.next.min - t.level.min)) * 100} className="mt-3 h-3" tone="gold" />
                  <p className="mt-2 text-sm text-ink-soft">{t.total} / {t.level.next.min} жетонов</p>
                </>
              ) : <p className="font-display text-xl font-bold mt-1">Ты на финальной станции</p>}
              <p className="mt-5 text-sm text-ink-soft">До порога путешествия</p>
              <Progress value={(t.total / TRIP.threshold) * 100} className="mt-2 h-3" />
              <p className="mt-2 text-sm text-ink-soft">{Math.min(t.total, TRIP.threshold)} / {TRIP.threshold}</p>
            </div>
            <div className="grid gap-3">
              {d.courses.length === 0 && <p className="text-ink-soft">Курсов пока нет — <Link to="/courses" className="text-violet font-semibold">выбери первый</Link>.</p>}
              {d.courses.map((c: any) => (
                <Link key={c.id} to={`/courses/${c.slug}`} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-mist">
                  <span className="text-2xl">{dirOf(c.direction).emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="flex justify-between gap-2"><span className="font-semibold truncate">{c.title}</span><span className="text-sm text-ink-soft shrink-0">{c.completed_at ? 'пройден' : `${c.progress}%`}</span></span>
                    <Progress value={c.completed_at ? 100 : c.progress} tone={c.completed_at ? 'mint' : 'violet'} className="mt-1.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      )}

      <section id="achievements" className="scroll-mt-20">
        <Section title="Достижения и награды">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {d.achievements.map((a: any) => (
              <div key={a.code} className={cx('card p-4 flex flex-col items-center text-center', !a.earned_at && 'opacity-55')}>
                <span className={cx('size-16 rounded-full grid place-items-center text-3xl', a.earned_at ? 'bg-gradient-to-br from-gold to-[#ffad1f] shadow-[0_6px_16px_-6px_rgb(201_138_0/.7)]' : 'bg-lavender grayscale')}>
                  {a.earned_at ? a.emoji : <Lock className="size-6 text-ink-soft" />}
                </span>
                <p className="mt-3 font-semibold leading-tight">{a.title}</p>
                <p className="mt-1 text-xs text-ink-soft">{a.desc}</p>
                {a.earned_at && <p className="mt-2 text-[11px] font-semibold text-violet">{fmtDate(a.earned_at)}</p>}
              </div>
            ))}
          </div>
        </Section>
      </section>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-x-8">
        <Section title="История активности">
          <ul className="card divide-y divide-lavender">
            {d.activity.length === 0 && <li className="p-5 text-ink-soft">Здесь появятся твои шаги на платформе.</li>}
            {d.activity.map((a: any, i: number) => {
              const inner = (
                <>
                  <span className="text-lg w-7 text-center">{ACTIVITY_ICON[a.kind] ?? '•'}</span>
                  <span className="flex-1 min-w-0 text-[15px]">{a.text}</span>
                  <span className="text-xs text-ink-soft shrink-0">{timeAgo(a.created_at)}</span>
                </>
              )
              return <li key={i}>{a.link ? <Link to={a.link} className="flex items-center gap-3 px-4 py-3 hover:bg-mist">{inner}</Link> : <div className="flex items-center gap-3 px-4 py-3">{inner}</div>}</li>
            })}
          </ul>
        </Section>
        <Section title="Рекомендации">
          <div className="grid gap-3">
            {d.recommendations.courses.map((c: any) => (
              <Link key={c.id} to={`/courses/${c.slug}`} className="card p-4 flex items-center gap-3 hover:shadow-[var(--shadow-lift)]">
                <span className="text-2xl">{dirOf(c.direction).emoji}</span>
                <span className="flex-1 min-w-0"><span className="block text-xs font-semibold text-violet">{c.why}</span><span className="block font-semibold">{c.title}</span></span>
                <ChevronRight className="size-5 text-ink-soft" />
              </Link>
            ))}
            {d.recommendations.events.map((e: any) => (
              <Link key={e.id} to={`/events/${e.id}`} className="card p-4 flex items-center gap-3 hover:shadow-[var(--shadow-lift)]">
                <span className="text-2xl">🎟️</span>
                <span className="flex-1 min-w-0"><span className="block text-xs font-semibold text-coral">Скоро · {fmtDate(e.starts_at)}</span><span className="block font-semibold">{e.title}</span></span>
                <ChevronRight className="size-5 text-ink-soft" />
              </Link>
            ))}
            <ButtonLink to="/people" variant="secondary">Найти участников по интересам</ButtonLink>
          </div>
        </Section>
      </div>

      {edit && <EditProfile user={user} onClose={() => setEdit(false)} />}
    </div>
  )
}

function StatCard({ label, value, small, to }: { label: string; value: React.ReactNode; small?: boolean; to?: string }) {
  const body = (
    <>
      <p className={cx('font-display font-bold', small ? 'text-lg leading-tight' : 'text-3xl')}>{value}</p>
      <p className="mt-1 text-sm text-ink-soft">{label}</p>
    </>
  )
  return to ? <Link to={to} className="card p-5 hover:shadow-[var(--shadow-lift)]">{body}</Link> : <div className="card p-5">{body}</div>
}

const AVATARS = ['violet', 'pink', 'amber', 'sky', 'mint', 'coral', 'lilac']
const EMOJIS = ['🚀', '🌟', '🦊', '🐼', '🎧', '🌈', '🪐', '🐳', '🔥', '🍀', '🎨', '📚', '⚽', '🎸', '🧩', '🫶']

function EditProfile({ user, onClose }: { user: Me; onClose: () => void }) {
  const [f, setF] = useState({
    name: user.name, city: user.city, school: user.school, bio: user.bio, headline: user.headline,
    interests: user.interests, avatar: user.avatar, avatar_emoji: user.avatar_emoji,
    show_in_rating: user.show_in_rating, allow_messages: user.allow_messages,
  })
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const qc = useQueryClient()
  const save = async () => {
    setBusy(true)
    try {
      await api.patch('/me', f)
      await qc.invalidateQueries()
      toast('Профиль сохранён')
      onClose()
    } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Редактировать профиль" wide>
      <div className="grid gap-5">
        <div>
          <span className="label">Аватар</span>
          <div className="flex items-center gap-4">
            <Avatar user={f} size={64} />
            <div className="flex-1 grid gap-2">
              <div className="flex flex-wrap gap-1.5">
                {AVATARS.map((a) => <button key={a} type="button" aria-label={`Цвет ${a}`} onClick={() => setF({ ...f, avatar: a })} className={cx('rounded-full', f.avatar === a && 'ring-2 ring-violet ring-offset-2')}><Avatar user={{ avatar: a, avatar_emoji: '' }} size={26} /></button>)}
              </div>
              <div className="flex flex-wrap gap-1">
                {EMOJIS.map((e) => <button key={e} type="button" onClick={() => setF({ ...f, avatar_emoji: e })} className={cx('size-8 rounded-lg text-lg', f.avatar_emoji === e ? 'bg-lavender' : 'hover:bg-mist')}>{e}</button>)}
              </div>
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Имя и фамилия"><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Город"><input className="field" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          {user.role === 'participant'
            ? <Field label="Класс или учёба" hint="Без названия и номера школы"><input className="field" value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })} placeholder="Например, 9 класс" /></Field>
            : <Field label="Специализация"><input className="field" value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} /></Field>}
        </div>
        <Field label="О себе" hint="Контакты в профиле публиковать нельзя"><textarea className="field min-h-24" maxLength={400} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
        <div>
          <span className="label">Интересы и направления развития</span>
          <div className="flex flex-wrap gap-2">
            {DIRECTION_KEYS.map((k) => {
              const on = f.interests.includes(k)
              return <button key={k} type="button" aria-pressed={on} onClick={() => setF({ ...f, interests: on ? f.interests.filter((i) => i !== k) : [...f.interests, k] })}
                className={cx('rounded-full px-3 py-1.5 text-sm font-medium border-2', on ? 'bg-violet border-violet text-white' : 'border-lavender')}>{DIRECTIONS[k].emoji} {DIRECTIONS[k].short}</button>
            })}
          </div>
        </div>
        {user.role === 'participant' && (
          <div className="rounded-2xl bg-mist p-4 grid gap-3">
            <p className="font-semibold">Приватность</p>
            <Toggle checked={f.show_in_rating} onChange={(v) => setF({ ...f, show_in_rating: v })} title="Показывать моё имя в рейтинге" text="Если выключить, в рейтинге будет «Участник скрыл имя». Жетоны всё равно считаются." />
            <Toggle checked={f.allow_messages} onChange={(v) => setF({ ...f, allow_messages: v })} title="Принимать сообщения от участников" text="Наставники и модераторы смогут писать всегда." />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={save} loading={busy}>Сохранить профиль</Button>
        </div>
      </div>
    </Modal>
  )
}

function Toggle({ checked, onChange, title, text }: { checked: boolean; onChange: (v: boolean) => void; title: string; text: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx('mt-0.5 w-11 h-6 rounded-full relative shrink-0 transition', checked ? 'bg-violet' : 'bg-lilac/70')}>
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
      <span><span className="block font-medium">{title}</span><span className="text-sm text-ink-soft">{text}</span></span>
    </label>
  )
}
