import { useState, type DragEvent } from 'react';
import type { Ctx } from '../App';
import { canAct, forwardTargets, moveDeal } from '../lib/actions';
import { errText, money, type Deal } from '../lib/data';
import { CATEGORIES, ROLES, slaFor, stageById, STAGES, type StageId } from '../lib/stages';
import { formatLeft } from '../lib/workhours';
import { byUrgency, dealLight, Dot } from './parts';

export default function Board({ me, team, deals, reload, go }: Ctx) {
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [drag, setDrag] = useState<Deal | null>(null);
  const [over, setOver] = useState<StageId | null>(null);
  const [pending, setPending] = useState<{ d: Deal; to: StageId } | null>(null);

  const list = deals.filter((d) =>
    (d.status === 'active' || (showClosed && d.status === 'done')) &&
    (!cat || d.category === cat) &&
    (!onlyMine || stageById(d.stage).role === me.role) &&
    (!q || `${d.client_company} ${d.contact_name ?? ''} ${d.client_bin ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  );
  const red = list.filter((d) => d.status === 'active' && dealLight(d) === 'red').length;
  const targets = drag ? forwardTargets(drag) : [];
  const owner = (id: string | null) => team.find((p) => p.id === id)?.full_name?.split(' ')[0] ?? '';

  const onDrop = (to: StageId) => (e: DragEvent) => {
    e.preventDefault();
    if (drag && targets.includes(to)) setPending({ d: drag, to });
    setDrag(null);
    setOver(null);
  };

  return (
    <>
      <div className="boardhead">
        <h1>Воронка заявок</h1>
        <div className="filters">
          <input placeholder="Поиск: компания, контакт, БИН" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Все категории</option>
            {Object.keys(CATEGORIES).map((c) => <option key={c}>{c}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> мои этапы</label>
          <label className="check"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> закрытые</label>
          <span className="muted">{list.length} заявок · просрочено <b className={red ? 'red' : ''}>{red}</b></span>
        </div>
        <p className="muted small">Перетащите карточку на следующий этап, если он ваш. Подсвечены колонки, куда её можно передать.</p>
      </div>

      <div className="kanban">
        {STAGES.map((s, i) => {
          if (s.id === 'done' && !showClosed) return null;
          const items = list.filter((d) => d.stage === s.id).sort(byUrgency);
          const reds = items.filter((d) => dealLight(d) === 'red').length;
          const newGroup = i === 0 || STAGES[i - 1].group !== s.group;
          const allowed = targets.includes(s.id);
          return (
            <div key={s.id}
              className={`kcol ${allowed ? 'allowed' : ''} ${over === s.id && allowed ? 'over' : ''} ${drag && !allowed && drag.stage !== s.id ? 'dim' : ''}`}
              onDragOver={(e) => { if (allowed) { e.preventDefault(); setOver(s.id); } }}
              onDragLeave={() => setOver(null)}
              onDrop={onDrop(s.id)}>
              <div className="khead">
                <div className="kgroup">{newGroup ? s.group : ' '}</div>
                <div className="kname"><b>{s.name}</b>{s.optional && <span className="muted small"> · по необходимости</span>}</div>
                <div className="muted small">
                  {ROLES[s.role].short} · {items.length}{reds > 0 && <b className="red"> · {reds} просроч.</b>}
                </div>
              </div>
              <div className="kbody">
                {items.map((d) => {
                  const l = dealLight(d);
                  const sla = slaFor(stageById(d.stage), d.category);
                  const movable = canAct(d, me.role);
                  return (
                    <div key={d.id} className={`kcard ${l} ${movable ? 'movable' : ''} ${drag?.id === d.id ? 'dragging' : ''}`}
                      draggable={movable}
                      onDragStart={(e) => { setDrag(d); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => { setDrag(null); setOver(null); }}
                      onClick={() => go(`/deal/${d.id}`)}>
                      <div className="kt"><Dot l={l} /><b>{d.client_company}</b></div>
                      <div className="km">
                        <span className="tag">{d.category}</span>
                        {d.people_count > 1 && <span>{d.people_count} чел.</span>}
                        {owner(d.owner_id) && <span>{owner(d.owner_id)}</span>}
                      </div>
                      {d.status === 'active' && sla > 0 && (
                        <div className={`left ${l}`}>{formatLeft(new Date(d.stage_started_at), sla)}</div>
                      )}
                      {d.amount_total > 0 && d.amount_paid < d.amount_total && (
                        <div className="debt">долг {money(d.amount_total - d.amount_paid)}</div>
                      )}
                    </div>
                  );
                })}
                {!items.length && <div className="kempty">—</div>}
              </div>
            </div>
          );
        })}
      </div>

      {pending && <MoveDialog {...pending} onClose={() => setPending(null)} onDone={async () => { setPending(null); await reload(); }} />}
    </>
  );
}

function MoveDialog({ d, to, onClose, onDone }: { d: Deal; to: StageId; onClose: () => void; onDone: () => Promise<void> }) {
  const from = stageById(d.stage);
  const target = stageById(to);
  const [checks, setChecks] = useState(from.checks.map(() => false));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const skipped = forwardTargets(d)[0] !== to ? forwardTargets(d)[0] : null;
  const fullyPaid = d.amount_total > 0 && d.amount_paid >= d.amount_total;

  const confirm = async () => {
    setBusy(true);
    setErr('');
    const r = await moveDeal(d, to, 'stage', skipped ? `Пропущен этап «${stageById(skipped).name}»` : undefined);
    setBusy(false);
    if (r && r.error) return setErr(errText(r.error));
    await onDone();
  };

  return (
    <div className="modalbg" onClick={onClose}>
      <div className="modal card pad" onClick={(e) => e.stopPropagation()}>
        <h2 className="nm">{d.client_company}</h2>
        <p>
          {from.name} ({ROLES[from.role].short}) → <b>{target.name}</b> ({ROLES[target.role].short})
          {skipped && <span className="muted"> · без этапа «{stageById(skipped).name}»</span>}
        </p>
        {from.checks.length > 0 && <h3>Без чего не передавать</h3>}
        {from.checks.map((c, i) => (
          <label key={c} className="check">
            <input type="checkbox" checked={checks[i]} onChange={(e) => setChecks(checks.map((v, j) => (j === i ? e.target.checked : v)))} />
            {c}
          </label>
        ))}
        {d.stage === 'prepay' && d.amount_paid <= 0 && <p className="warn">Предоплата не поступила — работа не начнётся.</p>}
        {d.stage === 'handover' && !fullyPaid && <p className="warn">Оплата не полная — документы клиенту не выдаются.</p>}
        {err && <p className="err">{err}</p>}
        <div className="actions">
          <button disabled={busy || !checks.every(Boolean)} onClick={confirm}>Передать</button>
          <button className="ghost" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
