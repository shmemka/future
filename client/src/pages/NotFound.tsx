import { ButtonLink } from '../components/ui'

export default function NotFound() {
  return (
    <div className="panel mt-6 p-10 text-center max-w-xl mx-auto">
      <p className="font-display text-6xl font-bold text-violet">404</p>
      <h1 className="mt-3 text-2xl font-bold">Такой станции нет на маршруте</h1>
      <p className="mt-2 text-ink-soft">Возможно, ссылка устарела или страница переехала.</p>
      <ButtonLink to="/" className="mt-6">На главную</ButtonLink>
    </div>
  )
}
