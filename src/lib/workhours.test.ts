import { describe, expect, it } from 'vitest';
import { addWorkHours, light, workHoursBetween } from './workhours';

const d = (s: string) => new Date(s); // локальное время

describe('рабочие часы', () => {
  it('переносит остаток на следующий рабочий день', () => {
    // пятница 16:00 + 4 р.ч. → понедельник 11:00
    expect(addWorkHours(d('2026-11-06T16:00'), 4)).toEqual(d('2026-11-09T11:00'));
  });

  it('лид в выходной считается с понедельника 9:00', () => {
    expect(addWorkHours(d('2026-11-07T12:00'), 0.5)).toEqual(d('2026-11-09T09:30'));
  });

  it('пропускает праздник 16 декабря', () => {
    // вторник 15.12 17:00 + 2 р.ч. → четверг 17.12 10:00
    expect(addWorkHours(d('2026-12-15T17:00'), 2)).toEqual(d('2026-12-17T10:00'));
  });

  it('считает часы между моментами только в рабочее время', () => {
    expect(workHoursBetween(d('2026-11-06T17:00'), d('2026-11-09T10:00'))).toBe(2);
  });

  it('светофор', () => {
    const start = d('2026-11-09T09:00');
    expect(light(start, 4, d('2026-11-09T10:00'))).toBe('green');
    expect(light(start, 4, d('2026-11-09T12:30'))).toBe('yellow');
    expect(light(start, 4, d('2026-11-09T13:30'))).toBe('red');
  });
});
