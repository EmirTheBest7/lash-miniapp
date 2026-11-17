import { useEffect, useMemo, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { daypart, duration, money, stripLabel, todayIso, dayLong } from '../format';
import { useBack } from '../hooks';
import { t } from '../i18n';
import type { Ctx } from '../nav';
import { haptic } from '../tg';
import type { Appt, Availability, Slot, StripDay, Staff } from '../types';
import { Cell, Chip, Empty, MainAction, Section, Sheet, Skeleton, Switch } from '../ui/components';

type SlotsRes = { date: string; slots: Slot[] };

export function Pick({ ctx, service, addons: initialAddons, move, prefer }: { ctx: Ctx; service: number; addons: number[]; move?: Appt; prefer?: string }) {
  const { boot } = ctx;
  const svc = boot.categories.flatMap((c) => c.services).find((s) => s.id === service);
  const [addons, setAddons] = useState<number[]>(initialAddons);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [strip, setStrip] = useState<StripDay[]>([]);
  const [quote, setQuote] = useState<Availability['quote'] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [cache, setCache] = useState<Record<string, Slot[]>>({});
  const [sel, setSel] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(true);
  const [full, setFull] = useState<string | null>(null);
  const [staffOpts, setStaffOpts] = useState<Staff[]>([]);
  const [staffSel, setStaffSel] = useState(0);                     // 0 = any available; only offered when there is a real choice (2+)
  const today = todayIso(boot.config.server_time, boot.config.tz);
  useBack(() => ctx.pop());

  const excl = move ? { exclude: move.id } : staffSel > 0 ? { staff: staffSel } : {};
  useEffect(() => {
    let live = true;
    setBusy(true); setSel(null); setCache({});
    void (async () => {
      const r = await api<Availability>('availability', { service, addons, ...excl });
      if (!live) return;
      setBusy(false);
      if (!r.ok) { ctx.toast(t(r.error.code === 'rate_limited' ? 'err.rate' : 'err.network')); return; }
      setStrip(r.data.strip); setQuote(r.data.quote);
      if (!move) { const opts = r.data.staff ?? []; setStaffOpts(opts); if (staffSel > 0 && !opts.some((p) => p.id === staffSel)) setStaffSel(0); }
      const pref = prefer && r.data.strip.find((d) => d.date === prefer && d.status === 'free');
      if (pref) { void pickDate(pref.date, true); return; }
      const f = r.data.first;
      if (f) { setDate(f.date); setSlots(f.slots); setCache({ [f.date]: f.slots }); } else { setDate(null); setSlots([]); }
    })();
    return () => { live = false; };
  }, [addons.join(','), staffSel]);

  async function pickDate(d: string, silent = false) {
    setDate(d); setSel(null);
    if (cache[d]) { setSlots(cache[d]!); return; }
    if (!silent) setBusy(true);
    const r = await api<SlotsRes>('slots', { service, addons, date: d, ...excl });
    setBusy(false);
    if (!r.ok) { ctx.toast(t('err.network')); return; }
    setSlots(r.data.slots); setCache((c) => ({ ...c, [d]: r.data.slots }));
  }

  async function later() {
    const last = strip[strip.length - 1];
    if (!last) return;
    const next = new Date(`${last.date}T12:00:00`); next.setDate(next.getDate() + 1);
    const from = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    const r = await api<Availability>('availability', { service, addons, from, ...excl });
    if (r.ok) setStrip((s) => [...s, ...r.data.strip]);
  }

  async function notify() {
    const d = full; setFull(null);
    if (!d) return;
    const r = await api('waitlist/add', { service, addons, date: d }, newOpId());
    ctx.toast(r.ok ? t('pick.notified') : t('err.network'));
  }

  const groups = useMemo(() => {
    const g: Record<'morning' | 'afternoon' | 'evening', Slot[]> = { morning: [], afternoon: [], evening: [] };
    for (const s of slots) g[daypart(s.time)].push(s);
    return g;
  }, [slots]);
  const addonList = boot.addons;
  const addonSum = addonList.filter((a) => addons.includes(a.id));
  const dur = quote?.duration_min ?? svc?.duration_min ?? 0;
  const price = quote?.price ?? svc?.price ?? 0;

  return (
    <div class="page">
      <h1 class="large">{svc?.name ?? t('pick.title')}</h1>
      <div class="muted" style={{ margin: '0 16px 4px' }}>{duration(dur)} · {money(price, svc?.price_from)}</div>
      {!move && addonList.length > 0 && (
        <Section><Cell icon="plus" title={t('pick.addons') + (addons.length ? ` (${addons.length})` : '')} chevron onClick={() => setAddonsOpen(true)} /></Section>
      )}
      {!move && staffOpts.length >= 2 && (
        <Section title={t('pick.staff')}>
          <div class="chips" data-testid="staff">
            <Chip label={t('short.any')} selected={staffSel === 0} onClick={() => setStaffSel(0)} />
            {staffOpts.map((p) => <Chip label={p.name} selected={staffSel === p.id} onClick={() => setStaffSel(p.id)} />)}
          </div>
          {staffSel > 0 && staffOpts.find((p) => p.id === staffSel)?.bio && <div class="note">{staffOpts.find((p) => p.id === staffSel)!.bio}</div>}
        </Section>
      )}
      <Section title={t('pick.days')}>
        <div class="chips strip" data-testid="strip">
          {strip.map((d) => {
            const l = stripLabel(d.date, today);
            return (
              <Chip label={l.label} sub={l.sub} selected={d.date === date} disabled={d.status === 'closed'} struck={d.status === 'full'}
                onClick={() => (d.status === 'full' ? setFull(d.date) : void pickDate(d.date))} />
            );
          })}
          {strip.length > 0 && <Chip label={t('short.more')} onClick={() => void later()} />}
        </div>
      </Section>
      {busy && <Skeleton lines={3} />}
      {!busy && date && slots.length === 0 && <Empty title={t('pick.no_times')} icon="clock" />}
      {!busy && (['morning', 'afternoon', 'evening'] as const).map((k) => groups[k].length > 0 && (
        <Section title={t('pick.' + k)}>
          <div class="chips" data-testid={`slots-${k}`}>
            {groups[k].map((s) => <Chip label={s.time} selected={sel?.start === s.start} onClick={() => { haptic.select(); setSel(s); }} />)}
          </div>
        </Section>
      ))}
      <MainAction text={t('btn.continue')} enabled={!!sel} hidden={addonsOpen || full !== null} onClick={() => sel && ctx.push({ k: 'summary', service, addons, slot: sel, quote, move, staff: staffOpts.find((p) => p.id === staffSel) })} />
      <Sheet open={addonsOpen} onClose={() => setAddonsOpen(false)} title={t('pick.addons_sheet')}>
        <Section>
          {addonList.map((a) => (
            <Cell title={a.name} subtitle={`+${duration(a.duration_min)} · +${money(a.price)}`}
              after={<Switch label={a.name} checked={addons.includes(a.id)} onChange={(on) => setAddons((cur) => (on ? [...cur, a.id] : cur.filter((x) => x !== a.id)))} />} />
          ))}
        </Section>
        {addonSum.length > 0 && <div class="muted" style={{ margin: '0 16px 8px' }}>{addonSum.map((a) => a.name).join(', ')}</div>}
        <Cell title={t('short.done')} chevron onClick={() => setAddonsOpen(false)} />
      </Sheet>
      <Sheet open={full !== null} onClose={() => setFull(null)} title={t('pick.full_title')}>
        <div style={{ margin: '0 16px 8px' }}>{full ? t('pick.full_text', { day: dayLong(full) }) : ''}</div>
        <Section><Cell title={t('pick.notify')} chevron onClick={() => void notify()} /></Section>
      </Sheet>
    </div>
  );
}
