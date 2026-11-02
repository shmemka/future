import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { tokensWord } from '../lib/format'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ───────── Кнопки ─────────
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'light' | 'gold'
const variants: Record<Variant, string> = {
  primary: 'bg-violet text-white hover:bg-violet-bright shadow-[0_8px_20px_-8px_rgb(90_31_224/.6)]',
  secondary: 'bg-lavender text-violet-deep hover:bg-lilac/60',
  ghost: 'text-ink-soft hover:bg-lavender hover:text-ink',
  danger: 'bg-coral/10 text-[#c2185b] hover:bg-coral/20',
  light: 'bg-white text-violet-deep hover:bg-lavender',
  gold: 'bg-gold text-violet-deep hover:brightness-105 shadow-[0_8px_20px_-10px_rgb(201_138_0/.8)]',
}
const sizes = { sm: 'h-9 px-3.5 text-sm gap-1.5', md: 'h-11 px-5 text-[15px] gap-2', lg: 'h-13 px-7 text-base gap-2.5' }

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: keyof typeof sizes; loading?: boolean; icon?: ReactNode
}
export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center rounded-full font-semibold transition active:scale-[.97] disabled:opacity-50 whitespace-nowrap',
        variants[variant], sizes[size], className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function ButtonLink({ to, variant = 'primary', size = 'md', className, children, icon }: {
  to: string; variant?: Variant; size?: keyof typeof sizes; className?: string; children: ReactNode; icon?: ReactNode
}) {
  return (
    <Link to={to} className={cx('inline-flex items-center justify-center rounded-full font-semibold transition active:scale-[.97] whitespace-nowrap', variants[variant], sizes[size], className)}>
      {icon}{children}
    </Link>
  )
}

// ───────── Аватар ─────────
const avatarBg: Record<string, string> = {
  violet: 'from-[#7b3cff] to-[#5a1fe0]', pink: 'from-[#ff8fb3] to-[#ff5d8f]', amber: 'from-[#ffd76a] to-[#ffb020]',
  sky: 'from-[#7cc4ff] to-[#3fa7ff]', mint: 'from-[#6fe8c3] to-[#19c995]', coral: 'from-[#ffa48a] to-[#ff6b5d]',
  lilac: 'from-[#ddd0ff] to-[#b79cff]',
}
export function Avatar({ user, size = 40, ring }: { user: { avatar?: string; avatar_emoji?: string; name?: string }; size?: number; ring?: boolean }) {
  return (
    <span
      className={cx('inline-grid place-items-center shrink-0 rounded-full bg-gradient-to-br select-none', avatarBg[user.avatar ?? 'violet'] ?? avatarBg.violet, ring && 'ring-4 ring-white')}
      style={{ width: size, height: size, fontSize: size * 0.48 }}
      aria-hidden
    >
      {user.avatar_emoji ?? '🙂'}
    </span>
  )
}

// ───────── Жетон ─────────
export function TokenGlyph({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#ffc93c" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="#c98a00" strokeWidth="1.5" />
      <path d="M7 15.5 C 10 15.5, 10 8.5, 17 8.5" fill="none" stroke="#2c0f7a" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="7" cy="15.5" r="1.7" fill="#2c0f7a" />
    </svg>
  )
}
export function Tokens({ n, className, showWord }: { n: number; className?: string; showWord?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1 font-semibold tabular-nums', className)}>
      <TokenGlyph size={16} />
      {n > 0 && !showWord ? `+${n}` : n}
      {showWord && <span className="font-normal">{tokensWord(n)}</span>}
    </span>
  )
}

// ───────── Мелочи ─────────
export function Chip({ children, tone = 'lavender', className }: { children: ReactNode; tone?: 'lavender' | 'violet' | 'coral' | 'mint' | 'gold' | 'white'; className?: string }) {
  const tones = {
    lavender: 'bg-lavender text-violet-deep', violet: 'bg-violet text-white', coral: 'bg-coral/12 text-[#c2185b]',
    mint: 'bg-mint/15 text-[#0b7a5a]', gold: 'bg-gold/25 text-[#7a5200]', white: 'bg-white/15 text-white',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone], className)}>{children}</span>
}

export function Progress({ value, className, tone = 'violet' }: { value: number; className?: string; tone?: 'violet' | 'gold' | 'mint' }) {
  const color = { violet: 'bg-violet', gold: 'bg-gold', mint: 'bg-mint' }[tone]
  return (
    <div className={cx('h-2 rounded-full bg-lavender overflow-hidden', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-700', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function Spinner({ label = 'Загружаем…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-soft">
      <Loader2 className="size-5 animate-spin text-violet" /> {label}
    </div>
  )
}

export function Empty({ emoji, title, text, action }: { emoji: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <div className="text-4xl mb-3">{emoji}</div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {text && <p className="mt-1.5 text-ink-soft max-w-md mx-auto">{text}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export function ErrorBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : 'Не удалось загрузить данные'
  return (
    <div className="card p-6 flex items-start gap-3 text-[#b0174f]">
      <AlertCircle className="size-5 mt-0.5 shrink-0" />
      <div><p className="font-semibold">{msg}</p><p className="text-sm text-ink-soft mt-1">Обновите страницу. Если ошибка повторяется — напишите администратору.</p></div>
    </div>
  )
}

export function PageHeader({ title, text, actions, children }: { title: string; text?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 lg:mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-[1.75rem] leading-tight sm:text-4xl font-bold">{title}</h1>
          {text && <p className="mt-2 text-ink-soft text-base sm:text-lg">{text}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: {
  tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string
}) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-[var(--shadow-soft)] w-fit max-w-full', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cx('shrink-0 rounded-full px-4 h-9 text-sm font-semibold transition flex items-center gap-1.5',
            value === t.value ? 'bg-violet text-white' : 'text-ink-soft hover:text-ink hover:bg-lavender')}
        >
          {t.label}
          {!!t.count && <span className={cx('min-w-5 h-5 px-1.5 rounded-full text-[11px] grid place-items-center', value === t.value ? 'bg-white/25' : 'bg-coral text-white')}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

// ───────── Модальное окно ─────────
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal aria-label={title}>
      <div className="absolute inset-0 bg-violet-deep/40 backdrop-blur-sm" onClick={onClose} />
      <div ref={ref} className={cx('relative w-full bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-pop max-h-[92vh] overflow-y-auto', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="sticky top-0 bg-white/95 backdrop-blur flex items-center justify-between gap-4 px-6 pt-5 pb-3 z-10">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="size-9 grid place-items-center rounded-full hover:bg-lavender" aria-label="Закрыть"><X className="size-5" /></button>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-soft">{hint}</span>}
    </label>
  )
}

// ───────── Уведомления-тосты ─────────
type Toast = { id: number; text: string; tone: 'ok' | 'error' | 'tokens' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setList((l) => [...l, { id, text, tone }])
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-24 lg:bottom-8 flex flex-col gap-2 w-[min(92vw,420px)]" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={cx('animate-pop rounded-2xl px-4 py-3 shadow-[var(--shadow-lift)] flex items-start gap-2.5 font-medium',
            t.tone === 'error' ? 'bg-white text-[#b0174f]' : t.tone === 'tokens' ? 'bg-violet-deep text-white' : 'bg-ink text-white')}>
            {t.tone === 'error' ? <AlertCircle className="size-5 shrink-0" /> : t.tone === 'tokens' ? <TokenGlyph size={20} className="animate-coin shrink-0" /> : <CheckCircle2 className="size-5 shrink-0 text-mint" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
