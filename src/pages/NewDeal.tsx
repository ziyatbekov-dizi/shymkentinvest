import { useState, type FormEvent } from 'react';
import type { Ctx } from '../App';
import { errText, sb } from '../lib/data';
import { CATEGORIES } from '../lib/stages';

const SOURCES = ['Сайт / лендинг', 'Instagram', 'Facebook', '2ГИС', 'WhatsApp', 'Звонок', 'Рекомендация', 'Повторный клиент', 'Другое'];

export default function NewDeal({ me, team, reload, go }: Ctx) {
  const managers = team.filter((p) => p.role === 'manager');
  const [f, setF] = useState({
    client_company: '', client_bin: '', contact_name: '', contact_phone: '',
    category: 'C3', people_count: 1, source: SOURCES[0], request: '',
    owner_id: me.role === 'manager' ? me.id : managers[0]?.id ?? me.id,
  });
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: k === 'people_count' ? Number(e.target.value) : e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { data, error } = await sb.from('deals').insert(f).select('id').single();
    if (error) return setErr(errText(error));
    await sb.from('deal_events').insert({ deal_id: data.id, kind: 'created', to_stage: 'lead', text: `Источник: ${f.source}` });
    await reload();
    go(`/deal/${data.id}`);
  };

  return (
    <>
      <h1>Новая заявка</h1>
      <form className="card form grid2" onSubmit={submit}>
        <label>Компания*<input required value={f.client_company} onChange={set('client_company')} /></label>
        <label>БИН<input value={f.client_bin} onChange={set('client_bin')} inputMode="numeric" /></label>
        <label>Контактное лицо<input value={f.contact_name} onChange={set('contact_name')} /></label>
        <label>Телефон*<input required value={f.contact_phone} onChange={set('contact_phone')} /></label>
        <label>Категория
          <select value={f.category} onChange={set('category')}>
            {Object.keys(CATEGORIES).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Иностранцев, чел.<input type="number" min={1} value={f.people_count} onChange={set('people_count')} /></label>
        <label>Источник
          <select value={f.source} onChange={set('source')}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label>Ответственный менеджер
          <select value={f.owner_id} onChange={set('owner_id')}>
            {team.filter((p) => p.role === 'manager' || p.id === me.id).map((p) => (
              <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
            ))}
          </select>
        </label>
        <label className="span2">Суть запроса*<textarea required rows={3} value={f.request} onChange={set('request')} /></label>
        {err && <p className="err span2">{err}</p>}
        <button type="submit">Создать лид</button>
      </form>
    </>
  );
}
