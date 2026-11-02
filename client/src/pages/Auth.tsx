import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { api, STATIC_MODE, resetDemoData } from '../lib/api'
import { Button, Field, cx } from '../components/ui'
import { Logo } from '../components/Layout'
import { DIRECTIONS, DIRECTION_KEYS } from '../../../shared/constants'

function AuthShell({ title, text, children, aside }: { title: string; text: string; children: ReactNode; aside: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1fr_1.05fr]">
      <div className="px-5 sm:px-10 py-8 flex flex-col">
        <Logo />
        <div className="w-full max-w-md mx-auto my-auto py-10">
          <h1 className="text-3xl sm:text-4xl font-bold">{title}</h1>
          <p className="mt-2 text-ink-soft">{text}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="hidden lg:block p-4">
        <div className="hero-surface h-full rounded-[32px] p-12 flex flex-col justify-end relative overflow-hidden">{aside}</div>
      </div>
    </div>
  )
}

function PasswordInput({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input className="field pr-12" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required minLength={autoComplete === 'new-password' ? 8 : undefined} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 size-9 grid place-items-center rounded-full text-ink-soft hover:bg-lavender" aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

const DEMO = [
  { email: 'participant@demo.ru', label: 'Участник', who: 'Полина, 9 класс' },
  { email: 'mentor@demo.ru', label: 'Наставник', who: 'Дарья, психолог' },
  { email: 'admin@demo.ru', label: 'Администратор', who: 'Ирина, руководитель' },
]

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const qc = useQueryClient()

  const login = async (e?: string, p?: string) => {
    setBusy(true); setError('')
    try {
      await api.post('/auth/login', { email: e ?? email, password: p ?? password })
      await qc.invalidateQueries()
      nav(sp.get('next') || '/', { replace: true })
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }
  const submit = (ev: FormEvent) => { ev.preventDefault(); login() }

  return (
    <AuthShell
      title="С возвращением"
      text="Войди, чтобы продолжить свой путь: курсы, встречи и жетоны ждут."
      aside={<AsideRoute />}
    >
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Почта"><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
        <Field label="Пароль"><PasswordInput value={password} onChange={setPassword} autoComplete="current-password" /></Field>
        {error && <p className="text-sm font-medium text-[#b0174f]" role="alert">{error}</p>}
        <Button type="submit" size="lg" loading={busy} className="mt-1">Войти</Button>
      </form>
      <p className="mt-5 text-ink-soft">Ещё нет аккаунта? <Link to="/register" className="font-semibold text-violet">Присоединиться</Link></p>

      <div className="mt-10 rounded-[22px] bg-lavender/70 p-4">
        <p className="font-semibold">Демо-доступ для презентации</p>
        <p className="text-sm text-ink-soft mt-0.5">Войти в один клик под готовым аккаунтом. Пароль у всех: <code className="font-semibold text-ink">future2027</code></p>
        <div className="mt-3 grid sm:grid-cols-3 gap-2">
          {DEMO.map((d) => (
            <button key={d.email} onClick={() => login(d.email, 'future2027')} disabled={busy}
              className="text-left rounded-2xl bg-white px-3.5 py-2.5 hover:shadow-[var(--shadow-soft)] transition">
              <span className="block font-semibold text-violet">{d.label}</span>
              <span className="block text-xs text-ink-soft">{d.who}</span>
            </button>
          ))}
        </div>
        {STATIC_MODE && <ResetDemo />}
      </div>
    </AuthShell>
  )
}

function ResetDemo() {
  const [busy, setBusy] = useState(false)
  const qc = useQueryClient()
  const reset = async () => {
    if (!confirm('Вернуть платформу в исходное состояние? Все новые аккаунты, ответы и публикации на этом устройстве удалятся.')) return
    setBusy(true)
    await resetDemoData()
    qc.clear()
    setBusy(false)
    alert('Готово: демо-данные восстановлены.')
  }
  return (
    <button onClick={reset} disabled={busy} className="mt-3 text-sm font-semibold text-ink-soft hover:text-violet">
      {busy ? 'Восстанавливаем…' : 'Начать демо заново'}
    </button>
  )
}

export function Register() {
  const [role, setRole] = useState<'participant' | 'mentor'>('participant')
  const [form, setForm] = useState({ name: '', email: '', password: '', city: '', headline: '' })
  const [interests, setInterests] = useState<string[]>([])
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  const qc = useQueryClient()
  const set = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value })

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!consent) return setError('Нужно согласие на обработку персональных данных')
    setBusy(true); setError('')
    try {
      await api.post('/auth/register', { ...form, role, interests, consent: true })
      await qc.invalidateQueries()
      nav(role === 'participant' ? '/?welcome=1' : '/', { replace: true })
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <AuthShell
      title="Присоединяйся"
      text="Регистрация занимает минуту. После неё — курсы, встречи с наставниками и первые жетоны."
      aside={<AsideRoute />}
    >
      <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-white shadow-[var(--shadow-soft)] mb-6" role="radiogroup" aria-label="Кто ты">
        {(['participant', 'mentor'] as const).map((r) => (
          <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)}
            className={cx('h-10 rounded-full font-semibold transition', role === r ? 'bg-violet text-white' : 'text-ink-soft')}>
            {r === 'participant' ? 'Я участник' : 'Я наставник'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Имя и фамилия" hint={role === 'participant' ? 'Другим участникам видно только имя и первая буква фамилии' : undefined}>
          <input className="field" value={form.name} onChange={set('name')} autoComplete="name" required minLength={2} />
        </Field>
        <Field label="Почта"><input className="field" type="email" value={form.email} onChange={set('email')} autoComplete="email" required /></Field>
        <Field label="Пароль" hint="Минимум 8 символов"><PasswordInput value={form.password} onChange={(v) => setForm({ ...form, password: v })} autoComplete="new-password" /></Field>
        <Field label="Город или посёлок"><input className="field" value={form.city} onChange={set('city')} placeholder="Например, Бердск" /></Field>
        {role === 'mentor' && (
          <Field label="Чем занимаетесь" hint="Аккаунт наставника активирует администратор после проверки">
            <input className="field" value={form.headline} onChange={set('headline')} placeholder="Например, педагог-психолог" required />
          </Field>
        )}
        <div>
          <span className="label">Что тебе интересно</span>
          <div className="flex flex-wrap gap-2">
            {DIRECTION_KEYS.map((k) => {
              const on = interests.includes(k)
              return (
                <button key={k} type="button" aria-pressed={on} onClick={() => setInterests(on ? interests.filter((i) => i !== k) : [...interests, k])}
                  className={cx('rounded-full px-3.5 py-2 text-sm font-medium border-2 transition', on ? 'bg-violet border-violet text-white' : 'border-lavender bg-white hover:border-lilac')}>
                  {DIRECTIONS[k].emoji} {DIRECTIONS[k].short}
                </button>
              )
            })}
          </div>
        </div>
        <label className="flex gap-3 items-start text-sm text-ink-soft">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-[#5a1fe0]" />
          <span>Я согласен(на) на обработку персональных данных и принимаю <Link to="/safety#rules" target="_blank" className="text-violet font-semibold">правила сообщества</Link>. Если мне нет 14 лет, родители знают о регистрации.</span>
        </label>
        {error && <p className="text-sm font-medium text-[#b0174f]" role="alert">{error}</p>}
        <Button type="submit" size="lg" loading={busy}>{role === 'participant' ? 'Создать аккаунт' : 'Отправить заявку'}</Button>
      </form>
      <p className="mt-5 text-ink-soft">Уже есть аккаунт? <Link to="/login" className="font-semibold text-violet">Войти</Link></p>
    </AuthShell>
  )
}

/** Иллюстрация справа: маршрут из станций */
function AsideRoute() {
  const stops = ['Курсы и задания', 'Встречи с наставниками', 'Жетоны за активность', 'Путешествие по области']
  return (
    <>
      <svg className="absolute -right-10 top-10 w-[90%] opacity-25" viewBox="0 0 400 300" aria-hidden>
        <path d="M0 260 C 160 260, 160 40, 400 40" fill="none" stroke="white" strokeWidth="3" strokeDasharray="10 10" />
      </svg>
      <ol className="relative grid gap-5 max-w-sm">
        {stops.map((s, i) => (
          <li key={s} className="flex items-center gap-4">
            <span className={cx('size-10 shrink-0 rounded-full grid place-items-center font-display font-bold', i === stops.length - 1 ? 'bg-gold text-violet-deep' : 'bg-white/15 text-white ring-2 ring-white/40')}>{i + 1}</span>
            <span className="text-lg font-medium">{s}</span>
          </li>
        ))}
      </ol>
      <p className="relative mt-10 font-display text-3xl font-bold leading-tight max-w-md">60 самых активных участников отправятся в путешествие по Новосибирской области</p>
    </>
  )
}
