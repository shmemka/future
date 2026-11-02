import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './components/Layout'
import { Spinner } from './components/ui'
import { useSession } from './lib/session'
import type { Role } from '../../shared/constants'
import Home from './pages/Home'
import { Login, Register } from './pages/Auth'
import Profile from './pages/Profile'
import Path from './pages/Path'
import Rating from './pages/Rating'
import Courses from './pages/Courses'
import Course from './pages/Course'
import Lesson from './pages/Lesson'
import Events from './pages/Events'
import EventPage from './pages/Event'
import Community from './pages/Community'
import Post from './pages/Post'
import People, { Person } from './pages/People'
import Messages from './pages/Messages'
import Safety from './pages/Safety'
import Notifications from './pages/Notifications'
import Mentor from './pages/Mentor'
import Studio from './pages/Studio'
import Moderation from './pages/Moderation'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'

/** Доступ к странице только для вошедших (и, при необходимости, определённых ролей) */
function Guard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, isLoading } = useSession()
  const loc = useLocation()
  if (isLoading) return <Spinner />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="courses" element={<Courses />} />
          <Route path="courses/:slug" element={<Course />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventPage />} />
          <Route path="safety" element={<Safety />} />
          <Route path="lessons/:id" element={<Guard><Lesson /></Guard>} />
          <Route path="me" element={<Guard><Profile /></Guard>} />
          <Route path="path" element={<Guard><Path /></Guard>} />
          <Route path="rating" element={<Guard><Rating /></Guard>} />
          <Route path="community" element={<Guard><Community /></Guard>} />
          <Route path="community/post/:id" element={<Guard><Post /></Guard>} />
          <Route path="people" element={<Guard><People /></Guard>} />
          <Route path="people/:id" element={<Guard><Person /></Guard>} />
          <Route path="messages" element={<Guard><Messages /></Guard>} />
          <Route path="messages/:userId" element={<Guard><Messages /></Guard>} />
          <Route path="notifications" element={<Guard><Notifications /></Guard>} />
          <Route path="mentor" element={<Guard roles={['mentor', 'admin']}><Mentor /></Guard>} />
          <Route path="studio/:id" element={<Guard roles={['mentor', 'admin']}><Studio /></Guard>} />
          <Route path="moderation" element={<Guard roles={['mentor', 'admin']}><Moderation /></Guard>} />
          <Route path="admin" element={<Guard roles={['admin']}><Admin /></Guard>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  )
}
