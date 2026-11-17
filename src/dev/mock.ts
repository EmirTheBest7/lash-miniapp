// DEV / E2E ONLY (excluded from the production bundle unless VITE_MOCK=1). Synthetic data: never real users, never signed initData.
// The mock follows the real API contract (see TG-PHPBot docs/miniapp.md); behaviour switches are query parameters:
//   ?mock=1&lang=cs&role=client&new=1 (new client: privacy + phone gate)&full=1 (day 3 booked out)&taken=1 (first create says slot_taken)
import { DARK, LIGHT } from '../theme';
import type { WebApp } from '../tg';
import type { Appt, BookData, Slot } from '../types';
import { adminMock } from './mockAdmin';

export function installMockTelegram(): void {
  const q = new URLSearchParams(location.search);
  const dark = q.get('theme') === 'dark';
  const platform = q.get('platform') ?? 'ios';
  const noop = () => {};
  const btn = { text: '', isVisible: false, isActive: true, isProgressVisible: false, setText() { return btn; }, onClick() { return btn; }, offClick() { return btn; }, show() { return btn; }, hide() { return btn; }, enable() { return btn; }, disable() { return btn; }, showProgress() { return btn; }, hideProgress() { return btn; } };
  const app = {
    initData: 'mock', initDataUnsafe: { user: { id: 1, first_name: 'Anna', language_code: q.get('lang') ?? 'en' } }, version: '8.0', platform, colorScheme: dark ? 'dark' : 'light',
    themeParams: dark ? DARK : LIGHT, isExpanded: true, viewportStableHeight: 800, ready: noop, expand: noop, close: noop, isVersionAtLeast: () => true,
    setHeaderColor: noop, setBackgroundColor: noop, onEvent: noop, offEvent: noop,
    BackButton: { isVisible: false, show: noop, hide: noop, onClick: noop, offClick: noop }, MainButton: q.has('nativeMain') ? btn : undefined,
    HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
    showConfirm: (_m: string, cb: (ok: boolean) => void) => cb(true),
    requestContact: (cb?: (s: boolean) => void) => { st.phone = true; cb?.(true); },
    openTelegramLink: (u: string) => { (window as unknown as { __opened?: string[] }).__opened = [...((window as unknown as { __opened?: string[] }).__opened ?? []), u]; },
  } as unknown as WebApp;
  window.Telegram = { WebApp: app };
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const st = { phone: true, privacy: true, my: [] as Appt[], nextId: 100, takenOnce: false, lang: 'en', waitlist: [] as string[] };

export function installMockApi(): void {
  const q = new URLSearchParams(location.search);
  st.lang = q.get('lang') ?? 'en';
  if (q.has('new')) { st.phone = false; st.privacy = false; }
  st.takenOnce = q.has('taken');
  const TODAY = new Date('2026-11-16T12:00:00');
  const dayN = (n: number) => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; };
  const strip = (from: string) => {
    const start = new Date(`${from}T12:00:00`);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const wd = d.getDay(), date = iso(d), idx = Math.round((d.getTime() - TODAY.getTime()) / 86400000);
      const status = wd === 0 || idx < 1 ? 'closed' : (q.has('full') && idx === 3) ? 'full' : 'free';
      return { date, status, free: status === 'free' ? 12 : 0 } as const;
    });
  };
  const slotsFor = (date: string, dur: number): Slot[] => {
    const out: Slot[] = [];
    for (let m = 10 * 60; m + dur <= 18 * 60; m += 30) {
      const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      out.push({ start: Date.parse(`${date}T${time}:00Z`) / 1000, date, time, adjacent: false });
    }
    return out;
  };
  const SERVICES = [
    { id: 1, name: 'Lash extensions – full set', description: '', duration_min: 150, price: 1800, price_from: false },
    { id: 2, name: 'Lash fill', description: '', duration_min: 75, price: 1000, price_from: false },
    { id: 3, name: 'Lash lift', description: '', duration_min: 60, price: 0, price_from: false },
  ];
  const ADDONS = [{ id: 5, name: 'Lash tint', duration_min: 15, price: 150 }];
  const dur = (d: { service: number; addons?: number[] }) => (SERVICES.find((s) => s.id === d.service)?.duration_min ?? 60) + (d.addons ?? []).length * 15;
  const two = q.get('staff') === '2';                       // ?staff=2: a studio with two people (Jana, Eva); the default is a solo master
  const PEOPLE = [{ id: 1, name: 'Jana', bio: 'Senior lash artist', color: '#d4547a' }, { id: 2, name: 'Eva', bio: 'Lifting and tinting', color: '#3b82c4' }];
  const apptFrom = (a: Appt) => ({ id: a.id, rev: a.rev, start: a.start, date: a.date, time: a.time, status: a.status, service: a.service, staff_id: a.staff_id, staff: a.staff, decide_by: a.decide_by });

  window.__MOCK_API__ = async (route, raw) => {
    ((window as unknown as { __mockCalls?: { route: string; data: unknown }[] }).__mockCalls ??= []).push({ route, data: raw });   // e2e asserts on what the app sends
    const adm = adminMock(route, raw as Record<string, never>, { two, role: q.get('role') ?? 'client' });
    if (adm) return adm;
    const d = raw as Record<string, never> & { service: number; addons?: number[]; date: string; from?: string; start: number; id: number; revision: number; lang: string };
    const ok = (data: unknown) => ({ ok: true as const, data });
    const err = (status: number, code: string) => ({ ok: false as const, status, error: { code } });
    switch (route) {
      case 'bootstrap':
        return ok({
          me: { id: 1, name: 'Anna Nováková', username: 'anna_n', role: q.get('role') ?? 'client', lang: st.lang, phone_set: st.phone, privacy_accepted: st.privacy },
          config: { tz: 'Europe/Prague', studio_name: 'Lash Studio', currency: 'CZK', min_client_version: 1, contact_username: 'lash_master', server_time: Math.floor(TODAY.getTime() / 1000) },
          start_param: null, categories: [{ id: 1, name: 'Lashes', services: SERVICES }], addons: ADDONS, my: st.my,
          again: q.has('again') ? { service_id: 2, suggest: iso(dayN(2)) } : null,
          policy: { cancel_cutoff_h: 24, horizon_days: 60 },
          loyalty: q.get('loyalty') === 'ready' ? { visits: 7, percent: 10, progress: 0, ready: 10, pending: false } : q.get('loyalty') === 'card' ? { visits: 7, percent: 10, progress: 3, ready: null, pending: false } : null,
          privacy: { title: 'Privacy notice (draft – needs review)', text: 'We keep only what is necessary: your Telegram ID, name, phone, language and booking history.\nThe master is the data controller.' },
        });
      case 'language': st.lang = d.lang; return ok({ lang: d.lang });
      case 'me': return ok({ phone_set: st.phone, privacy_accepted: st.privacy });
      case 'consent': st.privacy = true; return ok({ phone_set: st.phone, privacy_accepted: true });
      case 'availability': {
        const from = d.from ?? iso(TODAY);
        const s = strip(from);
        const first = s.find((x) => x.status === 'free');
        return ok({ strip: s, first: first ? { date: first.date, slots: slotsFor(first.date, dur(d)) } : null, quote: { duration_min: dur(d), price: 1000 + (d.addons ?? []).length * 150, price_from: false, warnings: d.service === 2 ? ['fill_no_previous'] : [], will_wait: st.my.length === 0, cancel_cutoff_h: 24 }, staff: two && !d.exclude && !(d.addons ?? []).length ? PEOPLE : [] });
      }
      case 'slots': return ok({ date: d.date, slots: slotsFor(d.date, dur(d)) });
      case 'waitlist/add': st.waitlist.push(d.date); return ok({ outcome: 'ok' });
      case 'appointments/create': {
        if (!st.privacy || !st.phone) return ok({ outcome: 'needs_gate', needs: { privacy: !st.privacy, phone: !st.phone } } satisfies BookData);
        if (st.takenOnce) { st.takenOnce = false; const a = slotsFor(iso(dayN(2)), dur(d)).slice(2, 5); return ok({ outcome: 'slot_taken', alternatives: a, my: st.my } satisfies BookData); }
        const date = new Date(d.start * 1000).toISOString().slice(0, 10), time = new Date(d.start * 1000).toISOString().slice(11, 16);
        const a: Appt = { id: st.nextId++, rev: 1, service_id: d.service, service: SERVICES.find((s) => s.id === d.service)!.name, start: d.start, date, time, duration_min: dur(d), status: st.my.length ? 'confirmed' : 'pending', decide_by: '2026-11-17 09:00', can_change: true, staff_id: (d as { staff?: number }).staff ?? 1, staff: two ? PEOPLE.find((p) => p.id === ((d as { staff?: number }).staff ?? 1))!.name : null };
        st.my = [...st.my, a];
        return ok({ outcome: 'ok', appointment: apptFrom(a), my: st.my, warnings: [] } satisfies BookData);
      }
      case 'appointments/cancel': {
        const a = st.my.find((x) => x.id === d.id);
        if (!a) return err(404, 'not_found');
        if (a.rev !== d.revision) return err(409, 'stale_revision');
        st.my = st.my.filter((x) => x.id !== d.id);
        return ok({ outcome: 'ok', my: st.my });
      }
      case 'appointments/move': {
        const a = st.my.find((x) => x.id === d.id);
        if (!a) return err(404, 'not_found');
        if (a.rev !== d.revision) return err(409, 'stale_revision');
        const date = new Date(d.start * 1000).toISOString().slice(0, 10), time = new Date(d.start * 1000).toISOString().slice(11, 16);
        Object.assign(a, { start: d.start, date, time, rev: a.rev + 1 });
        return ok({ outcome: 'ok', appointment: apptFrom(a), my: st.my });
      }
      default: return err(404, 'not_found');
    }
  };
}
