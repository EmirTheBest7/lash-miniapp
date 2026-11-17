import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { dayLong, dayShort } from '../format';
import { t } from '../i18n';
import { confirmNative, haptic } from '../tg';
import { Icon } from '../ui/Icon';
import { Chip, Empty } from '../ui/components';
import { ApptCard } from './ApptCard';
import { DaySheet } from './DaySheet';
import { NewAppt } from './NewAppt';
import { addDays, hhmm, isoWeekday, minutesOf, toUtc } from './time';
import type { AdmAppt, AdminBoot, CalData, MoveData, StaffRow } from './types';

const PPH = 56;                         // pixels per hour
const ppm = PPH / 60;
const px = (n: number): string => `${Math.round(n * 100) / 100}px`;   // Preact 11 does not add "px" to numeric style values
export const PALETTE = ['#d4547a', '#3b82c4', '#2e9e6b', '#e0902d', '#8b5cc7', '#14a3a8'];
export const colorOf = (s: StaffRow, i: number): string => s.color || PALETTE[i % PALETTE.length]!;

/**
 * Day calendar, Teams-style: one column per staff member side by side ("All"), or a single wide column (one person selected).
 * Non-working time is hatched, breaks are the gaps between working intervals, blocks are labelled, an appointment's buffer is drawn
 * as a hatched tail. Tap an empty spot = new appointment there; tap an appointment = card (reassign / move / status).
 * Moving is tap-to-place (pick "Move", then tap the new time in any column), not drag: reliable inside the Telegram webview.
 */
