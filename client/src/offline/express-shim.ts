// Минимальная замена Express для браузерной версии сайта.
// Поддерживает ровно то, что используют маршруты: Router, use (с путём и без), get/post/put/patch/delete,
// параметры пути (:id), цепочки middleware и ошибки, брошенные в обработчиках.

type Next = (err?: unknown) => void
type Fn = (req: any, res: any, next: Next) => unknown
interface Layer { method?: string; prefix?: string; regex?: RegExp; keys: string[]; fns: (Fn | RouterImpl)[] }

class RouterImpl {
  private layers: Layer[] = []

  use(a: string | Fn | RouterImpl, ...rest: (Fn | RouterImpl)[]) {
    if (typeof a === 'string') this.layers.push({ prefix: a, keys: [], fns: rest })
    else this.layers.push({ prefix: '', keys: [], fns: [a, ...rest] })
    return this
  }
  private route(method: string, path: string, fns: Fn[]) {
    const keys: string[] = []
    const pattern = path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)' })
    this.layers.push({ method, regex: new RegExp(`^${pattern === '/' ? '/?' : pattern + '/?'}$`), keys, fns })
    return this
  }
  get(p: string, ...f: Fn[]) { return this.route('GET', p, f) }
  post(p: string, ...f: Fn[]) { return this.route('POST', p, f) }
  put(p: string, ...f: Fn[]) { return this.route('PUT', p, f) }
  patch(p: string, ...f: Fn[]) { return this.route('PATCH', p, f) }
  delete(p: string, ...f: Fn[]) { return this.route('DELETE', p, f) }

  handle(req: any, res: any, done: Next) {
    let i = 0
    const path: string = req.path
    const next: Next = (err) => {
      if (res.finished) return
      if (err) return done(err)
      const layer = this.layers[i++]
      if (!layer) return done()
      if (layer.method) {
        if (layer.method !== req.method) return next()
        const m = layer.regex!.exec(path)
        if (!m) return next()
        req.params = { ...req.params }
        layer.keys.forEach((k, j) => { req.params[k] = decodeURIComponent(m[j + 1]) })
        return runChain(layer.fns, req, res, next)
      }
      const pre = layer.prefix!
      if (pre && path !== pre && !path.startsWith(pre + '/')) return next()
      const sub = pre ? path.slice(pre.length) || '/' : path
      return runChain(layer.fns, req, res, next, sub)
    }
    next()
  }
}

function runChain(fns: (Fn | RouterImpl)[], req: any, res: any, out: Next, subPath?: string) {
  let k = 0
  const step: Next = (err) => {
    if (res.finished) return
    if (err) return out(err)
    const fn = fns[k++]
    if (!fn) return out()
    try {
      if (fn instanceof RouterImpl) {
        const saved = req.path
        req.path = subPath ?? saved
        fn.handle(req, res, (e) => { req.path = saved; step(e) })
      } else {
        const r = fn(req, res, step)
        if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch(step)
      }
    } catch (e) { step(e) }
  }
  step()
}

export function Router() { return new RouterImpl() }
export type { RouterImpl }
export default { Router }
