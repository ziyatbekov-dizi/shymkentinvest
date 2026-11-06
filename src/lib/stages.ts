// Этапы заявки — из документа «Визовый центр — архитектура обработки заявок».
// sla — внутренний тайм-лимит в рабочих часах (рабочий день = 9 часов).
// checks — «без чего не принимать»: условия передачи следующему исполнителю.

export type Role = 'director' | 'ads' | 'manager' | 'courier' | 'lawyer' | 'accountant';

export const ROLES: Record<Role, { short: string; name: string }> = {
  director: { short: 'Д', name: 'Директор' },
  ads: { short: 'МР', name: 'Менеджер по рекламе' },
  manager: { short: 'МК', name: 'Менеджер по клиентам' },
  courier: { short: 'КР', name: 'Менеджер-курьер' },
  lawyer: { short: 'ЮР', name: 'Юрист' },
  accountant: { short: 'БХ', name: 'Бухгалтер' },
};

export type StageId =
  | 'lead' | 'qualify' | 'route' | 'offer' | 'discount' | 'contract' | 'sign'
  | 'invoice' | 'prepay' | 'checklist' | 'collect' | 'review' | 'fee' | 'submit'
  | 'gov' | 'pickup' | 'check' | 'handover' | 'act' | 'closing' | 'done';

export interface Stage {
  id: StageId;
  name: string;
  role: Role;
  sla: number; // рабочие часы; для 'gov' берётся из категории
  group: 'Продажа' | 'Оплата' | 'Документы' | 'Госорган' | 'Выдача и акт';
  optional?: boolean; // можно пропустить (нетиповой маршрут, скидка)
  checks: string[];
  gov?: boolean;
}

const D = 9; // часов в рабочем дне

export const STAGES: Stage[] = [
  { id: 'lead', name: 'Лид', role: 'manager', sla: 0.5, group: 'Продажа',
    checks: ['Телефон и компания заполнены', 'Источник указан', 'Суть запроса записана'] },
  { id: 'qualify', name: 'Квалификация', role: 'manager', sla: D, group: 'Продажа',
    checks: ['Гражданство и где сейчас иностранец', 'Цель, срок, приглашающая сторона', 'Разрешение на ИРС или освобождение', 'Нарушения и выдворения за 5 лет'] },
  { id: 'route', name: 'Маршрут (нетиповой)', role: 'lawyer', sla: 4, group: 'Продажа', optional: true,
    checks: ['Категория выбрана', 'Риски записаны', 'Перечень документов'] },
  { id: 'offer', name: 'КП клиенту', role: 'manager', sla: D, group: 'Продажа',
    checks: ['Цена по прайсу, госпошлины отдельно', 'Сроки этапов', 'Перечень документов'] },
  { id: 'discount', name: 'Скидка / нестандарт', role: 'director', sla: 4, group: 'Продажа', optional: true,
    checks: ['Решение директора записано'] },
  { id: 'contract', name: 'Договор', role: 'manager', sla: D, group: 'Продажа',
    checks: ['Текст согласован клиентом', 'Реквизиты клиента'] },
  { id: 'sign', name: 'Подпись договора', role: 'director', sla: 4, group: 'Продажа',
    checks: ['Договор подписан'] },
  { id: 'invoice', name: 'Счёт', role: 'accountant', sla: 2, group: 'Оплата',
    checks: ['Сумма договора внесена в карточку', 'Счёт отправлен клиенту'] },
  { id: 'prepay', name: 'Предоплата', role: 'accountant', sla: 3 * D, group: 'Оплата',
    checks: ['Предоплата поступила и внесена'] },
  { id: 'checklist', name: 'Чек-лист клиенту', role: 'manager', sla: D, group: 'Документы',
    checks: ['Чек-лист отправлен', 'Задача курьеру поставлена'] },
  { id: 'collect', name: 'Сбор документов', role: 'courier', sla: 2 * D, group: 'Документы',
    checks: ['Все пункты чек-листа в карточке', 'Оригиналы внесены в реестр'] },
  { id: 'review', name: 'Ходатайство и стоп-проверка', role: 'lawyer', sla: D, group: 'Документы',
    checks: ['Ходатайство / таблица прил. 4 готовы', 'Отметка «пакет готов»', 'Вид и сумма пошлины'] },
  { id: 'fee', name: 'Госпошлина', role: 'accountant', sla: 4, group: 'Документы',
    checks: ['Квитанция в карточке'] },
  { id: 'submit', name: 'Подача', role: 'courier', sla: D, group: 'Госорган',
    checks: ['Фото расписки госоргана', 'Дата подачи'] },
  { id: 'gov', name: 'Рассмотрение', role: 'manager', sla: 5 * D, group: 'Госорган', gov: true,
    checks: ['Результат готов к получению'] },
  { id: 'pickup', name: 'Получение', role: 'courier', sla: D, group: 'Госорган',
    checks: ['Документ на руках', 'Фото в карточке'] },
  { id: 'check', name: 'Проверка документа', role: 'lawyer', sla: D, group: 'Выдача и акт',
    checks: ['ФИО и номер паспорта', 'Категория, кратность, срок'] },
  { id: 'handover', name: 'Выдача клиенту', role: 'manager', sla: D, group: 'Выдача и акт',
    checks: ['Оплачено полностью (отметка БХ)', 'Акт приёма-передачи подписан', 'Памятка клиенту'] },
  { id: 'act', name: 'АВР и ЭСФ', role: 'accountant', sla: D, group: 'Выдача и акт',
    checks: ['АВР выписан и подписан директором', 'ЭСФ выписан'] },
  { id: 'closing', name: 'Акт у клиента', role: 'manager', sla: 5 * D, group: 'Выдача и акт',
    checks: ['АВР подписан клиентом', 'Напоминание о продлении поставлено'] },
  { id: 'done', name: 'Закрыта', role: 'manager', sla: 0, group: 'Выдача и акт', checks: [] },
];

export const stageById = (id: StageId): Stage => STAGES.find((s) => s.id === id)!;
export const stageIndex = (id: StageId): number => STAGES.findIndex((s) => s.id === id);

export const nextStage = (id: StageId, skipOptional: boolean): StageId | null => {
  let i = stageIndex(id) + 1;
  while (i < STAGES.length && skipOptional && STAGES[i].optional) i++;
  return i < STAGES.length ? STAGES[i].id : null;
};

// Категории и нормативный срок госоргана (рабочие дни) — из реестра виз проекта.
export const CATEGORIES: Record<string, { govDays: number; note: string }> = {
  'C3': { govDays: 5, note: 'Виза до 5 раб. дней; приглашение 3 (эл.) / 5 (бум.) + КНБ до 3' },
  'C5': { govDays: 5, note: 'Приглашение 5 раб. дней + КНБ; виза только в загранучреждении' },
  'B2': { govDays: 5, note: 'Приглашение 3/5 раб. дней + КНБ; виза до 5 раб. дней' },
  'B3': { govDays: 5, note: 'Приглашение 3/5 раб. дней + КНБ; e-visa 1 раб. день' },
  'РВП': { govDays: 1, note: '1 раб. день, бесплатно; подаёт принимающая сторона' },
  'Другое': { govDays: 5, note: 'Срок уточняет юрист' },
};

export const slaFor = (stage: Stage, category: string): number =>
  stage.gov ? (CATEGORIES[category]?.govDays ?? 5) * D : stage.sla;
