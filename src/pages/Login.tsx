import { useState, type FormEvent } from 'react';
import { errText, sb } from '../lib/data';

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg('');
    const res = mode === 'in'
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (res.error) setMsg(errText(res.error));
    else if (mode === 'up' && !res.data.session) setMsg('Проверьте почту и подтвердите e-mail, затем войдите.');
  };

  return (
    <div className="page narrow">
      <h1>CRM визового центра</h1>
      <form onSubmit={submit} className="card form">
        {mode === 'up' && (
          <label>Имя и фамилия<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
        )}
        <label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Пароль<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button type="submit">{mode === 'in' ? 'Войти' : 'Зарегистрироваться'}</button>
        {msg && <p className="err">{msg}</p>}
        <button type="button" className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Новый сотрудник? Регистрация' : 'Уже есть доступ? Вход'}
        </button>
      </form>
    </div>
  );
}
