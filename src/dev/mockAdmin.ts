// DEV / E2E ONLY: a stateful mock of the admin API (synthetic people, never real data). Follows TG-PHPBot docs/miniapp.md.
import { addDays, isoWeekday, minutesOf, parseHm, toUtc } from '../admin/time';
import type { AdmAppt, AdminBoot, CalData, ReviewLink, StaffRow, StudioInfo, SvcRow, VoucherRow, VoucherSettings } from '../admin/types';

const TZ = 'Europe/Prague';
const NOW = toUtc('2026-11-16', 12 * 60, TZ);
const week = (): Record<string, [string, string][]> => ({ '1': [['10:00', '18:00']], '2': [['10:00', '18:00']], '3': [['10:00', '18:00']], '4': [['10:00', '18:00']], '5': [['10:00', '18:00']], '6': [['10:00', '14:00']] });
type Ev = { ok: true; data: unknown } | { ok: false; status: number; error: { code: string } };

export interface AdminMockEnv { two: boolean; role: string; noTranslate?: boolean; lang?: string }
const state = {
  staff: [] as StaffRow[], services: [] as SvcRow[], categories: [] as { id: number; name: string }[], appts: [] as AdmAppt[], blocks: [] as { id: number; staff_id: number; start: number; end: number; reason: string }[],
  overrides: [] as { staff_id: number; date: string; closed: boolean; intervals: [string, string][]; note: string }[],
  settings: { slot_step_min: 30, min_notice_h: 12, horizon_days: 60, cancel_cutoff_h: 24, buffer_may_exceed_close: true, loyalty_enabled: false, loyalty_visits: 7, loyalty_percent: 10,
    review_links: [] as ReviewLink[], automation_on: false, autocomplete_on: false, autocomplete_h: 3, fill_nudge_on: true, google_review_url: '', review_delay_h: 3, review_gap_days: 180, waitlist_min_notice_h: 2, rem1_on: true, rem1_h: 26, rem1_auto: true, rem1_warn: false, rem2_on: true, rem2_h: 3, rem_unanswered_on: true, rem_unanswered_h: 12, agenda_on: true, agenda_time: '20:00', agenda_empty: false,
    waitlist_on: true, waitlist_offer_h: 2, backup_on: true, backup_time: '03:30', backup_key: false, backup_last: 0, ad_min_days: 7 }, loyaltyPending: [{ id: 1, client: 'Anna Nováková', percent: 10 }] as { id: number; client: string; percent: number }[], nextId: 500, inited: false,
  clients: [{ id: 1, name: 'Eva Kovářová', phone: '+420777000111', username: 'eva_k', tg: true }, { id: 2, name: 'Tereza Malá', phone: '+420777000222', username: null, tg: true }, { id: 3, name: 'Bára Svobodová', phone: null, username: null, tg: false }],
};

function init(env: AdminMockEnv): void {
  if (state.inited) return;
  state.inited = true;
  state.staff = [{ id: 1, name: 'Jana', bio: 'Senior lash artist', color: '#d4547a', active: true, linked: true, tg_id: null, mine: true, admin: false, off: [], weekly: week(), future: 0 }];
  if (env.two) state.staff.push({ id: 2, name: 'Eva', bio: 'Lifting and tinting', color: '#3b82c4', active: true, linked: false, tg_id: null, mine: false, admin: false, off: [4], weekly: { ...week(), '6': [] }, future: 0 });
  state.services = [
    { id: 1, name: 'Lash extensions – full set', is_addon: false, duration_min: 150, buffer_min: 15, price: 1800, price_from: false, active: true, names: { cs: '', en: 'Lash extensions – full set', ru: '', uk: '' }, category_id: 1 },
    { id: 2, name: 'Lash fill', is_addon: false, duration_min: 75, buffer_min: 15, price: 1000, price_from: false, active: true, names: { cs: '', en: 'Lash fill', ru: '', uk: '' }, category_id: 1 },
    { id: 3, name: 'Lash lift', is_addon: false, duration_min: 60, buffer_min: 10, price: 0, price_from: false, active: true, names: { cs: '', en: 'Lash lift', ru: '', uk: '' }, category_id: 1 },
    { id: 4, name: 'Lash tint', is_addon: true, duration_min: 15, buffer_min: 0, price: 150, price_from: false, active: true, names: { cs: '', en: 'Lash tint', ru: '', uk: '' }, category_id: null },
  ];
  state.categories = [{ id: 1, name: 'Lashes' }];
  const mk = (id: number, staff: number, from: string, svc: number, client: number, status: AdmAppt['status']): AdmAppt => {
    const s = state.services.find((x) => x.id === svc)!, c = state.clients.find((x) => x.id === client)!;
    const start = toUtc('2026-11-16', parseHm(from), TZ);
    return { id, rev: 1, staff_id: staff, status, start, end: start + s.duration_min * 60, buffer_min: s.buffer_min, service_id: svc, service: s.name, addons: [], price: s.price, auto: false, by: 'client', address: 'held', address_policy: 'default', client: c };
  };
  state.appts = [mk(11, 1, '11:00', 2, 1, 'confirmed'), mk(12, 1, '14:00', 1, 2, 'pending')];
  if (env.two) state.appts.push(mk(13, 2, '13:00', 2, 3, 'confirmed'));
}

