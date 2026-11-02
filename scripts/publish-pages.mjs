// Кладёт статичную сборку в корень репозитория, чтобы GitHub Pages («Deploy from branch: main / root»)
// показывал приложение вместо README. Запуск: npm run build:pages
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, '.pages-dist')

fs.rmSync(path.join(root, 'assets'), { recursive: true, force: true })
fs.cpSync(path.join(out, 'assets'), path.join(root, 'assets'), { recursive: true })
for (const f of fs.readdirSync(out)) {
  if (f === 'assets') continue
  fs.cpSync(path.join(out, f), path.join(root, f), { recursive: true })
}
// Любой адрес внутри сайта (например, /future/courses/emocii) открывает приложение
fs.copyFileSync(path.join(out, 'index.html'), path.join(root, '404.html'))
// Отключаем Jekyll: он мешает отдавать файлы как есть
fs.writeFileSync(path.join(root, '.nojekyll'), '')
fs.rmSync(out, { recursive: true, force: true })
console.log('Статичная сборка опубликована в корень репозитория: index.html, 404.html, assets/')
