import { useCallback, useEffect, useState } from 'react';
import type { Ctx } from '../App';
import { dt, errText, money, sb, type DealEvent, type Payment } from '../lib/data';
import { CATEGORIES, nextStage, ROLES, slaFor, stageById, stageIndex, STAGES, type StageId } from '../lib/stages';
import { addWorkHours, formatLeft } from '../lib/workhours';
import { Dot, dealLight } from './parts';

export default function DealView({ id, me, team, deals, reload }: Ctx & { id: number }) {
  const d = deals.find((x) => x.id === id);
  const [events, setEvents] = useState<DealEvent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [checks, setChecks] = useState<boolean[]>([]);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [back, setBack] = useState<StageId | ''>('');

  const load = useCallback(async () => {
    const [e, p] = await Promise.all([
      sb.from('deal_events').select('*').eq('deal_id', id).order('created_at', { ascending: false }),
      sb.from('payments').select('*').eq('deal_id', id).order('paid_at'),
    ]);
    setEvents((e.data as DealEvent[]) ?? []);
    setPayments((p.data as Payment[]) ?? []);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (d) setChecks(stageById(d.stage).checks.map(() => false)); }, [d?.stage]);

  if (!d) return <p className="muted">Заявка не найдена или ещё загружается.</p>;

  const st = stageById(d.stage);
  const sla = slaFor(st, d.category);
  const start = new Date(d.stage_started_at);
  const canAct = d.status === 'active' && (me.role === st.role || me.role === 'director');
  const isMoney = me.role === 'accountant' || me.role === 'director';
  const name = (uid: string | null) => team.find((p) => p.id === uid)?.full_name ?? '—';
  const allChecked = checks.length === 0 || checks.every(Boolean);
  const fullyPaid = d.amount_total > 0 && d.amount_paid >= d.amount_total;

  const act = async (fn: () => Promise<{ error: unknown } | void>) => {
    setErr('');
    const r = await fn();
    if (r && r.error) return setErr(errText(r.error));
    await Promise.all([reload(), load()]);
  };

  const move = (to: StageId, kind: 'stage' | 'return', text?: string) =>
    act(async () => {
      const patch: Record<string, unknown> = { stage: to };
      if (to === 'done') patch.status = 'done';
      const { error } = await sb.from('deals').update(patch).eq('id', d.id);
      if (error) return { error };
      return sb.from('deal_events').insert({ deal_id: d.id, kind, from_stage: d.stage, to_stage: to, text: text || null });
    });

  const comment = (kind: 'comment' | 'escalation') =>
    note.trim() && act(async () => {
      const r = await sb.from('deal_events').insert({ deal_id: d.id, kind, text: note.trim() });
      if (!r.error) setNote('');
      return r;
    });

  // Возможные следующие шаги: обычный и, если следующий этап необязательный, — «пропустить».
  const nextFull = nextStage(d.stage, false);
  const nextSkip = nextStage(d.stage, true);
  const prev = STAGES.slice(0, stageIndex(d.stage));

  return (
    <>
      <div className="title">
        <h1>{d.client_company} <span className="tag">{d.category}</span></h1>
        <span className="muted">#{d.id} · создана {dt(d.created_at)} · менеджер {name(d.owner_id)}</span>
      </div>
      {err && <p className="err card pad">{err}</p>}

      <div className="two">
        <div>
          <section className="card pad">
            <div className="stagehead">
              <Dot l={dealLight(d)} />
              <div className="grow">
                <div className="muted">Этап {stageIndex(d.stage) + 1} из {STAGES.length}</div>
                <h2 className="nm">{st.name}</h2>
                <div>Исполнитель: <b>{ROLES[st.role].name}</b></div>
              </div>
              {d.status === 'active' && sla > 0 && (
                <div className="right">
                  <div>Срок: {dt(addWorkHours(start, sla).toISOString())}</div>
                  <div className={`left ${dealLight(d)}`}>{formatLeft(start, sla)}</div>
                </div>
              )}
              {d.status !== 'active' && <b>{d.status === 'done' ? 'Закрыта' : 'Потеряна'}</b>}
            </div>
            {st.gov && <p className="muted">Срок госоргана по категории: {CATEGORIES[d.category]?.note}</p>}

            {d.status === 'active' && st.checks.length > 0 && (
              <>
                <h3>Без чего не передавать дальше</h3>
                {st.checks.map((c, i) => (
                  <label key={c} className="check">
                    <input type="checkbox" disabled={!canAct} checked={checks[i] ?? false}
                      onChange={(e) => setChecks(checks.map((v, j) => (j === i ? e.target.checked : v)))} />
                    {c}
                  </label>
                ))}
              </>
            )}

            {d.stage === 'prepay' && d.amount_paid <= 0 && (
              <p className="warn">Предоплата не поступила — работа по заявке не начинается.</p>
            )}
            {d.stage === 'handover' && !fullyPaid && (
              <p className="warn">Оплата не полная ({money(d.amount_paid)} из {money(d.amount_total)}) — паспорта и приглашения клиенту не выдавать.</p>
            )}

            {canAct && nextFull && (
              <div className="actions">
                <button disabled={!allChecked} onClick={() => move(nextFull, 'stage')}>
                  Передать: {stageById(nextFull).name} ({ROLES[stageById(nextFull).role].short})
                </button>
                {nextSkip && nextSkip !== nextFull && (
                  <button className="ghost" disabled={!allChecked} onClick={() => move(nextSkip, 'stage', `Пропущен этап «${stageById(nextFull).name}»`)}>
                    Без этапа «{stageById(nextFull).name}» → {stageById(nextSkip).name}
                  </button>
                )}
              </div>
            )}
            {!allChecked && canAct && <p className="muted small">Отметьте все условия, чтобы передать заявку.</p>}
            {!canAct && d.status === 'active' && <p className="muted small">Передать дальше может {ROLES[st.role].name.toLowerCase()} или директор.</p>}

            {canAct && prev.length > 0 && (
              <div className="actions">
                <select value={back} onChange={(e) => setBack(e.target.value as StageId)}>
                  <option value="">Вернуть на этап…</option>
                  {prev.map((s) => <option key={s.id} value={s.id}>{s.name} ({ROLES[s.role].short})</option>)}
                </select>
                <button className="ghost" disabled={!back || !note.trim()}
                  onClick={() => back && move(back, 'return', note.trim()).then(() => { setNote(''); setBack(''); })}>
                  Вернуть с комментарием
                </button>
              </div>
            )}
          </section>

          <section className="card pad">
            <h3>Комментарий</h3>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Что сделано, что мешает, причина возврата" />
            <div className="actions">
              <button className="ghost" disabled={!note.trim()} onClick={() => comment('comment')}>Добавить</button>
              <button className="ghost danger" disabled={!note.trim()} onClick={() => comment('escalation')}>Эскалировать директору</button>
              {d.status === 'active' && (me.role === 'manager' || me.role === 'director') && (
                <button className="ghost" disabled={!note.trim()} onClick={() => act(async () => {
                  const r = await sb.from('deals').update({ status: 'lost', lost_reason: note.trim() }).eq('id', d.id);
                  if (r.error) return r;
                  setNote('');
                  return sb.from('deal_events').insert({ deal_id: d.id, kind: 'comment', text: `Заявка потеряна: ${note.trim()}` });
                })}>Отказ клиента</button>
              )}
            </div>
          </section>

          <section className="card pad">
            <h3>История</h3>
            <ul className="history">
              {events.map((e) => (
                <li key={e.id} className={e.kind}>
                  <span className="muted">{dt(e.created_at)} · {name(e.created_by)}</span>
                  <div>
                    {e.kind === 'stage' && <>→ {stageById(e.to_stage as StageId)?.name}</>}
                    {e.kind === 'return' && <>↩ возврат на «{stageById(e.to_stage as StageId)?.name}»</>}
                    {e.kind === 'escalation' && <b>Эскалация: </b>}
                    {e.kind === 'created' && <>Лид создан. </>}
                    {e.kind === 'payment' && <>Оплата: </>}
                    {e.text && <> {e.text}</>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside>
          <Info d={d} canEdit={me.role !== 'courier'} team={team} after={reload} />
          <Money d={d} payments={payments} canEdit={isMoney} after={() => Promise.all([reload(), load()]).then(() => undefined)} />
        </aside>
      </div>
    </>
  );
}

function Info({ d, canEdit, team, after }: { d: NonNullable<Ctx['deals'][number]>; canEdit: boolean; team: Ctx['team']; after: () => Promise<void> }) {
  const [f, setF] = useState(d);
  const [msg, setMsg] = useState('');
  useEffect(() => setF(d), [d]);
  const field = (k: 'contact_name' | 'contact_phone' | 'client_bin' | 'request', label: string, area = false) => (
    <label>{label}
      {area
        ? <textarea rows={3} disabled={!canEdit} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        : <input disabled={!canEdit} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
    </label>
  );
  const save = async () => {
    const { error } = await sb.from('deals').update({
      contact_name: f.contact_name, contact_phone: f.contact_phone, client_bin: f.client_bin,
      request: f.request, category: f.category, people_count: f.people_count, owner_id: f.owner_id,
    }).eq('id', d.id);
    setMsg(error ? errText(error) : 'Сохранено');
    await after();
  };
  return (
    <section className="card pad form">
      <h3>Клиент</h3>
      {field('contact_name', 'Контакт')}
      {field('contact_phone', 'Телефон')}
      {field('client_bin', 'БИН')}
      <label>Категория
        <select disabled={!canEdit} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {Object.keys(CATEGORIES).map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label>Иностранцев, чел.<input type="number" min={1} disabled={!canEdit} value={f.people_count}
        onChange={(e) => setF({ ...f, people_count: Number(e.target.value) })} /></label>
      <label>Менеджер
        <select disabled={!canEdit} value={f.owner_id ?? ''} onChange={(e) => setF({ ...f, owner_id: e.target.value })}>
          {team.filter((p) => p.role).map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
        </select>
      </label>
      {field('request', 'Суть запроса', true)}
      <div className="muted small">Источник: {d.source ?? '—'}</div>
      {canEdit && <button className="ghost" onClick={save}>Сохранить</button>}
      {msg && <span className="small">{msg}</span>}
    </section>
  );
}

function Money({ d, payments, canEdit, after }: { d: NonNullable<Ctx['deals'][number]>; payments: Payment[]; canEdit: boolean; after: () => Promise<void> }) {
  const [total, setTotal] = useState(String(d.amount_total));
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<Payment['kind']>('prepay');
  const [err, setErr] = useState('');
  useEffect(() => setTotal(String(d.amount_total)), [d.amount_total]);

  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setErr('');
    const { error } = await fn();
    if (error) setErr(errText(error));
    await after();
  };
  const left = d.amount_total - d.amount_paid;
  const KIND = { prepay: 'Предоплата', final: 'Доплата', fee: 'Госпошлина (за клиента)' };

  return (
    <section className="card pad form">
      <h3>Оплата</h3>
      <div className="sum">
        <div>Договор<b>{money(d.amount_total)}</b></div>
        <div>Оплачено<b>{money(d.amount_paid)}</b></div>
        <div>Долг<b className={left > 0 ? 'red' : 'green'}>{money(Math.max(left, 0))}</b></div>
      </div>
      {canEdit && (
        <label>Сумма договора, ₸
          <span className="inline">
            <input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
            <button className="ghost" onClick={() => run(() => sb.from('deals').update({ amount_total: Number(total) }).eq('id', d.id))}>OK</button>
          </span>
        </label>
      )}
      <ul className="pays">
        {payments.map((p) => <li key={p.id}>{p.paid_at} · {KIND[p.kind]} · <b>{money(p.amount)}</b></li>)}
        {!payments.length && <li className="muted">Оплат нет</li>}
      </ul>
      {canEdit && (
        <>
          <span className="inline">
            <input inputMode="decimal" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <select value={kind} onChange={(e) => setKind(e.target.value as Payment['kind'])}>
              {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </span>
          <button className="ghost" disabled={!(Number(amount) > 0)} onClick={() => run(async () => {
            const r = await sb.from('payments').insert({ deal_id: d.id, amount: Number(amount), kind });
            if (!r.error) {
              setAmount('');
              await sb.from('deal_events').insert({ deal_id: d.id, kind: 'payment', text: `${KIND[kind]} ${money(Number(amount))}` });
            }
            return r;
          })}>Внести оплату</button>
        </>
      )}
      {err && <p className="err">{err}</p>}
    </section>
  );
}
