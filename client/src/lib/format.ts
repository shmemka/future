// Время хранится в UTC, показываем по Новосибирску — там проходят все очные встречи проекта.
export const TZ = 'Asia/Novosibirsk'

export const parseDb = (s: string) => new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')

export function fmtDate(s: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, ...opts }).format(parseDb(s))
}
export const fmtTime = (s: string) => fmtDate(s, { hour: '2-digit', minute: '2-digit' })
export const fmtDay = (s: string) => fmtDate(s, { weekday: 'short' })
export const fmtFull = (s: string) => fmtDate(s, { day: 'numeric', month: 'long', weekday: 'long' })

export function timeAgo(s: string) {
  const diff = (Date.now() - parseDb(s).getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  if (diff < 86400 * 2) return 'вчера'
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} дн назад`
  return fmtDate(s)
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
export const tokensWord = (n: number) => plural(Math.abs(n), 'жетон', 'жетона', 'жетонов')

/** Дата в формате для <input type="datetime-local"> по Новосибирску и обратно в UTC ISO */
export function toLocalInput(s: string) {
  const d = parseDb(s)
  const nsk = new Date(d.getTime() + 7 * 3600_000)
  return nsk.toISOString().slice(0, 16)
}
export function fromLocalInput(v: string) {
  const d = new Date(v + ':00Z')
  return new Date(d.getTime() - 7 * 3600_000).toISOString()
}

export function daysUntil(dateIso: string) {
  return Math.ceil((new Date(dateIso + 'T00:00:00+07:00').getTime() - Date.now()) / 86400_000)
}
