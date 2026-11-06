import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configured, sb, type Deal, type Profile } from './lib/data';
import { ROLES } from './lib/stages';
import Login from './pages/Login';
import MyTasks from './pages/MyTasks';
import Board from './pages/Board';
import DealView from './pages/DealView';
import NewDeal from './pages/NewDeal';
import Director from './pages/Director';

export interface Ctx {
  me: Profile;
  team: Profile[];
  deals: Deal[];
  reload: () => Promise<void>;
  go: (path: string) => void;
}

const useHash = () => {
  const [hash, setHash] = useState(location.hash.slice(1) || '/tasks');
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1) || '/tasks');
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Profile[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const hash = useHash();
  const go = (p: string) => { location.hash = p; };

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const reload = useCallback(async () => {
    if (!session) return;
    const [p, t, d] = await Promise.all([
      sb.from('profiles').select('*').eq('id', session.user.id).single(),
      sb.from('profiles').select('*').order('full_name'),
      sb.from('deals').select('*').order('stage_started_at'),
    ]);
    setMe(p.data as Profile);
    setTeam((t.data as Profile[]) ?? []);
    setDeals((d.data as Deal[]) ?? []);
  }, [session]);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 60_000); // светофор и данные — раз в минуту
    return () => clearInterval(t);
  }, [reload]);

  if (!configured) return <Setup />;
  if (!ready) return null;
  if (!session) return <Login />;
  if (!me) return <div className="page">Загрузка…</div>;
  if (!me.role)
    return (
      <div className="page narrow">
        <h1>Доступ ожидает подтверждения</h1>
        <p>Вы зарегистрированы как {me.email}. Директор должен назначить вам роль в разделе «Команда».</p>
        <button onClick={() => sb.auth.signOut()}>Выйти</button>
      </div>
    );

  const ctx: Ctx = { me, team, deals, reload, go };
  const [, section, id] = hash.split('/');

  const tabs: [string, string][] = [['tasks', 'Мои задачи'], ['board', 'Воронка'], ['new', '+ Заявка']];
  if (me.role === 'director') tabs.push(['director', 'Директор']);

  return (
    <>
      <header className="top">
        <strong>CRM визового центра</strong>
        <nav>
          {tabs.map(([k, label]) => (
            <a key={k} href={`#/${k}`} className={section === k ? 'on' : ''}>{label}</a>
          ))}
        </nav>
        <span className="who">
          {me.full_name} · {ROLES[me.role].short}
          <button className="link" onClick={() => sb.auth.signOut()}>выйти</button>
        </span>
      </header>
      <main className="page">
        {section === 'board' && <Board {...ctx} />}
        {section === 'new' && <NewDeal {...ctx} />}
        {section === 'deal' && id && <DealView {...ctx} id={Number(id)} />}
        {section === 'director' && me.role === 'director' && <Director {...ctx} />}
        {(section === 'tasks' || !section) && <MyTasks {...ctx} />}
      </main>
    </>
  );
}

function Setup() {
  return (
    <div className="page narrow">
      <h1>Нужна настройка</h1>
      <p>Не заданы переменные <code>VITE_SUPABASE_URL</code> и <code>VITE_SUPABASE_ANON_KEY</code>. Инструкция — в README.md.</p>
    </div>
  );
}