export function Calendar({ boot, toast, reloadBoot }: { boot: AdminBoot; toast: (s: string) => void; reloadBoot: () => Promise<void> }) {
  const tz = boot.config.tz, today = boot.config.today;
  const staff = boot.staff.filter((s) => s.active);
  const [date, setDate] = useState(today);
  const [sel, setSel] = useState(0);
  const [cal, setCal] = useState<CalData | null>(null);
  const [card, setCard] = useState<AdmAppt | null>(null);
  const [moving, setMoving] = useState<AdmAppt | null>(null);
  const [creating, setCreating] = useState<{ min: number; staff: number } | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const shown = sel === 0 ? staff : staff.filter((s) => s.id === sel);
  const idx = (s: StaffRow) => boot.staff.findIndex((x) => x.id === s.id);

  const load = useCallback(async () => {
    const r = await api<CalData>('admin/calendar', { from: date, days: 1, staff: shown.map((s) => s.id) });
    if (!r.ok) { toast(t('err.network')); return; }
    setCal(r.data);
    setCard((c) => (c ? r.data.appointments.find((a) => a.id === c.id) ?? null : c));
  }, [date, shown.map((s) => s.id).join(',')]);
  useEffect(() => { setCal(null); void load(); }, [load]);

  // visible hours: the working time of the shown people plus anything booked, padded by an hour
  const [from, to] = useMemo(() => {
    let lo = 24 * 60, hi = 0;
    for (const s of shown) for (const [a, b] of cal?.work[String(s.id)]?.[date] ?? []) { lo = Math.min(lo, minutesOf(a, tz)); hi = Math.max(hi, b - a > 0 ? minutesOf(b - 1, tz) + 1 : 0); }
    for (const a of cal?.appointments ?? []) { lo = Math.min(lo, minutesOf(a.start, tz)); hi = Math.max(hi, minutesOf(a.end, tz) + a.buffer_min); }
    if (lo >= hi) { lo = 9 * 60; hi = 18 * 60; }
    return [Math.max(0, Math.floor((lo - 60) / 60) * 60), Math.min(24 * 60, Math.ceil((hi + 60) / 60) * 60)];
  }, [cal, shown.map((s) => s.id).join(','), date]);

  const monday = addDays(date, 1 - isoWeekday(date));
  const nowMin = date === today ? minutesOf(boot.config.server_time, tz) : -1;

  function tapColumn(e: MouseEvent, staffId: number) {
    const y = e.clientY - (e.currentTarget as HTMLElement).closest('.cal-col')!.getBoundingClientRect().top;
    const step = Math.max(5, boot.settings.slot_step_min);
    const min = Math.floor((from + y / ppm) / step) * step;
    if (moving) void place(staffId, min); else setCreating({ min, staff: staffId });
  }

  async function place(staffId: number, min: number, override = false): Promise<void> {
    const m = moving;
    if (!m) return;
    const r = await api<MoveData>('admin/appointments/move', { id: m.id, revision: m.rev, start: toUtc(date, min, tz), staff: staffId, ...(override ? { override: true } : {}) }, newOpId());
    if (!r.ok) { toast(t(r.error.code === 'stale_revision' ? 'err.stale' : 'err.network')); if (r.error.code === 'stale_revision') { setMoving(null); await load(); } return; }
    if (r.data.outcome === 'ok') { setMoving(null); haptic.success(); toast(t('adm.moved')); await load(); return; }
    haptic.warn();
    if (!override && (await confirmNative(t('adm.place_anyway')))) return place(staffId, min, true);
    toast(t('adm.not_free'));
  }

  if (staff.length === 0) return <Empty title={t('adm.no_calendar')} icon="calendar" />;   // an unlinked master in a multi-staff studio
  return (
    <div class="page">
      <div class="cal-bar">
        <button class="icon-btn" aria-label={t('adm.prev')} onClick={() => setDate(addDays(date, -1))}><Icon name="back" /></button>
        <div class="grow" data-testid="cal-date">{dayLong(date)}</div>
        <button class="icon-btn" aria-label={t('adm.next')} onClick={() => setDate(addDays(date, 1))}><Icon name="chevron" /></button>
      </div>
      <div class="week" data-testid="week">
        {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d) => (
          <Chip label={d === today ? t('short.today') : dayShort(d)} selected={d === date} onClick={() => setDate(d)} />
        ))}
      </div>
      {staff.length > 1 && (
        <div class="week" data-testid="staff-filter">
          <Chip label={t('adm.all')} selected={sel === 0} onClick={() => setSel(0)} />
          {staff.map((s) => <Chip label={s.name || t('staff.default')} selected={sel === s.id} onClick={() => setSel(s.id)} />)}
        </div>
      )}
      {moving && (
        <div class="banner" role="status"><span class="grow">{t('adm.move_hint', { name: moving.client.name })}</span><button class="link" onClick={() => setMoving(null)}>{t('short.cancel')}</button></div>
      )}
      <div class="cal-scroll">
        <div class="cal-table" style={{ gridTemplateColumns: `44px repeat(${Math.max(1, shown.length)}, minmax(${shown.length > 2 ? 132 : 100}px, 1fr))` }} data-testid="cal">
          <div class="cal-h" />
          {shown.map((s) => (
            <button class="cal-h" style={{ '--c': colorOf(s, idx(s)) }} onClick={() => setDay(s.id)} data-testid={`head-${s.id}`}>
              <span class="dot" />{s.name || t('staff.default')}
            </button>
          ))}
          <div class="cal-axis" style={{ height: px((to - from) * ppm) }}>
            {Array.from({ length: Math.floor((to - from) / 60) + 1 }, (_, i) => <span style={{ top: px(i * PPH) }}>{hhmm(from + i * 60)}</span>)}
          </div>
          {shown.map((s) => {
            const c = colorOf(s, idx(s));
            const work = cal?.work[String(s.id)]?.[date] ?? [];
            return (
              <div class="cal-col" style={{ height: px((to - from) * ppm), '--c': c }} data-testid={`col-${s.id}`} aria-label={s.name || t('staff.default')} onClick={(e) => tapColumn(e as unknown as MouseEvent, s.id)}>
                {work.map(([a, b]) => <div class="cal-open" style={{ top: px((minutesOf(a, tz) - from) * ppm), height: px((minutesOf(b - 1, tz) + 1 - minutesOf(a, tz)) * ppm) }} />)}
                {Array.from({ length: Math.floor((to - from) / 60) }, (_, i) => <div class="cal-line" style={{ top: px((i + 1) * PPH) }} />)}
                {(cal?.blocks ?? []).filter((b) => b.staff_id === s.id).map((b) => (
                  <div class="blk" style={{ top: px((minutesOf(b.start, tz) - from) * ppm), height: px(Math.max(18, (b.end - b.start) / 60 * ppm)) }}>{b.reason || t('adm.blocked')}</div>
                ))}
                {(cal?.appointments ?? []).filter((a) => a.staff_id === s.id).map((a) => {
                  const top = (minutesOf(a.start, tz) - from) * ppm, h = Math.max(22, (a.end - a.start) / 60 * ppm);
                  return (
                    <>
                      <button class={`ev${a.status === 'pending' || a.status === 'pending_deposit' ? ' pending' : ''}${a.status === 'completed' || a.status === 'no_show' ? ' done' : ''}${moving?.id === a.id ? ' picked' : ''}`}
                        style={{ top: px(top), height: px(h) }} onClick={(e) => { e.stopPropagation(); if (moving) tapColumn(e as unknown as MouseEvent, s.id); else setCard(a); }}>
                        <b>{a.client.name}</b><span>{hhmm(minutesOf(a.start, tz))}–{hhmm(minutesOf(a.end, tz))} · {a.service}</span>
                      </button>
                      {a.buffer_min > 0 && <div class="ev-buf" style={{ top: px(top + h), height: px(a.buffer_min * ppm) }} />}
                    </>
                  );
                })}
                {nowMin >= from && nowMin <= to && <div class="cal-now" style={{ top: px((nowMin - from) * ppm) }} />}
              </div>
            );
          })}
        </div>
      </div>
      <div class="note" style={{ textAlign: 'center' }}>{t('adm.tap_hint')}</div>
      <ApptCard open={card !== null} appt={card} boot={boot} tz={tz} onClose={() => setCard(null)} toast={toast} reload={load}
        onMove={(a) => { setCard(null); setMoving(a); }} />
      <NewAppt open={creating !== null} boot={boot} tz={tz} date={date} min={creating?.min ?? 600} staffId={creating?.staff ?? 0} onClose={() => setCreating(null)} toast={toast} reload={load} />
      <DaySheet open={day !== null} boot={boot} tz={tz} date={date} staffId={day ?? 0} cal={cal} onClose={() => setDay(null)} toast={toast} reload={async () => { await load(); await reloadBoot(); }} />
    </div>
  );
}
