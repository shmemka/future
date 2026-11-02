import type { ErrorRequestHandler } from 'express'
import { z, ZodError } from 'zod'
import { HttpError } from './auth.js'

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data)
}

export const idParam = (v: unknown) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Некорректный идентификатор')
  return n
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const first = err.issues[0]
    return res.status(400).json({ error: first?.message ?? 'Проверьте заполнение полей', field: first?.path?.join('.') })
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code })
  }
  console.error(err)
  res.status(500).json({ error: 'Что-то сломалось на сервере. Попробуйте ещё раз через минуту.' })
}

// Переиспользуемые схемы
export const text = (min: number, max: number, label: string) =>
  z.string().trim()
    .min(min, `${label}: минимум ${min} симв.`)
    .max(max, `${label}: максимум ${max} симв.`)
