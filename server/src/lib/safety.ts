import { HttpError } from './auth.js'

/**
 * Фильтр контактных данных. Правило сообщества: никто не публикует телефоны,
 * почту, ники в мессенджерах и ссылки на личные страницы — ни в постах,
 * ни в комментариях, ни в личных сообщениях.
 */
const CONTACT_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /(?:\+7|\b8)[\s\-()]*\d{3}[\s\-()]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/, label: 'номер телефона' },
  { re: /(?:\d[\s\-()]*){10,}/, label: 'номер телефона' },
  { re: /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, label: 'адрес почты' },
  { re: /(?:^|[\s(])@[a-z0-9_]{4,}/i, label: 'ник в мессенджере' },
  { re: /\b(?:t\.me|telegram\.me|vk\.com|vk\.ru|wa\.me|instagram\.com|tiktok\.com|discord\.gg|ok\.ru)\b/i, label: 'ссылку на личную страницу' },
]

export function findContact(text: string): string | null {
  for (const { re, label } of CONTACT_PATTERNS) if (re.test(text)) return label
  return null
}

/** Базовый словарь оскорблений. Совпадение не блокирует, а отправляет текст на проверку модератору. */
const TOXIC = [
  'дурак', 'дура(?![а-яё])', 'туп(?:ой|ая|ые|ица)', 'идиот', 'дебил', 'урод', 'лох(?:и|ом|у)?(?![а-яё])',
  'чмо(?![а-яё])', 'ничтожеств', 'убей себя', 'сдохни', 'заткнись', 'позорищ', 'неудачни', 'жирдя', 'бесишь',
]
const TOXIC_RE = new RegExp(`(?<![а-яё])(?:${TOXIC.join('|')})`, 'iu')

export function looksToxic(text: string) {
  return TOXIC_RE.test(text)
}

/** Бросает 422, если в тексте есть контакты. */
export function assertNoContacts(...texts: string[]) {
  for (const t of texts) {
    const found = findContact(t)
    if (found) {
      throw new HttpError(
        422,
        `Похоже, в тексте есть ${found}. Контакты на платформе не публикуются — так безопаснее для всех. Общайтесь через личные сообщения внутри платформы.`,
        'contacts',
      )
    }
  }
}
