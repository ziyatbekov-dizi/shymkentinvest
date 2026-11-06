// Рабочее время: пн–пт, 9:00–18:00 по локальному времени браузера.
// Праздники РК — фиксированные даты; переносы и Курбан айт добавляйте в EXTRA_HOLIDAYS.

export const DAY_START = 9;
export const DAY_END = 18;

const FIXED_HOLIDAYS = ['01-01', '01-02', '01-07', '03-08', '03-21', '03-22', '03-23',
  '05-01', '05-07', '05-09', '07-06', '08-30', '10-25', '12-16'];

export const EXTRA_HOLIDAYS: string[] = [
  // 'YYYY-MM-DD' — например, перенесённые выходные и первый день Курбан айта
];

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function isWorkday(d: Date): boolean {
  const wd = d.getDay();
  if (wd === 0 || wd === 6) return false;
  const key = ymd(d);
  return !FIXED_HOLIDAYS.includes(key.slice(5)) && !EXTRA_HOLIDAYS.includes(key);
}

/** Сдвигает момент к ближайшему рабочему времени (или оставляет как есть). */
function normalize(d: Date): Date {
  const t = new Date(d);
  for (;;) {
    if (!isWorkday(t) || t.getHours() >= DAY_END) {
      t.setDate(t.getDate() + 1);
      t.setHours(DAY_START, 0, 0, 0);
      continue;
    }
    if (t.getHours() < DAY_START) t.setHours(DAY_START, 0, 0, 0);
    return t;
  }
}

/** Дедлайн: старт + N рабочих часов. */
export function addWorkHours(start: Date, hours: number): Date {
  let t = normalize(start);
  let left = hours * 60; // минуты
  while (left > 0) {
    const end = new Date(t);
    end.setHours(DAY_END, 0, 0, 0);
    const avail = (end.getTime() - t.getTime()) / 60000;
    if (left <= avail) return new Date(t.getTime() + left * 60000);
    left -= avail;
    t = normalize(end);
  }
  return t;
}

/** Рабочие часы между двумя моментами (b > a). */
export function workHoursBetween(a: Date, b: Date): number {
  if (b <= a) return 0;
  let t = normalize(a);
  let mins = 0;
  while (t < b) {
    const end = new Date(t);
    end.setHours(DAY_END, 0, 0, 0);
    const stop = end < b ? end : b;
    mins += Math.max(0, (stop.getTime() - t.getTime()) / 60000);
    if (end >= b) break;
    t = normalize(end);
  }
  return mins / 60;
}

export type Light = 'green' | 'yellow' | 'red';

/** Зелёный — в лимите; жёлтый — осталось меньше четверти; красный — просрочено. */
export function light(start: Date, slaHours: number, now = new Date()): Light {
  if (slaHours <= 0) return 'green';
  const used = workHoursBetween(start, now);
  if (used > slaHours) return 'red';
  if (slaHours - used < slaHours / 4) return 'yellow';
  return 'green';
}

export function formatLeft(start: Date, slaHours: number, now = new Date()): string {
  if (slaHours <= 0) return '';
  const left = slaHours - workHoursBetween(start, now);
  const abs = Math.abs(left);
  const txt = abs >= 9 ? `${(abs / 9).toFixed(1)} р.д.` : `${abs.toFixed(1)} р.ч.`;
  return left >= 0 ? `осталось ${txt}` : `просрочено на ${txt}`;
}
