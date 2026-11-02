// Общие справочники для сервера и клиента.

export const DIRECTIONS = {
  psychology:  { title: 'Психология и эмоциональный интеллект', short: 'Психология', emoji: '🧠', color: 'violet' },
  antibullying:{ title: 'Борьба с буллингом и безопасное общение', short: 'Безопасное общение', emoji: '🛡️', color: 'pink' },
  leadership:  { title: 'Лидерство и командообразование', short: 'Лидерство', emoji: '🧭', color: 'amber' },
  media:       { title: 'Медиакоммуникации и журналистика', short: 'Медиа', emoji: '🎙️', color: 'sky' },
  socialdesign:{ title: 'Социальное проектирование', short: 'Соцпроекты', emoji: '🌱', color: 'mint' },
  career:      { title: 'Профориентация и выбор профессии', short: 'Профориентация', emoji: '🛤️', color: 'coral' },
  mentoring:   { title: 'Наставничество и работа с детьми', short: 'Наставничество', emoji: '🤝', color: 'lilac' },
} as const
export type DirectionKey = keyof typeof DIRECTIONS
export const DIRECTION_KEYS = Object.keys(DIRECTIONS) as DirectionKey[]

// Уровни — «станции» маршрута. Порог в жетонах.
export const LEVELS = [
  { min: 0,   title: 'Перрон',          hint: 'Ты на старте: осмотрись и выбери первый курс' },
  { min: 50,  title: 'Посадка',         hint: 'Первые шаги сделаны — маршрут построен' },
  { min: 120, title: 'Первый перегон',  hint: 'Ты в ритме: курсы, задания, встречи' },
  { min: 200, title: 'Узловая станция', hint: 'Ты уже помогаешь другим и пробуешь свои идеи' },
  { min: 300, title: 'Экспресс в будущее', hint: 'Порог путешествия пройден — держи темп до финала' },
] as const

export function levelFor(tokens: number) {
  let idx = 0
  LEVELS.forEach((l, i) => { if (tokens >= l.min) idx = i })
  const current = LEVELS[idx]
  const next = LEVELS[idx + 1] ?? null
  return { index: idx, ...current, next }
}

// Финальное путешествие по Новосибирской области
export const TRIP = {
  seats: 60,
  threshold: 300,                // минимум жетонов, чтобы претендовать на место
  ratingCloses: '2028-05-25',
  startsAt: '2028-06-03',
  endsAt: '2028-06-10',
  route: ['Новосибирск', 'Бердск', 'Искитим', 'Колывань', 'Карасук', 'Куйбышев'],
}

export const TOKEN_CATEGORIES = {
  course:     { title: 'Курсы',              emoji: '🎓' },
  task:       { title: 'Задания',            emoji: '✍️' },
  event:      { title: 'Мероприятия',        emoji: '🎟️' },
  team:       { title: 'Командная работа',   emoji: '🤝' },
  initiative: { title: 'Инициатива и проекты', emoji: '💡' },
  bonus:      { title: 'Бонусы',             emoji: '✨' },
  correction: { title: 'Корректировка',      emoji: '⚖️' },
} as const
export type TokenCategory = keyof typeof TOKEN_CATEGORIES

// Правила начисления (используются сервером и показываются на странице «Мой путь»)
export const TOKEN_RULES = {
  ideaApproved: 20,     // идея или проект прошли модерацию
  teamDefault: 10,      // наставник отмечает командную работу
  maxTeamAward: 30,     // потолок разового начисления от наставника
}

export const ACHIEVEMENTS = [
  { code: 'welcome',      emoji: '🎫', title: 'Билет получен',      desc: 'Зарегистрироваться на платформе' },
  { code: 'rules',        emoji: '🫶', title: 'Свой человек',        desc: 'Принять правила сообщества' },
  { code: 'first_lesson', emoji: '📖', title: 'Первая остановка',    desc: 'Пройти первый урок' },
  { code: 'first_task',   emoji: '✍️', title: 'Голос услышан',       desc: 'Получить зачёт по первому заданию' },
  { code: 'first_course', emoji: '🎓', title: 'Маршрут пройден',     desc: 'Завершить первый курс' },
  { code: 'three_courses',emoji: '🗺️', title: 'Картограф',           desc: 'Завершить три курса' },
  { code: 'first_event',  emoji: '🎟️', title: 'Вживую',              desc: 'Побывать на первом очном мероприятии' },
  { code: 'five_events',  emoji: '🚉', title: 'Завсегдатай станции', desc: 'Побывать на пяти мероприятиях' },
  { code: 'team',         emoji: '🤝', title: 'Сцепка вагонов',      desc: 'Получить жетоны за командную работу' },
  { code: 'initiator',    emoji: '💡', title: 'Инициатор',           desc: 'Опубликовать идею, одобренную наставником' },
  { code: 'tokens_100',   emoji: '🪙', title: 'Сотня',               desc: 'Заработать 100 жетонов' },
  { code: 'trip_ready',   emoji: '🚆', title: 'Готов к экспрессу',    desc: `Набрать ${300} жетонов — порог путешествия` },
] as const

export const EVENT_KINDS = {
  masterclass: { title: 'Мастер-класс',   emoji: '🧩' },
  meeting:     { title: 'Встреча',        emoji: '🤝' },
  openmic:     { title: 'Открытый микрофон', emoji: '🎤' },
  career:      { title: 'Профориентация', emoji: '🛤️' },
  psychology:  { title: 'Психология',     emoji: '🫶' },
  excursion:   { title: 'Экскурсия',      emoji: '🚆' },
  lecture:     { title: 'Лекция',         emoji: '💬' },
} as const
export type EventKind = keyof typeof EVENT_KINDS

export const REPORT_REASONS = [
  'Оскорбления или травля',
  'Угрозы',
  'Личные данные или контакты',
  'Спам или реклама',
  'Неприемлемый контент',
  'Другое',
] as const

export const ROLE_TITLES = { participant: 'Участник', mentor: 'Наставник', admin: 'Администратор' } as const
export type Role = keyof typeof ROLE_TITLES
