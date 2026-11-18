import type { ComponentType } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { api } from './api';
import { perfMark, perfReport } from './perf';
import { Appts } from './screens/Appts';
import { Done } from './screens/Done';
import { Home } from './screens/Home';
import { Pick } from './screens/Pick';
import { Summary } from './screens/Summary';
import { useToast } from './hooks';
import { langFromTelegram, setLang, t } from './i18n';
import type { Ctx, Screen } from './nav';
import { startParam, webApp } from './tg';
import type { AdminBoot } from './admin/types';
import type { Appt, Bootstrap } from './types';
import { Button, Empty, Skeleton, Toast } from './ui/components';

type State = { k: 'loading' } | { k: 'ready'; boot: Bootstrap } | { k: 'staff'; admin: AdminBoot } | { k: 'error'; code: string };
/** Remembered between opens so the admin chunk can start downloading BEFORE the bootstrap answer says the user is staff. */
const STAFF_HINT = 'lash_staff';
const staffHint = (v?: boolean): boolean => { try { if (v === undefined) return localStorage.getItem(STAFF_HINT) === '1'; v ? localStorage.setItem(STAFF_HINT, '1') : localStorage.removeItem(STAFF_HINT); } catch { /* private mode: no hint */ } return v ?? false; };

export function App() {
  const [state, setState] = useState<State>({ k: 'loading' });
  const [stack, setStack] = useState<Screen[]>([{ k: 'home' }]);
  const [toastText, toast] = useToast();
  const started = useRef(false);
  // Staff (owner/master) open the admin app; "Client view" shows the client app for testing. The admin code is a lazy chunk.
  const [clientView, setClientView] = useState(() => new URLSearchParams(location.search).get('view') === 'client');
  const cvRef = useRef(clientView);
  const [Admin, setAdmin] = useState<ComponentType<{ onClientView: () => void; initial?: AdminBoot }> | null>(null);
  const staffRole = state.k === 'ready' && state.boot.me.role !== 'client';
  const staffNow = staffRole || state.k === 'staff';
  useEffect(() => { if (staffNow && !clientView && !Admin) void import('./admin/admin').then((m) => setAdmin(() => m.AdminApp)); }, [staffNow, clientView]);

  const load = useCallback(async (initial = false) => {
    if (initial) setState({ k: 'loading' });
    // ONE call: a staff member gets the admin data back (role included); everybody else, and staff in client view, the client data
    const r = await api<Bootstrap | { me: { role: string; lang: string }; admin: AdminBoot }>('bootstrap', cvRef.current ? undefined : { auto: true });
    if (!r.ok) {
      if (r.error.code === 'client_outdated') { location.reload(); return; }
      setState({ k: 'error', code: r.error.code });
      return;
    }
    if ('admin' in r.data) {
      setLang(r.data.me.lang as Parameters<typeof setLang>[0]);
      staffHint(true);
      setState({ k: 'staff', admin: r.data.admin });
      perfMark('staff-bootstrap-rendered');
      return;
    }
    if (r.data.me.role === 'client') staffHint(false);
    setLang(r.data.me.lang as Parameters<typeof setLang>[0]);
    setState({ k: 'ready', boot: r.data });
    perfMark('client-bootstrap-rendered');
    if (r.data.me.role === 'client') setTimeout(perfReport, 0);
    // Deep link t.me/<bot>?startapp=svc_<id>: straight to that service (once).
    const m = /^svc_(\d{1,9})$/.exec(startParam() ?? r.data.start_param ?? '');
    if (m && !started.current) {
      started.current = true;
      const id = Number(m[1]);
      if (r.data.categories.some((c) => c.services.some((s) => s.id === id))) setStack([{ k: 'home' }, { k: 'pick', service: id, addons: [] }]);
    }
  }, []);
  useEffect(() => {
    setLang(langFromTelegram(webApp()?.initDataUnsafe.user?.language_code));
    if (staffHint() && !clientView) void import('./admin/admin').then((m) => setAdmin(() => m.AdminApp));      // in parallel with the bootstrap call
    void load(true);
  }, [load]);

  if (state.k === 'loading') return <div class="page"><Skeleton lines={5} /></div>;
  if (state.k === 'error') {
    const key = state.code === 'network' ? 'err.network' : state.code.startsWith('auth_') ? 'err.auth' : state.code === 'forbidden' ? 'err.forbidden' : state.code === 'rate_limited' ? 'err.rate' : 'err.generic';
    return <Empty title={t(key)} icon="info" action={state.code.startsWith('auth_') ? undefined : <Button onClick={() => void load(true)}>{t('btn.retry')}</Button>} />;
  }
  const toClientView = () => { cvRef.current = true; setClientView(true); void load(); };
  if (state.k === 'staff') return clientView || !Admin ? <div class="page"><Skeleton lines={6} /></div> : <Admin initial={state.admin} onClientView={toClientView} />;
  const boot = state.boot;
  if (boot.me.role !== 'client' && !clientView) return Admin ? <Admin onClientView={toClientView} /> : <div class="page"><Skeleton lines={6} /></div>;
  const ctx: Ctx = {
    boot,
    push: (s) => setStack((st) => [...st, s]),
    pop: () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st)),
    replace: (s) => setStack((st) => [...st.slice(0, -1), s]),
    home: () => setStack([{ k: 'home' }]),
    toast,
    setMy: (my: Appt[]) => setState({ k: 'ready', boot: { ...boot, my } }),
    reload: () => load(false),
    exitClientView: boot.me.role !== 'client' ? () => { cvRef.current = false; setClientView(false); void load(true); } : undefined,
  };
  const top = stack[stack.length - 1]!;
  return (
    <>
      {top.k === 'home' && <Home ctx={ctx} />}
      {top.k === 'pick' && <Pick key={stack.length + ':' + top.service + (top.move?.id ?? '')} ctx={ctx} service={top.service} addons={top.addons} move={top.move} prefer={top.prefer} />}
      {top.k === 'summary' && <Summary key={top.slot.start + ':' + stack.length} ctx={ctx} service={top.service} addons={top.addons} slot={top.slot} quote={top.quote} move={top.move} staff={top.staff} />}
      {top.k === 'done' && <Done ctx={ctx} kind={top.kind} when={top.when} service={top.service} staff={top.staff} decideBy={top.decideBy} />}
      {top.k === 'appts' && <Appts ctx={ctx} />}
      <Toast text={toastText} />
    </>
  );
}
