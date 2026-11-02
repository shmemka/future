export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message) }
}

/** Статичная сборка (GitHub Pages): API работает прямо в браузере, без сервера */
export const STATIC_MODE = import.meta.env.VITE_STATIC === '1'

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let status: number
  let data: any
  if (STATIC_MODE) {
    const engine = await import('../offline/engine')
    ;({ status, data } = await engine.request(method, url, body))
  } else {
    const res = await fetch(`/api${url}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    status = res.status
    data = await res.json().catch(() => ({}))
  }
  if (status >= 400) throw new ApiError(status, data?.error ?? 'Не удалось выполнить запрос', data?.code)
  return data as T
}

export const api = {
  get: <T = any>(url: string) => request<T>('GET', url),
  post: <T = any>(url: string, body: unknown = {}) => request<T>('POST', url, body),
  put: <T = any>(url: string, body: unknown) => request<T>('PUT', url, body),
  patch: <T = any>(url: string, body: unknown) => request<T>('PATCH', url, body),
  del: <T = any>(url: string) => request<T>('DELETE', url),
}

/** Сброс демо-данных на этом устройстве (только для статичной сборки) */
export async function resetDemoData() {
  const engine = await import('../offline/engine')
  await engine.resetDemo()
}
