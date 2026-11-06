import { createClient } from '@supabase/supabase-js';
import type { Role, StageId } from './stages';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && key);
export const sb = createClient(url || 'http://localhost', key || 'missing');

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role | null;
}

export interface Deal {
  id: number;
  client_company: string;
  client_bin: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  category: string;
  people_count: number;
  source: string | null;
  request: string | null;
  owner_id: string | null;
  stage: StageId;
  stage_started_at: string;
  amount_total: number;
  amount_paid: number;
  status: 'active' | 'lost' | 'done';
  lost_reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DealEvent {
  id: number;
  deal_id: number;
  kind: 'stage' | 'return' | 'comment' | 'payment' | 'escalation' | 'created';
  from_stage: string | null;
  to_stage: string | null;
  text: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Payment {
  id: number;
  deal_id: number;
  amount: number;
  kind: 'prepay' | 'final' | 'fee';
  paid_at: string;
  note: string | null;
}

export const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(n)) + ' ₸';

export const dt = (s: string) =>
  new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Человекочитаемое сообщение об ошибке Supabase (включая исключения из триггеров). */
export const errText = (e: unknown) =>
  (e as { message?: string })?.message ?? String(e);
