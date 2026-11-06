import { useState } from 'react';
import type { Ctx } from '../App';
import { CATEGORIES, ROLES, STAGES } from '../lib/stages';
import { byUrgency, DealRow, dealLight } from './parts';

export default function Board({ deals }: Ctx) {
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  const list = deals.filter((d) =>
    (showClosed || d.status === 'active') &&
    (!cat || d.category === cat) &&
    (!q || `${d.client_company} ${d.contact_name ?? ''} ${d.client_bin ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  );

  const groups = [...new Set(STAGES.map((s) => s.group))];
  const red = list.filter((d) => d.status === 'active' && dealLight(d) === 'red').length;

  return (
    <>
      <h1>Воронка заявок</h1>
      <div className="filters">
        <input placeholder="Поиск: компания, контакт, БИН" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Все категории</option>
          {Object.keys(CATEGORIES).map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> закрытые</label>
        <span className="muted">{list.length} заявок · просрочено {red}</span>
      </div>

      {groups.map((g) => {
        const stages = STAGES.filter((s) => s.group === g);
        const inGroup = list.filter((d) => stages.some((s) => s.id === d.stage));
        return (
          <section key={g}>
            <h2>{g} <span className="muted">· {inGroup.length}</span></h2>
            <div className="cols">
              {stages.map((s) => {
                const items = list.filter((d) => d.stage === s.id).sort(byUrgency);
                if (s.id === 'done' && !showClosed) return null;
                return (
                  <div key={s.id} className="col card">
                    <div className="colhead">
                      <b>{s.name}</b>
                      <span className="muted">{ROLES[s.role].short} · {items.length}</span>
                    </div>
                    {items.map((d) => <DealRow key={d.id} d={d} showStage={false} />)}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