const iv = (staff: number, date: string): [number, number][] => {
  const o = state.overrides.find((x) => x.staff_id === staff && x.date === date);
  const raw = o ? (o.closed ? [] : o.intervals) : (state.staff.find((s) => s.id === staff)?.weekly[String(isoWeekday(date))] ?? []);
  return raw.map(([a, b]) => [toUtc(date, parseHm(a), TZ), toUtc(date, parseHm(b), TZ)]);
};
const busy = (staff: number, a: number, b: number, skip = 0) => state.appts.some((x) => x.id !== skip && x.staff_id === staff && ['pending', 'pending_deposit', 'confirmed'].includes(x.status) && x.start < b && a < x.end + x.buffer_min * 60);

// a 1x1 PNG stand-in for the QR in the mock (the real PNG is produced and decode-tested on the server)
const MOCK_QR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
let vsettings: VoucherSettings = { months: 12, partial: true, min: 100, terms: { cs: '', en: '', ru: '', uk: '' } };
const privacyMock = { on: false };
const studioMock: StudioInfo = { studio_name: 'Lash Studio', address: '', studio_description_cs: '', studio_description_ru: '', studio_description_uk: '', studio_description_en: '', area_text_cs: '', area_text_ru: '', area_text_uk: '', area_text_en: '', address_mode: 'after_approval', address_new_clients_manual: true, address_release_timing: 'day_before', lat: 50.0755, lon: 14.4378, contact_name: 'Lash Master', contact_username: '', instagram: '', portfolio_url: '', cancel_policy_cs: '', cancel_policy_en: '', cancel_policy_ru: '', cancel_policy_uk: '' };
let wizardMock: { step: number; skipped: string[] } = { step: 0, skipped: [] };
const sentCards: number[] = [];
const sentPreviews: string[] = [];
const vouchers: VoucherRow[] = [];
const voucherOps = new Map<string, VoucherRow>();

