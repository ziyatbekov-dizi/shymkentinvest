import type { Deal } from '../lib/data';
import { money } from '../lib/data';
import { ROLES, slaFor, stageById } from '../lib/stages';
import { formatLeft, light, type Light } from '../lib/workhours';

export const dealLight = (d: Deal, now = new Date()): Light => {
  if (d.status !== 'active') return 'green';
  return light(new Date(d.stage_started_at), slaFor(stageById(d.stage), d.category), now);
};

const ORDER: Record<Light, number> = { red: 0, yellow: 1, green: 2 };
export const byUrgency = (a: Deal, b: Deal) =>
  ORDER[dealLight(a)] - ORDER[dealLight(b)] ||
  new Date(a.stage_started_at).getTime() - new Date(b.stage_started_at).getTime();

export function Dot({ l }: { l: Light }) {
  return <span className={`dot ${l}`} title={{ green: 'в лимите', yellow: 'меньше четверти лимита', red: 'просрочено' }[l]} />;
}

export function DealRow({ d, showStage = true }: { d: Deal; showStage?: boolean }) {
  const st = stageById(d.stage);
  const sla = slaFor(st, d.category);
  const l = dealLight(d);
  return (
    <a className="row" href={`#/deal/${d.id}`}>
      <Dot l={l} />
      <span className="grow">
        <b>{d.client_company}</b> <span className="tag">{d.category}</span>
        {d.people_count > 1 && <span className="muted"> · {d.people_count} чел.</span>}
      </span>
      {showStage && <span className="muted">{st.name} · {ROLES[st.role].short}</span>}
      <span className={`left ${l}`}>{d.status === 'active' ? formatLeft(new Date(d.stage_started_at), sla) : ''}</span>
      {d.amount_total > 0 && d.amount_paid < d.amount_total && (
        <span className="debt" title="Не оплачено">{money(d.amount_total - d.amount_paid)}</span>
      )}
    </a>
  );
}
