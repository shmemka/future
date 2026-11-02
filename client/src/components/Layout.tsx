import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Home, Route, GraduationCap, CalendarDays, MessagesSquare, Mail, ShieldCheck, Bell, Menu, X,
  Briefcase, Gavel, Settings2, LogOut, User, Trophy, Users,
} from 'lucide-react'
import { useSession, useLogout } from '../lib/session'
import { Avatar, ButtonLink, cx } from './ui'
import { ROLE_TITLES } from '../../../shared/constants'

export function Logo({ light, compact }: { light?: boolean; compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="Путь в будущее — на главную">
      <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="18" fill={light ? '#fff' : '#5a1fe0'} />
        <path d="M14 44 C 26 44, 26 20, 50 20" fill="none" stroke={light ? '#5a1fe0' : '#fff'} strokeWidth="6" strokeLinecap="round" />
        <circle cx="14" cy="44" r="6" fill="#ffc93c" />
        <circle cx="50" cy="20" r="6" fill={light ? '#5a1fe0' : '#fff'} />
      </svg>
      {!compact && (
        <span className={cx('font-display font-bold leading-[1.05] text-[15px]', light ? 'text-white' : 'text-violet-deep')}>
          Путь<br />в будущее
        </span>
      )}
    </Link>
  )
}

type NavItem = { to: string; label: string; icon: typeof Home; badge?: number; end?: boolean }