export function adminMock(route: string, d: Record<string, any>, env: AdminMockEnv): Ev | null {   // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!route.startsWith('admin/')) return null;
  init(env);
  const ok = (data: unknown): Ev => ({ ok: true, data });
  const err = (status: number, code: string): Ev => ({ ok: false, status, error: { code } });
  const realOwner = env.role === 'owner';
  const owner = realOwner || env.role === 'admin';            // administrator: every business setting, not the System area
  const scope = owner ? state.staff : state.staff.filter((s) => s.mine);
  const can = (id: number) => scope.some((s) => s.id === id);
  const boot = (): AdminBoot => ({
    me: { id: 1, name: 'Anna Nováková', role: realOwner ? 'owner' : owner ? 'admin' : 'master', lang: env.lang ?? 'en' }, config: { tz: TZ, studio_name: 'Lash Studio', server_time: NOW, today: '2026-11-16' },
    staff: scope.map((s) => ({ ...s, future: state.appts.filter((a) => a.staff_id === s.id && ['pending', 'confirmed'].includes(a.status)).length })),
    services: state.services, categories: state.categories, loyalty_pending: state.loyaltyPending, settings: state.settings, can_manage: owner, is_owner: realOwner, vouchers_on: owner,
  });
  const apptOf = (id: number) => state.appts.find((a) => a.id === id);

  switch (route) {
    case 'admin/bootstrap': return ok(boot());
    case 'admin/launch': {
      const done = (b: boolean, id: string, required = true, where = 'set') => ({ id, ok: b, required, where });
      const items = [done(studioMock.studio_name !== '' && studioMock.studio_name !== 'Lash Studio', 'studio', true, 'studio'), done(studioMock.address !== '', 'address', true, 'studio'), done(studioMock.contact_username !== '', 'contact', true, 'studio'),
        done(true, 'service', true, 'svc'), done(false, 'aftercare', true, 'svc'), done(true, 'hours', true, 'staff'), done(studioMock.cancel_policy_cs !== '', 'policy', true, 'studio'),
        done(privacyMock.on, 'privacy', true, 'privacy'), done(false, 'secrets', true, 'server'), done(state.settings.automation_on, 'automation', true, 'automation'), done((state.settings.review_links ?? []).some((l: { enabled: boolean }) => l.enabled), 'review', false, 'set'),
        done(false, 'ai', false, 'chat'), done(false, 'staff', true, 'staff')];
      const req = items.filter((i) => i.required);
      const mine = realOwner ? items : items.filter((i) => !['secrets', 'automation', 'ai'].includes(i.id));
      const mreq = mine.filter((i) => i.required);
      if (!owner) return ok({ items: [], progress: { done: 0, total: 0 }, studio: null, can_manage: false });
      return ok({ items: mine, progress: { done: mreq.filter((i) => i.ok).length, total: mreq.length }, studio: { ...studioMock, lat: studioMock.lat, lon: studioMock.lon }, can_manage: true });
    }
    case 'admin/settings/home': {
      if (!owner) return err(403, 'forbidden');
      const l = (adminMock('admin/launch', {}, env) as { data: { items: { id: string; ok: boolean; required: boolean }[]; progress: { done: number; total: number } } }).data;
      const open = l.items.filter((i) => i.required && !i.ok);
      const order = ['studio', 'contact', 'address', 'service', 'aftercare', 'hours', 'policy', 'privacy', 'staff', 'secrets', 'automation'];
      open.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      const screens: Record<string, string> = { studio: 'name', contact: 'contacts', address: 'place', service: 'services', aftercare: 'services', hours: 'schedule', policy: 'policy', privacy: 'privacy', staff: 'team', secrets: 'system', automation: 'system' };
      const bad = open.map((i) => i.id);
      return ok({
        progress: l.progress, items: l.items, next: open[0] ? { id: open[0].id, screen: screens[open[0].id] } : null,
        studio: { name: studioMock.studio_name, area: studioMock.area_text_cs, address_set: studioMock.address !== '', mode: studioMock.address_mode }, days_off: 2, vouchers: { n: vouchers.length, sum: vouchers.reduce((a, v) => a + v.balance, 0) },
        wizard: wizardMock, translate: !env.noTranslate, lang_hint: [studioMock.area_text_cs, studioMock.area_text_ru, studioMock.area_text_uk, studioMock.area_text_en].filter((x) => x !== '').length === 1,
        attention: { studio: bad.some((x) => ['studio', 'contact', 'address'].includes(x)), services: bad.some((x) => ['service', 'aftercare'].includes(x)), schedule: bad.includes('hours'), rules: bad.some((x) => ['policy', 'privacy'].includes(x)), marketing: false, team: bad.includes('staff'), ...(realOwner ? { system: bad.some((x) => ['secrets', 'automation'].includes(x)) } : {}) },
        ...(realOwner ? { system: { automation: state.settings.automation_on, backup_h: 3, keys: false } } : {}),
      });
    }
    case 'admin/setup/save': {
      if (!owner) return err(403, 'forbidden');
      wizardMock = { step: d.step, skipped: d.skipped };
      return ok({ wizard: wizardMock });
    }
    case 'admin/review/save': {
      if (!owner) return err(403, 'forbidden');
      if (!Array.isArray(d.links) || d.links.length > 4 || d.links.some((l: { url: string }) => !/^https:\/\/\S{4,}$/.test(l.url))) return err(400, 'bad_request');
      state.settings.review_links = (d.links as ReviewLink[]).map((l, i) => ({ ...l, id: l.id || 'r' + i, platform: 'other' }));
      return ok({ links: state.settings.review_links });
    }
    case 'admin/translate': {
      if (!owner) return err(403, 'forbidden');
      if (env.noTranslate) return err(503, 'unavailable');
      const drafts: Record<string, string> = {};
      for (const l of d.to as string[]) drafts[l] = `[${l}] ${d.text}`;
      return ok({ drafts });
    }
    case 'admin/studio/save': {
      if (!owner) return err(403, 'forbidden');
      if ('studio_name' in d && !String(d.studio_name).trim()) return err(400, 'bad_request');
      if (JSON.stringify(d).includes('Testovac')) return { ok: false, status: 400, error: { code: 'address_in_text', message: 'area_text_cs' } } as unknown as Ev;
      Object.assign(studioMock, d);
      return adminMock('admin/launch', {}, env);
    }
    case 'admin/service/preview': return state.services.some((s) => s.id === d.id && !s.is_addon) && ['cs', 'en', 'ru', 'uk'].includes(d.lang) ? (sentPreviews.push(`${d.id}:${d.lang}`), ok({ sent: 3 })) : err(404, 'not_found');
    case 'admin/vouchers/list': return owner ? ok({ enabled: true, settings: vsettings, items: [...vouchers].reverse() }) : err(403, 'forbidden');
    case 'admin/vouchers/settings': { if (!owner) return err(403, 'forbidden'); if (!(d.months >= 1 && d.months <= 60) || !(d.min >= 1)) return err(400, 'bad_request'); vsettings = { months: d.months, partial: d.partial === true, min: d.min, terms: d.terms }; return ok({ settings: vsettings }); }
    case 'admin/vouchers/create': {
      if (!owner) return err(403, 'forbidden');
      const seen = voucherOps.get(d.op); if (seen) return ok({ replayed: true, voucher: seen });
      if (d.kind === 'value' && !(d.value >= 100)) return err(400, 'bad_request');
      const worth = d.kind === 'value' ? d.value : (state.services.find((s) => s.id === d.service)?.price ?? 0);
      const v: VoucherRow = { id: vouchers.length + 1, kind: d.kind, hint: 'MOCK'.slice(0, 4), status: 'active', service: d.kind === 'service' ? (state.services.find((s) => s.id === d.service)?.name ?? '') : null,
        value: d.kind === 'value' ? d.value : 0, balance: d.kind === 'value' ? d.value : 0, reserved: 0, partial: d.kind === 'value' && d.partial !== false, expires_at: NOW + 365 * 86400, extended: false,
        sold_at: NOW, paid: worth, method: d.method, received: d.received, note: d.note ?? '' };
      vouchers.push(v); voucherOps.set(d.op, v);
      return ok({ replayed: false, qr: MOCK_QR, code: 'MOCK-ABCD-EFGH-JKMN', link: 'https://t.me/mock_bot?start=gv_MOCKABCDEFGHJKMN', voucher: v });
    }
    case 'admin/vouchers/reissue': {
      if (!owner) return err(403, 'forbidden');
      const old = vouchers.find((x) => x.id === d.id); if (!old) return err(404, 'not_found');
      if (old.reserved > 0) return err(409, 'voucher_reserved');
      if (old.status !== 'active') return err(409, 'voucher_not_active');
      old.status = 'void';
      const nv: VoucherRow = { ...old, id: vouchers.length + 1, status: 'active', hint: 'NEW1', value: old.kind === 'value' ? old.balance : 0, paid: 0, received: 0 };
      vouchers.push(nv);
      return ok({ replayed: false, qr: MOCK_QR, code: 'NEW1-ABCD-EFGH-JKMN', link: 'https://t.me/mock_bot?start=gv_NEW1ABCDEFGHJKMN', voucher: nv });
    }
    case 'admin/vouchers/send-card': { if (!owner) return err(403, 'forbidden'); sentCards.push(String(d.png).length); return ok({ sent: true }); }
    case 'admin/vouchers/extend': { const v = vouchers.find((x) => x.id === d.id); if (!v) return err(404, 'not_found'); v.expires_at += d.months * 30 * 86400; v.extended = true; return ok({ ok: true, voucher: v }); }
    case 'admin/vouchers/void': { const v = vouchers.find((x) => x.id === d.id); if (!v) return err(404, 'not_found'); v.status = 'void'; return ok({ ok: true, voucher: v }); }
    case 'admin/calendar': {
      const ids: number[] = (d.staff ?? scope.map((s) => s.id)).filter(can);
      const from = d.from as string, days = d.days ?? 1;
      const lo = toUtc(from, 0, TZ), hi = toUtc(addDays(from, days), 0, TZ);
      const work: CalData['work'] = {};
      for (const id of ids) for (let i = 0; i < days; i++) (work[String(id)] ??= {})[addDays(from, i)] = iv(id, addDays(from, i));
      return ok({
        from, days, work,
        appointments: state.appts.filter((a) => ids.includes(a.staff_id) && ['pending', 'pending_deposit', 'confirmed', 'completed', 'no_show'].includes(a.status) && a.start < hi && a.end > lo),
        blocks: state.blocks.filter((b) => ids.includes(b.staff_id) && b.start < hi && b.end > lo),
        overrides: state.overrides.filter((o) => ids.includes(o.staff_id) && o.date >= from && o.date < addDays(from, days)),
      } satisfies CalData);
    }
    case 'admin/clients/search': return ok({ clients: String(d.q).trim().length < 2 ? [] : state.clients.filter((c) => c.name.toLowerCase().includes(String(d.q).toLowerCase())) });
    case 'admin/clients/create': { const c = { id: state.nextId++, name: d.name, phone: d.phone || null, username: null, tg: false }; state.clients.push(c); return ok({ client: c }); }
    case 'admin/appointments/create': {
      const s = state.services.find((x) => x.id === d.service)!, cl = state.clients.find((x) => x.id === d.client_id);
      if (!cl) return err(404, 'not_found');
      const dur = s.duration_min + (d.addons ?? []).length * 15, end = d.start + dur * 60;
      const cands = d.staff > 0 ? [d.staff] : scope.filter((p) => !p.off.includes(d.service) && p.active).map((p) => p.id);
      const pick = cands.find((id: number) => !busy(id, d.start, end + s.buffer_min * 60) && (d.override || iv(id, new Date(d.start * 1000).toISOString().slice(0, 10)).some(([a, b]) => d.start >= a && end <= b)));
      if (pick === undefined) return ok({ outcome: 'slot_taken', alternatives: [] });
      const a: AdmAppt = { id: state.nextId++, rev: 1, staff_id: pick, status: 'confirmed', start: d.start, end, buffer_min: s.buffer_min, service_id: s.id, service: s.name, addons: [], price: s.price, auto: d.staff === 0, by: 'master', address: 'held', address_policy: 'default', client: cl };
      state.appts.push(a);
      return ok({ outcome: 'ok', appointment: a });
    }
    case 'admin/appointments/move': {
      const a = apptOf(d.id);
      if (!a || !can(a.staff_id)) return err(404, 'not_found');
      if (a.rev !== d.revision) return err(409, 'stale_revision');
      const to = d.staff > 0 ? d.staff : a.staff_id, end = d.start + (a.end - a.start);
      const inHours = iv(to, new Date(d.start * 1000).toISOString().slice(0, 10)).some(([x, y]) => d.start >= x && end <= y);
      if (busy(to, d.start, end + a.buffer_min * 60, a.id) || (!d.override && !inHours)) return ok({ outcome: 'slot_taken', alternatives: [] });
      Object.assign(a, { start: d.start, end, staff_id: to, rev: a.rev + 1, auto: false });
      return ok({ outcome: 'ok', appointment: a });
    }
    case 'admin/appointments/send-address': {
      const a = apptOf(d.id);
      if (!a || !can(a.staff_id)) return err(404, 'not_found');
      const result = a.address === 'sent' ? 'already' : a.status !== 'confirmed' ? 'not_confirmed' : 'queued';
      if (result === 'queued') a.address = 'sent';
      return ok({ result, appointment: a });
    }
    case 'admin/clients/address-policy': {
      const a = apptOf(d.appt);
      if (!a || !can(a.staff_id)) return err(404, 'not_found');
      a.address_policy = d.policy;
      return ok({ appointment: a });
    }
    case 'admin/appointments/status': {
      const a = apptOf(d.id);
      if (!a || !can(a.staff_id)) return err(404, 'not_found');
      if (a.rev !== d.revision) return err(409, 'stale_revision');
      const to = ({ confirm: 'confirmed', complete: 'completed', no_show: 'no_show', cancel: 'cancelled' } as Record<string, string>)[d.action];
      if (!to) return err(400, 'bad_request');
      if (to === 'cancelled') state.appts = state.appts.filter((x) => x.id !== a.id); else Object.assign(a, { status: to, rev: a.rev + 1 });
      return ok({ outcome: 'ok', appointment: a });
    }
    case 'admin/staff/save': {
      if (!owner) return err(403, 'forbidden');
      let p = d.id ? state.staff.find((s) => s.id === d.id) : undefined;
      if (!p) { p = { id: state.nextId++, name: '', bio: '', color: '', active: true, linked: false, tg_id: null, mine: false, admin: false, off: [], weekly: JSON.parse(JSON.stringify(state.staff[0]?.weekly ?? {})), future: 0 }; state.staff.push(p); }
      Object.assign(p, { name: d.name, bio: d.bio, color: d.color, off: d.off });
      if (d.admin === true && d.link !== 'self' && d.link !== 'tg') return err(400, 'bad_request');
      p.admin = d.admin === true;
      if (d.link === 'tg') { p.linked = true; p.mine = false; p.tg_id = d.tg_id; } else if (d.link === 'self') { if (state.staff.some((s) => s.mine && s.id !== p!.id)) return err(409, 'already_linked'); p.mine = true; p.linked = true; } else if (d.link === 'none') { p.mine = false; p.linked = false; }
      return ok({ id: p.id, staff: boot().staff });
    }
    case 'admin/staff/delete': {
      if (!owner) return err(403, 'forbidden');
      if (state.staff.length <= 1) return err(409, 'last_staff');
      if (state.appts.some((a) => a.staff_id === d.id)) return err(409, 'has_history');
      state.staff = state.staff.filter((s) => s.id !== d.id);
      return ok({ staff: boot().staff });
    }
    case 'admin/staff/active': {
      if (!owner) return err(403, 'forbidden');
      const p = state.staff.find((s) => s.id === d.id);
      if (!p) return err(404, 'not_found');
      if (!d.active) {
        if (state.staff.filter((s) => s.active && s.id !== p.id).length === 0) return err(409, 'last_staff');
        if (state.appts.some((a) => a.staff_id === p.id && ['pending', 'confirmed'].includes(a.status))) return err(409, 'has_future');
      }
      p.active = d.active;
      return ok({ staff: boot().staff });
    }
    case 'admin/hours/save': {
      if (!can(d.staff)) return err(403, 'forbidden');
      state.staff.find((s) => s.id === d.staff)!.weekly = d.weekly;
      return ok({ staff: boot().staff });
    }
    case 'admin/override/save': case 'admin/override/delete': {
      const ids = d.staff === 0 ? state.staff.filter((s) => s.active).map((s) => s.id) : [d.staff];
      if ((d.staff === 0 && !owner) || (d.staff !== 0 && !can(d.staff))) return err(403, 'forbidden');
      for (const id of ids) {
        state.overrides = state.overrides.filter((o) => !(o.staff_id === id && o.date === d.date));
        if (route.endsWith('save')) state.overrides.push({ staff_id: id, date: d.date, closed: d.closed, intervals: d.intervals, note: d.note ?? '' });
      }
      return ok({ ok: true });
    }
    case 'admin/block/add': {
      if (!can(d.staff)) return err(403, 'forbidden');
      state.blocks.push({ id: state.nextId++, staff_id: d.staff, start: d.start, end: d.end, reason: d.reason ?? '' });
      return ok({ ok: true, overlaps: state.appts.filter((a) => a.staff_id === d.staff && a.start < d.end && a.end > d.start).length });
    }
    case 'admin/block/delete': state.blocks = state.blocks.filter((b) => b.id !== d.id); return ok({ ok: true });
    case 'admin/service/save': {
      if (!owner) return err(403, 'forbidden');
      if (d.duration_min % 5 || d.buffer_min % 5 || d.duration_min < 5) return err(400, 'bad_request');
      const names = d.names as SvcRow['names'] | undefined;
      if (!d.id && (!names || !Object.values(names).some((n) => n.trim()))) return err(400, 'bad_request');
      let cat: number | null = (d.category_id as number | null | undefined) ?? null;
      if (d.new_category) { cat = state.categories.length + 1; state.categories.push({ id: cat, name: String(d.new_category) }); }
      const label = names ? (names.en || names.cs || names.ru || names.uk) : '';
      if (d.id) {
        const row = state.services.find((s) => s.id === d.id)!;
        Object.assign(row, { duration_min: d.duration_min, buffer_min: d.buffer_min, price: d.price, price_from: d.price_from, active: d.active, staff_only: d.staff_only === true });
        if (d.aftercare) row.aftercare = d.aftercare;
        if ('rebook_after_days' in d) row.rebook_after_days = d.rebook_after_days || null;
        if (names) Object.assign(row, { names, name: label });
        if (!row.is_addon && ('category_id' in d || d.new_category)) row.category_id = cat;
      } else {
        const id = Math.max(0, ...state.services.map((s) => s.id)) + 1;
        state.services.push({ id, name: label, is_addon: d.is_addon === true, duration_min: d.duration_min, buffer_min: d.buffer_min, price: d.price, price_from: d.price_from, active: d.active, names: names!, category_id: d.is_addon === true ? null : cat });
      }
      return ok({ services: state.services, categories: state.categories });
    }
    case 'admin/service/delete': {
      if (!owner) return err(403, 'forbidden');
      const used = state.appts.some((a) => a.service_id === d.id);
      if (used) state.services.find((s) => s.id === d.id)!.active = false; else state.services = state.services.filter((s) => s.id !== d.id);
      return ok({ deleted: !used, services: state.services, categories: state.categories });
    }
    case 'admin/broadcast/info': return ok({ optin: 2, clients: 5, skipped: 1, min_days: 7, last: null });
    case 'admin/broadcast/send': {
      if (!owner) return err(403, 'forbidden');
      return ok({ sent: d.test ? 1 : 2, skipped: d.test ? 0 : 1, test: d.test === true, optin: 2, clients: 5, last: null });
    }
    case 'admin/loyalty/decide': {
      if (!owner) return err(403, 'forbidden');
      state.loyaltyPending = state.loyaltyPending.filter((p) => p.id !== d.id);
      return ok({ loyalty_pending: state.loyaltyPending });
    }
    case 'admin/settings/save': { if (!owner) return err(403, 'forbidden'); if ('privacy_reviewed' in d) privacyMock.on = d.privacy_reviewed === true; if ('google_review_url' in d && d.google_review_url !== '' && !/^https:\/\/\S{4,}$/.test(String(d.google_review_url))) return err(400, 'bad_request'); Object.assign(state.settings, d); if ('automation_enabled' in d) state.settings.automation_on = d.automation_enabled === true; if ('rem1_h' in d) { state.settings.rem1_auto = d.rem1_h === 0; state.settings.rem1_h = d.rem1_h === 0 ? state.settings.cancel_cutoff_h + 2 : d.rem1_h; state.settings.rem1_warn = !state.settings.rem1_auto && state.settings.rem1_h < state.settings.cancel_cutoff_h + 1; } return ok({ settings: state.settings }); }
    default: return err(404, 'not_found');
  }
}
export { minutesOf };
