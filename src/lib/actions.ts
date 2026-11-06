import { sb, type Deal } from './data';
import type { Role, StageId } from './stages';
import { nextStage, stageById } from './stages';

/** Переводит заявку на этап и пишет событие в историю. Ошибки триггеров (оплата) возвращаются как error. */
export async function moveDeal(d: Deal, to: StageId, kind: 'stage' | 'return', text?: string) {
  const patch: Record<string, unknown> = { stage: to };
  if (to === 'done') patch.status = 'done';
  const { error } = await sb.from('deals').update(patch).eq('id', d.id);
  if (error) return { error };
  return sb.from('deal_events').insert({ deal_id: d.id, kind, from_stage: d.stage, to_stage: to, text: text || null });
}

/** Может ли роль передать заявку дальше. */
export const canAct = (d: Deal, role: Role | null) =>
  d.status === 'active' && (role === stageById(d.stage).role || role === 'director');

/** Куда заявку можно передать вперёд: следующий этап и, если он необязательный, — следующий за ним. */
export function forwardTargets(d: Deal): StageId[] {
  const full = nextStage(d.stage, false);
  const skip = nextStage(d.stage, true);
  return [full, skip].filter((s, i, a): s is StageId => !!s && a.indexOf(s) === i);
}
