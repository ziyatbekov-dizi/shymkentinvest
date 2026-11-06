import type { Ctx } from '../App';
import { ROLES, stageById } from '../lib/stages';
import { byUrgency, DealRow, dealLight } from './parts';

export default function MyTasks({ me, deals }: Ctx) {
  const active = deals.filter((d) => d.status === 'active');
  const mine = active.filter((d) => stageById(d.stage).role === me.role).sort(byUrgency);
  const red = active.filter((d) => dealLight(d) === 'red').sort(byUrgency);
  const myLeads = deals
    .filter((d) => me.role === 'ads' && d.created_by === me.id)
    .slice(-30)
    .reverse();

  return (
    <>
      <h1>Мои задачи — {ROLES[me.role!].name}</h1>
      <p className="muted">Заявки, которые сейчас на вашем этапе. Сначала просроченные.</p>
      <div className="card list">
        {mine.length ? mine.map((d) => <DealRow key={d.id} d={d} />) : <p className="muted pad">На вашем этапе заявок нет.</p>}
      </div>

      {me.role === 'ads' && (
        <>
          <h2>Последние лиды из рекламы</h2>
          <div className="card list">
            {myLeads.length ? myLeads.map((d) => <DealRow key={d.id} d={d} />) : <p className="muted pad">Пока нет.</p>}
          </div>
        </>
      )}

      {me.role !== 'director' && red.length > 0 && (
        <>
          <h2>Просрочено у команды</h2>
          <div className="card list">{red.map((d) => <DealRow key={d.id} d={d} />)}</div>
        </>
      )}
    </>
  );
}
