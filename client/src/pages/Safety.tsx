import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Phone, ShieldCheck, ChevronDown, Lock, EyeOff, Flag, UserCheck } from 'lucide-react'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { timeAgo } from '../lib/format'
import { Button, ButtonLink, Chip, Field, cx, useToast } from '../components/ui'
import { Section } from '../components/Layout'

const RULES = [
  ['Уважение', 'Мы критикуем идеи, а не людей. Оскорбления, насмешки над внешностью, происхождением, семьёй и интересами недопустимы.'],
  ['Никакой травли', 'Травля — это намеренное повторяющееся унижение. За неё предупреждают, а при повторе — блокируют аккаунт.'],
  ['Контакты — только внутри', 'Телефоны, адреса, ники в мессенджерах и ссылки на соцсети не публикуются ни в постах, ни в личных сообщениях. Система блокирует их автоматически.'],
  ['Чужие истории — не наши', 'То, чем поделились на открытом микрофоне или в личной переписке, не пересказывается и не публикуется без согласия.'],
  ['Фото и видео — с разрешения', 'Снимать и публиковать других участников можно только с их согласия.'],
  ['Сообщай о проблемах', 'Если видишь травлю или тебе пишут что-то тревожное — нажми «Пожаловаться». Это забота о сообществе, а не донос.'],
  ['Взрослые рядом', 'Наставники и психолог проекта всегда на связи. Если тебе плохо — напиши им, можно анонимно.'],
]

const MATERIALS = [
  {
    q: 'Как понять, что это травля, а не ссора?',
    a: 'Травля — это когда тебя намеренно и раз за разом унижают, высмеивают, игнорируют или угрожают, а у обидчиков больше силы: их больше, они старше или популярнее. В ссоре стороны примерно равны и могут договориться. Если тебе плохо от происходящего — это уже повод поговорить со взрослым, даже если «все так шутят».',
  },
  {
    q: 'Что делать, если травят меня?',
    a: 'Ты не виноват(а) в том, что происходит. Не отвечай агрессией, сохраняй скриншоты и записывай, что и когда случилось. Расскажи взрослому, которому доверяешь: родителям, учителю, школьному психологу, наставнику проекта. Здесь можно обратиться к психологу анонимно — форма ниже.',
  },
  {
    q: 'Я вижу, как травят другого. Как помочь?',
    a: 'Не смейся и не пересылай унизительное. Подойди к тому, кого травят, и скажи, что ты на его стороне. Позови взрослого. Действуйте вместе с друзьями — так безопаснее. На платформе нажми «Пожаловаться» на сообщение.',
  },
  {
    q: 'Меня травят в интернете. Что делать?',
    a: 'Сделай скриншоты, заблокируй обидчика и пожалуйся в самой соцсети или мессенджере. Закрой профиль от незнакомцев, убери из открытого доступа школу, адрес и телефон. Не отправляй личные фото. Расскажи взрослому.',
  },
  {
    q: 'Мне кажется, я сам(а) кого-то обижаю',
    a: 'Хорошо, что ты это заметил(а) — это первый шаг. Подумай, что ты чувствуешь в такие моменты и чего на самом деле хочешь. Попробуй извиниться и поговорить с психологом проекта: он поможет разобраться без осуждения.',
  },
]

