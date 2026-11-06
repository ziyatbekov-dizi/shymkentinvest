import { useEffect, useState } from 'react';
import type { Ctx } from '../App';
import { dt, errText, money, sb, type DealEvent } from '../lib/data';
import { ROLES, STAGES, stageById, type Role } from '../lib/stages';
import { byUrgency, DealRow, dealLight } from './parts';

export default function Director({ deals, team, reload }: Ctx) {
  const [esc, setEsc] = useState<DealEvent[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    const since = new Date(Date.now() - 14 * 864e5).toISOString();
    sb.from('deal_events').select('*').eq('kind', 'escalation').gte('created_at', since)
      .order('created_at', { ascending: false })
      .then(({ data }) => setEsc((data as DealEvent[]) ?? []));
  }, [deals]);

  const active = deals.filter((d) => d.status === 'active');
  const red = active.filter((d) => dealLight(d) === 'red').sort(byUrgency);
  const mine = active.filter((d) => stageById(d.stage).role === 'director').sort(byUrgency);
  const afterHandover = ['act', 'closing', 'done'];
  const debt = deals.filter((d) => d.amount_total > d.amount_paid && afterHandover.includes(d.stage));
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const newThisMonth = deals.filter((d) => new Date(d.created_at) >= monthStart);
  const paidThisMonth = newThisMonth.filter((d) => d.amount_paid > 0).length;

  const bySource = Object.entries(
    newThisMonth.reduce<Record<string, { leads: number; paid: number; sum: number }>>((acc, d) => {
      const k = d.source ?? '—';
      acc[k] ??= { leads: 0, paid: 0, sum: 0 };
      acc[k].leads++;
      if (d.amount_paid > 0) { acc[k].paid++; acc[k].sum += Number(d.amount_paid); }
      return acc;
    }, {}),
  ).sort((a, b) => b[1].sum - a[1].sum);

  const setRole = async (id: string, role: string) => {
    setErr('');
    const { error } = await sb.from('profiles').update({ role: role || null }).eq('id', id);
    if (error) setErr(errText(error));
    await reload();
  };
  const company = (id: number) => deals.find((d) => d.id === id)?.client_company ?? `#${id}`;

  return (
    <>
      <h1>Панель директора</h1>
      <div className="kpis">
        <div className="card pad"><span className="muted">В работе</span><b>{active.length}</b></div>
        <div className="card pad"><span className="muted">Просрочено</span><b className="red">{red.length}</b></div>
        <div className="card pad"><span className="muted">Лиды за месяц → оплата</span><b>{newThisMonth.length} → {paidThisMonth}</b></div>
        <div className="card pad"><span className="muted">Долг после выдачи</span><b>{money(debt.reduce((s, d) => s + d.amount_total - d.amount_paid, 0))}</b></div>
      </div>

      <h2>Ждут вашего решения</h2>
      <div className="card list">{mine.length ? mine.map((d) => <DealRow key={d.id} d={d} />) : <p className="muted pad">Нет.</p>}</div>

      <h2>Эскалации за 14 дней</h2>
      <div className="card list">
        {esc.length ? esc.map((e) => (
          <a key={e.id} className="row" href={`#/deal/${e.deal_id}`}>
            <span className="muted">{dt(e.created_at)}</span>
            <b>{company(e.deal_id)}</b>
            <span className="grow">{e.text}</span>
          </a>
        )) : <p className="muted pad">Нет.</p>}
      </div>

      <h2>Просрочено</h2>
      <div className="card list">{red.length ? red.map((d) => <DealRow key={d.id} d={d} />) : <p className="muted pad">Всё в сроках.</p>}</div>

      <h2>Воронка по этапам</h2>
      <div className="card pad funnel">
        {STAGES.filter((s) => s.id !== 'done').map((s) => {
          const n = active.filter((d) => d.stage === s.id).length;
          const r = active.filter((d) => d.stage === s.id && dealLight(d) === 'red').length;
          return (
            <div key={s.id} className="frow">
              <span>{s.name} <span className="muted">· {ROLES[s.role].short}</span></span>
              <span className="bar"><i style={{ width: `${Math.min(100, n * 10)}%` }} /></span>
              <span>{n}{r > 0 && <b className="red"> ({r})</b>}</span>
            </div>
          );
        })}
      </div>

      <h2>Источники лидов за месяц</h2>
      <table className="card tbl">
        <thead><tr><th>Источник</th><th>Лиды</th><th>С оплатой</th><th>Получено</th></tr></thead>
        <tbody>
          {bySource.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.leads}</td><td>{v.paid}</td><td>{money(v.sum)}</td></tr>)}
          {!bySource.length && <tr><td colSpan={4} className="muted">Нет данных</td></tr>}
        </tbody>
      </table>

      <h2>Команда</h2>
      <p className="muted">Новые сотрудники регистрируются сами, роль назначаете здесь. Без роли доступа к заявкам нет.</p>
      {err && <p className="err">{err}</p>}
      <table className="card tbl">
        <thead><tr><th>Сотрудник</th><th>E-mail</th><th>Роль</th></tr></thead>
        <tbody>
          {team.map((p) => (
            <tr key={p.id}>
              <td>{p.full_name}</td>
              <td className="muted">{p.email}</td>
              <td>
                <select value={p.role ?? ''} onChange={(e) => setRole(p.id, e.target.value)}>
                  <option value="">— нет доступа —</option>
                  {(Object.keys(ROLES) as Role[]).map((r) => <option key={r} value={r}>{ROLES[r].name}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
