import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { fromLocalInput, toLocalInput } from '../lib/format'
import { Button, Field, Modal, useToast } from './ui'
import { EVENT_KINDS } from '../../../shared/constants'

/** Создание и редактирование мероприятия (наставники и администраторы). Время вводится по Новосибирску. */
export function EventForm({ event, onClose, onSaved }: { event?: any; onClose: () => void; onSaved?: (id: number) => void }) {
  const [f, setF] = useState({
    title: event?.title ?? '',
    kind: event?.kind ?? 'masterclass',
    description: event?.description ?? '',
    starts_at: event ? toLocalInput(event.starts_at) : '',
    ends_at: event ? toLocalInput(event.ends_at) : '',
    location: event?.location ?? 'Подростковый центр проекта, Новосибирск',
    format: event?.format ?? 'offline',
    capacity: event?.capacity ?? 30,
    tokens_reward: event?.tokens_reward ?? 20,
    host: event?.host ?? '',
    published: event ? !!event.published : true,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const toast = useToast()
  const qc = useQueryClient()
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const save = async () => {
    setBusy(true); setErr('')
    try {
      if (!f.starts_at || !f.ends_at) throw new Error('Укажите дату и время начала и окончания')
      const body = { ...f, starts_at: fromLocalInput(f.starts_at), ends_at: fromLocalInput(f.ends_at) }
      const r = event ? await api.put(`/events/${event.id}`, body) : await api.post('/events', body)
      await qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['event'] })
      qc.invalidateQueries({ queryKey: ['overview'] })
      toast(event ? 'Мероприятие обновлено' : 'Мероприятие создано')
      onSaved?.(event?.id ?? r.id)
      onClose()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={event ? 'Редактировать мероприятие' : 'Новое мероприятие'} wide>
      <div className="grid gap-4">
        <Field label="Название"><input className="field" value={f.title} onChange={set('title')} /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Тип">
            <select className="field" value={f.kind} onChange={set('kind')}>
              {Object.entries(EVENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.title}</option>)}
            </select>
          </Field>
          <Field label="Формат">
            <select className="field" value={f.format} onChange={set('format')}>
              <option value="offline">Очно</option><option value="online">Онлайн</option>
            </select>
          </Field>
          <Field label="Начало (время Новосибирска)"><input className="field" type="datetime-local" value={f.starts_at} onChange={set('starts_at')} /></Field>
          <Field label="Окончание"><input className="field" type="datetime-local" value={f.ends_at} onChange={set('ends_at')} /></Field>
        </div>
        <Field label="Место"><input className="field" value={f.location} onChange={set('location')} /></Field>
        <Field label="Ведущие"><input className="field" value={f.host} onChange={set('host')} placeholder="Кто проводит" /></Field>
        <Field label="Описание"><textarea className="field min-h-32" value={f.description} onChange={set('description')} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Мест"><input className="field" type="number" min={1} value={f.capacity} onChange={set('capacity')} /></Field>
          <Field label="Жетонов за участие"><input className="field" type="number" min={0} max={100} value={f.tokens_reward} onChange={set('tokens_reward')} /></Field>
        </div>
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={f.published} onChange={set('published')} className="size-4 accent-[#5a1fe0]" />Опубликовано — видно участникам</label>
        {err && <p className="text-sm font-medium text-[#b0174f]" role="alert">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={save} loading={busy}>{event ? 'Сохранить изменения' : 'Создать мероприятие'}</Button>
        </div>
      </div>
    </Modal>
  )
}