export default function Safety() {
  const { user } = useSession()
  const { hash } = useLocation()
  useEffect(() => { if (hash) setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 100) }, [hash])

  return (
    <div>
      <section className="hero-surface rounded-[28px] p-6 sm:p-10 mt-2">
        <ShieldCheck className="size-10" />
        <h1 className="mt-4 text-3xl sm:text-[2.6rem] font-bold leading-tight max-w-2xl">Здесь безопасно говорить о важном</h1>
        <p className="mt-3 text-lg text-white/85 max-w-2xl">Правила сообщества, материалы о травле и способы получить помощь — от анонимного обращения к психологу до телефона доверия.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <a href="#help" className="inline-flex items-center h-11 px-5 rounded-full bg-gold text-violet-deep font-semibold">Получить помощь</a>
          <a href="#rules" className="inline-flex items-center h-11 px-5 rounded-full bg-white/12 font-semibold hover:bg-white/20">Правила сообщества</a>
          <a href="#materials" className="inline-flex items-center h-11 px-5 rounded-full bg-white/12 font-semibold hover:bg-white/20">О буллинге</a>
        </div>
      </section>

      <section id="help" className="scroll-mt-20 mt-8 grid lg:grid-cols-[1fr_1.3fr] gap-5 items-start">
        <div className="grid gap-3">
          <div className="card p-6">
            <p className="font-display text-lg font-bold">Если нужна помощь прямо сейчас</p>
            <a href="tel:88002000122" className="mt-4 flex items-center gap-3 rounded-2xl bg-lavender/70 p-4 hover:bg-lavender">
              <span className="size-11 rounded-full bg-violet text-white grid place-items-center"><Phone className="size-5" /></span>
              <span><span className="block font-display text-xl font-bold">8-800-2000-122</span><span className="text-sm text-ink-soft">Детский телефон доверия — бесплатно, анонимно, по всей России</span></span>
            </a>
            <a href="tel:112" className="mt-2 flex items-center gap-3 rounded-2xl bg-coral/10 p-4 hover:bg-coral/15">
              <span className="size-11 rounded-full bg-coral text-white grid place-items-center"><Phone className="size-5" /></span>
              <span><span className="block font-display text-xl font-bold">112</span><span className="text-sm text-ink-soft">Если есть угроза жизни или здоровью</span></span>
            </a>
          </div>
          <div className="card p-5 text-sm text-ink-soft">
            <p className="font-semibold text-ink mb-1">На платформе</p>
            <p>У каждой публикации, комментария, сообщения и профиля есть кнопка «Пожаловаться». Жалобы видят только модераторы, автор не узнает, кто её отправил.</p>
          </div>
        </div>
        {user ? <HelpForm /> : (
          <div className="panel p-6 sm:p-8">
            <p className="font-display text-xl font-bold">Обратиться к психологу или наставнику</p>
            <p className="mt-2 text-ink-soft">Войди в аккаунт, чтобы написать психологу проекта. Обращение можно отправить анонимно — имя не увидит никто.</p>
            <div className="mt-5 flex gap-2"><ButtonLink to="/login?next=/safety%23help">Войти</ButtonLink><ButtonLink to="/register" variant="secondary">Зарегистрироваться</ButtonLink></div>
          </div>
        )}
      </section>

      {user && <MyRequests />}

      <section id="rules" className="scroll-mt-20">
        <Section title="Правила сообщества">
          <ol className="grid md:grid-cols-2 gap-3">
            {RULES.map(([t, d], i) => (
              <li key={t} className="card p-5 flex gap-4">
                <span className="size-9 rounded-full bg-violet text-white grid place-items-center font-display font-bold text-sm shrink-0">{i + 1}</span>
                <span><span className="block font-bold">{t}</span><span className="block mt-1 text-ink-soft leading-relaxed">{d}</span></span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-ink-soft">Нарушение правил: сначала публикация скрывается и приходит предупреждение, при повторе — аккаунт блокирует администратор.</p>
        </Section>
      </section>

      <section id="materials" className="scroll-mt-20">
        <Section title="Полезно знать о буллинге">
          <div className="grid gap-2">{MATERIALS.map((m) => <Accordion key={m.q} q={m.q} a={m.a} />)}</div>
          <p className="mt-4 text-ink-soft">Больше — в курсе <Link to="/courses/stop-travlya" className="text-violet font-semibold">«Стоп, травля»</Link> и на лекции психолога в календаре мероприятий.</p>
        </Section>
      </section>

      <section id="privacy" className="scroll-mt-20">
        <Section title="Как мы защищаем твои данные">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              [<EyeOff />, 'Минимум публичного', 'Другие участники видят только имя, первую букву фамилии, город и интересы. Почта не видна никому, кроме администратора.'],
              [<Lock />, 'Пароли зашифрованы', 'Пароли хранятся только в виде хеша — даже администратор не может их прочитать.'],
              [<Flag />, 'Контакты не утекают', 'Фильтр блокирует телефоны, почту, ники и ссылки на соцсети в публикациях и сообщениях.'],
              [<UserCheck />, 'Ты управляешь видимостью', 'В профиле можно скрыть имя из рейтинга и запретить сообщения от участников.'],
            ].map(([icon, t, d]) => (
              <div key={t as string} className="card p-5">
                <span className="size-10 rounded-xl bg-lavender text-violet grid place-items-center [&>svg]:size-5">{icon}</span>
                <p className="mt-3 font-bold">{t}</p>
                <p className="mt-1 text-sm text-ink-soft leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-soft">Данные используются только для работы платформы и проекта «Путь в будущее» и не передаются третьим лицам. Чтобы удалить аккаунт, напиши администратору проекта через раздел «Обратиться».</p>
        </Section>
      </section>
    </div>
  )
}

function Accordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left font-semibold">
        {q}<ChevronDown className={cx('size-5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <p className="px-5 pb-5 -mt-1 text-ink-soft leading-relaxed animate-pop">{a}</p>}
    </div>
  )
}

const ADDRESSEES = [
  { value: 'psychologist', label: 'Психологу', hint: 'Если тяжело, тревожно, обижают' },
  { value: 'mentor', label: 'Наставнику', hint: 'Вопрос по учёбе или проекту' },
  { value: 'moderator', label: 'Модератору', hint: 'Нарушение правил, аккаунт' },
] as const

function HelpForm() {
  const [f, setF] = useState({ addressee: 'psychologist', topic: '', body: '', anonymous: false })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const toast = useToast()
  const qc = useQueryClient()
  const send = async () => {
    setBusy(true)
    try {
      await api.post('/safety/help', f)
      setSent(true)
      setF({ ...f, topic: '', body: '' })
      qc.invalidateQueries({ queryKey: ['help-mine'] })
    } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  if (sent) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-5xl">💜</p>
        <p className="mt-3 font-display text-xl font-bold">Обращение отправлено</p>
        <p className="mt-2 text-ink-soft">Обычно отвечаем в течение суток. Ответ придёт в уведомления и появится ниже в разделе «Мои обращения».</p>
        <Button variant="secondary" className="mt-5" onClick={() => setSent(false)}>Написать ещё</Button>
      </div>
    )
  }
  return (
    <div className="panel p-6 sm:p-8">
      <p className="font-display text-xl font-bold">Обратиться за помощью</p>
      <p className="mt-1 text-ink-soft">Напиши, что происходит. Если не хочешь называть себя — включи анонимность.</p>
      <div className="mt-5 grid gap-4">
        <div className="grid sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Кому">
          {ADDRESSEES.map((a) => (
            <button key={a.value} type="button" role="radio" aria-checked={f.addressee === a.value} onClick={() => setF({ ...f, addressee: a.value })}
              className={cx('rounded-2xl border-2 px-3 py-2.5 text-left', f.addressee === a.value ? 'border-violet bg-lavender/60' : 'border-lavender')}>
              <span className="block font-semibold">{a.label}</span><span className="block text-xs text-ink-soft">{a.hint}</span>
            </button>
          ))}
        </div>
        <Field label="Тема"><input className="field" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} maxLength={120} placeholder="Коротко: о чём речь" /></Field>
        <Field label="Сообщение"><textarea className="field min-h-32" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={3000} /></Field>
        <label className="flex items-start gap-3 rounded-2xl bg-mist p-3.5 cursor-pointer">
          <input type="checkbox" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} className="mt-1 size-4 accent-[#5a1fe0]" />
          <span><span className="block font-semibold">Анонимно</span><span className="text-sm text-ink-soft">Специалист не увидит твоё имя и город. Ответ всё равно придёт тебе.</span></span>
        </label>
        <Button onClick={send} loading={busy} disabled={f.topic.trim().length < 3 || f.body.trim().length < 10}>Отправить обращение</Button>
      </div>
    </div>
  )
}

function MyRequests() {
  const q = useQuery({ queryKey: ['help-mine'], queryFn: () => api.get<any[]>('/safety/help/mine') })
  if (!q.data?.length) return null
  const S = { new: ['Получено', 'gold'], in_progress: ['В работе', 'lavender'], closed: ['Закрыто', 'mint'] } as const
  return (
    <section id="my-requests" className="scroll-mt-20">
      <Section title="Мои обращения">
        <ul className="grid gap-3">
          {q.data.map((h) => (
            <li key={h.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{h.topic}</span>
                <Chip tone={S[h.status as keyof typeof S][1]}>{S[h.status as keyof typeof S][0]}</Chip>
                {!!h.anonymous && <Chip>анонимно</Chip>}
                <span className="ml-auto text-xs text-ink-soft">{timeAgo(h.created_at)}</span>
              </div>
              <p className="mt-2 text-ink-soft whitespace-pre-line">{h.body}</p>
              {h.response && <div className="mt-3 rounded-2xl bg-lavender/60 p-4"><p className="text-sm font-semibold text-violet">Ответ</p><p className="mt-1 whitespace-pre-line">{h.response}</p></div>}
            </li>
          ))}
        </ul>
      </Section>
    </section>
  )
}