/** Навигация-маршрут: пункты меню — станции на одной линии */
function RouteNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <ul className="relative">
      <span className="absolute left-[19px] top-5 bottom-5 w-[3px] rounded-full bg-lavender" aria-hidden />
      {items.map((it) => (
        <li key={it.to}>
          <NavLink
            to={it.to} end={it.end} onClick={onNavigate}
            className={({ isActive }) => cx(
              'group relative flex items-center gap-3 rounded-2xl pl-1.5 pr-3 py-2 font-medium transition',
              isActive ? 'text-violet-deep' : 'text-ink-soft hover:text-ink',
            )}
          >
            {({ isActive }) => (
              <>
                <span className={cx(
                  'relative z-10 grid place-items-center size-[34px] rounded-full transition',
                  isActive ? 'bg-violet text-white shadow-[0_0_0_5px_var(--color-lavender)]' : 'bg-white text-ink-soft ring-2 ring-lavender group-hover:ring-lilac',
                )}>
                  <it.icon className="size-[17px]" strokeWidth={2.2} />
                </span>
                <span className={cx(isActive && 'font-semibold')}>{it.label}</span>
                {!!it.badge && <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-coral text-white text-[11px] font-bold grid place-items-center">{it.badge}</span>}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

function useNav() {
  const { user, counts, isStaff, isAdmin } = useSession()
  const main: NavItem[] = [
    { to: '/', label: 'Главная', icon: Home, end: true },
    { to: '/path', label: 'Мой путь', icon: Route },
    { to: '/courses', label: 'Образование', icon: GraduationCap },
    { to: '/events', label: 'Мероприятия', icon: CalendarDays },
    { to: '/community', label: 'Сообщество', icon: MessagesSquare },
    { to: '/messages', label: 'Сообщения', icon: Mail, badge: counts.unreadMessages },
    { to: '/rating', label: 'Рейтинг', icon: Trophy },
    { to: '/safety', label: 'Безопасность', icon: ShieldCheck },
  ]
  const staff: NavItem[] = []
  if (isStaff) {
    staff.push({ to: '/mentor', label: 'Кабинет наставника', icon: Briefcase })
    staff.push({ to: '/moderation', label: 'Модерация', icon: Gavel, badge: counts.moderationQueue })
  }
  if (isAdmin) staff.push({ to: '/admin', label: 'Администрирование', icon: Settings2 })
  return { user, main: user?.role === 'participant' ? main : main.filter((i) => i.to !== '/path'), staff, counts }
}

export function AppLayout() {
  const { user, isLoading } = useSession()
  if (isLoading) return <div className="min-h-dvh grid place-items-center"><Logo /></div>
  return user ? <MemberLayout /> : <GuestLayout />
}

function GuestLayout() {
  const [open, setOpen] = useState(false)
  const links = [
    { to: '/courses', label: 'Курсы' },
    { to: '/events', label: 'Мероприятия' },
    { to: '/safety', label: 'Безопасность' },
  ]
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 bg-mist/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center gap-6">
          <Logo />
          <nav className="hidden md:flex gap-1 ml-4">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => cx('px-3.5 py-2 rounded-full font-medium', isActive ? 'bg-white text-violet' : 'text-ink-soft hover:text-ink')}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden sm:flex gap-2">
            <ButtonLink to="/login" variant="ghost">Войти</ButtonLink>
            <ButtonLink to="/register">Присоединиться</ButtonLink>
          </div>
          <button className="ml-auto sm:hidden size-10 grid place-items-center rounded-full bg-white" onClick={() => setOpen(!open)} aria-label="Меню">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {open && (
          <div className="sm:hidden px-4 pb-4 flex flex-col gap-1 animate-pop">
            {links.map((l) => <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="px-4 py-3 rounded-2xl bg-white font-medium">{l.label}</Link>)}
            <div className="flex gap-2 mt-2">
              <ButtonLink to="/login" variant="secondary" className="flex-1">Войти</ButtonLink>
              <ButtonLink to="/register" className="flex-1">Присоединиться</ButtonLink>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-16"><Outlet /></main>
      <Footer />
    </div>
  )
}

function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-4 sm:px-6 py-10 text-sm text-ink-soft flex flex-wrap gap-x-6 gap-y-2 justify-between border-t border-lavender">
      <span>«Путь в будущее» — очно-заочная платформа для подростков Новосибирской области</span>
      <span className="flex gap-4">
        <Link to="/safety#rules" className="hover:text-violet">Правила сообщества</Link>
        <Link to="/safety#privacy" className="hover:text-violet">Персональные данные</Link>
      </span>
    </footer>
  )
}

function MemberLayout() {
  const { user, main, staff, counts } = useNav()
  const [sheet, setSheet] = useState(false)
  const logout = useLogout()
  const loc = useLocation()
  if (!user) return null

  if (user.status === 'pending') return <PendingMentor />

  const mobileTabs: NavItem[] = [
    main[0], main.find((m) => m.to === '/courses')!, main.find((m) => m.to === '/events')!, main.find((m) => m.to === '/community')!,
  ]

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      {/* Боковая панель — десктоп */}
      <aside className="hidden lg:flex flex-col sticky top-0 h-dvh px-5 py-6 overflow-y-auto">
        <Logo />
        <nav className="mt-8 flex-1" aria-label="Основная навигация">
          <RouteNav items={main} />
          {staff.length > 0 && (
            <>
              <p className="mt-6 mb-2 pl-2 text-xs font-semibold text-ink-soft/80">Для команды проекта</p>
              <RouteNav items={staff} />
            </>
          )}
        </nav>
        <ProfileCard onLogout={logout} />
      </aside>

      <div className="min-w-0">
        {/* Верхняя панель */}
        <header className="sticky top-0 z-30 bg-mist/85 backdrop-blur-md">
          <div className="h-16 px-4 sm:px-6 lg:px-10 flex items-center gap-3">
            <div className="lg:hidden"><Logo compact /></div>
            <div className="ml-auto flex items-center gap-2">
              <NavLink to="/notifications" className="relative size-10 grid place-items-center rounded-full bg-white hover:bg-lavender transition" aria-label="Уведомления">
                <Bell className="size-5" />
                {counts.unreadNotifications > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-coral text-white text-[11px] font-bold grid place-items-center">{counts.unreadNotifications}</span>}
              </NavLink>
              <Link to="/me" className="flex items-center gap-2 rounded-full bg-white pl-1 pr-3 py-1 hover:bg-lavender transition" aria-label="Личный кабинет">
                <Avatar user={user} size={32} />
                <span className="hidden sm:block text-sm font-semibold max-w-[140px] truncate">{user.name.split(' ')[0]}</span>
              </Link>
            </div>
          </div>
        </header>

        <main key={loc.pathname} className="px-4 sm:px-6 lg:px-10 pt-2 safe-bottom max-w-[1180px]"><Outlet /></main>
      </div>

      {/* Нижняя панель — телефон и планшет */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-lavender pb-[env(safe-area-inset-bottom)]" aria-label="Навигация">
        <div className="grid grid-cols-5 h-16">
          {mobileTabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cx('flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', isActive ? 'text-violet' : 'text-ink-soft')}>
              <t.icon className="size-5" />
              {t.label === 'Образование' ? 'Курсы' : t.label}
            </NavLink>
          ))}
          <button onClick={() => setSheet(true)} className="relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-ink-soft">
            <Menu className="size-5" />Ещё
            {(counts.unreadMessages + counts.moderationQueue) > 0 && <span className="absolute top-2 right-[30%] size-2.5 rounded-full bg-coral" />}
          </button>
        </div>
      </nav>
      {sheet && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-violet-deep/40 backdrop-blur-sm" onClick={() => setSheet(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-[28px] p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[85vh] overflow-y-auto animate-pop">
            <div className="flex justify-between items-center mb-3">
              <p className="font-display font-bold">Меню</p>
              <button onClick={() => setSheet(false)} className="size-9 grid place-items-center rounded-full bg-lavender" aria-label="Закрыть"><X className="size-5" /></button>
            </div>
            <RouteNav items={[...main.filter((m) => !mobileTabs.includes(m)), { to: '/me', label: 'Личный кабинет', icon: User }, { to: '/people', label: 'Участники и наставники', icon: Users }]} onNavigate={() => setSheet(false)} />
            {staff.length > 0 && <div className="mt-4"><RouteNav items={staff} onNavigate={() => setSheet(false)} /></div>}
            <button onClick={logout} className="mt-4 w-full flex items-center justify-center gap-2 h-11 rounded-full bg-lavender font-semibold"><LogOut className="size-4" />Выйти</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileCard({ onLogout }: { onLogout: () => void }) {
  const { user } = useSession()
  const nav = useNavigate()
  if (!user) return null
  return (
    <div className="mt-6 card p-3 flex items-center gap-3">
      <button onClick={() => nav('/me')} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <Avatar user={user} size={40} />
        <span className="min-w-0">
          <span className="block font-semibold truncate">{user.name}</span>
          <span className="block text-xs text-ink-soft">{ROLE_TITLES[user.role]}</span>
        </span>
      </button>
      <button onClick={onLogout} className="size-9 grid place-items-center rounded-full hover:bg-lavender text-ink-soft" aria-label="Выйти" title="Выйти"><LogOut className="size-4" /></button>
    </div>
  )
}

function PendingMentor() {
  const logout = useLogout()
  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <div className="panel max-w-md p-8 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-2xl font-bold">Заявка наставника на проверке</h1>
        <p className="mt-3 text-ink-soft">Администратор проекта проверит профиль и подтвердит доступ. Обычно это занимает один-два дня — мы пришлём уведомление.</p>
        <button onClick={logout} className="mt-6 text-violet font-semibold">Выйти из аккаунта</button>
      </div>
    </div>
  )
}

export function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('mt-10', className)}>
      <div className="flex items-end justify-between gap-4 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
