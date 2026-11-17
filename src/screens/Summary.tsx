import { useRef, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { applyDiscount, duration, money, whenLong } from '../format';
import { useBack } from '../hooks';
import { t } from '../i18n';
import type { Ctx } from '../nav';
import { haptic, requestPhone } from '../tg';
import type { Appt, BookData, Quote, Slot, Staff } from '../types';
import { Cell, MainAction, Section, Sheet } from '../ui/components';

type Gate = null | 'privacy' | 'phone';

export function Summary({ ctx, service, addons, slot: initial, quote, move, staff }: { ctx: Ctx; service: number; addons: number[]; slot: Slot; quote: Quote | null; move?: Appt; staff?: Staff }) {
  const { boot } = ctx;
  const svc = boot.categories.flatMap((c) => c.services).find((s) => s.id === service)!;
  const addonRows = boot.addons.filter((a) => addons.includes(a.id));
  const [slot, setSlot] = useState<Slot>(initial);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState<Gate>(null);
  const [gateMsg, setGateMsg] = useState<string | null>(null);
  const [alts, setAlts] = useState<Slot[] | null>(null);
  // One op id per ATTEMPT: a double tap or a network retry replays the same answer; after any final answer it rotates.
  const op = useRef(newOpId());
  useBack(() => ctx.pop());

  const dur = svc.duration_min + addonRows.reduce((s, a) => s + a.duration_min, 0);
  const price = svc.price + addonRows.reduce((s, a) => s + a.price, 0);

  function finish(kind: 'confirmed' | 'pending' | 'moved', d: BookData) {
    haptic.success();
    if (d.my) ctx.setMy(d.my);
    const a = d.appointment!;
    ctx.replace({ k: 'done', kind, when: { date: a.date, time: a.time }, service: a.service, staff: a.staff, decideBy: a.decide_by });
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    const r = move
      ? await api<BookData>('appointments/move', { id: move.id, start: slot.start, revision: move.rev }, op.current)
      : await api<BookData>('appointments/create', { service, addons, start: slot.start, ...(staff ? { staff: staff.id } : {}) }, op.current);
    setBusy(false);
    if (!r.ok) {
      haptic.error();
      if (r.error.code === 'stale_revision') { ctx.toast(t('err.stale')); await ctx.reload(); ctx.home(); return; }
      ctx.toast(t(r.error.code === 'rate_limited' ? 'err.rate' : 'err.network'));
      return;                                                          // network error: keep the op id, a retry is safe
    }
    op.current = newOpId();
    const d = r.data;
    switch (d.outcome) {
      case 'ok':
      case 'idempotent':
        return finish(move ? 'moved' : d.appointment?.status === 'confirmed' ? 'confirmed' : 'pending', d);
      case 'needs_gate':
        setGate(d.needs?.privacy ? 'privacy' : 'phone');
        return;
      case 'slot_taken':
        haptic.warn(); setAlts(d.alternatives ?? []); return;
      case 'too_late':
        ctx.toast(t('appts.too_late')); ctx.pop(); return;
      default:
        ctx.toast(t('err.generic'));
    }
  }

  async function agree() {
    setBusy(true);
    const r = await api('consent', { accept: true }, newOpId());
    setBusy(false);
    if (!r.ok) { ctx.toast(t('err.network')); return; }
    boot.me.privacy_accepted = true;
    if (boot.me.phone_set) { setGate(null); void submit(); } else { setGate('phone'); }
  }

  async function sharePhone() {
    setGateMsg(t('gate.waiting')); setBusy(true);
    const sent = await requestPhone();
    if (!sent) { setBusy(false); setGateMsg(t('gate.unavailable')); return; }
    // The contact reaches the BOT (which checks it is the user's own number); poll the cheap `me` call with a backoff.
    for (const wait of [800, 1200, 1800, 2500, 3500, 5000]) {
      await new Promise((res) => setTimeout(res, wait));
      const m = await api<{ phone_set: boolean }>('me');
      if (m.ok && m.data.phone_set) { boot.me.phone_set = true; setBusy(false); setGateMsg(null); setGate(null); void submit(); return; }
    }
    setBusy(false); setGateMsg(t('gate.not_received'));
  }

  const action = gate === 'privacy' ? { text: t('btn.agree'), fn: () => void agree() }
    : gate === 'phone' ? { text: t('btn.share_phone'), fn: () => void sharePhone() }
    : { text: move ? t('btn.confirm_move') : t('btn.confirm'), fn: () => void submit() };

  return (
    <div class="page">
      <h1 class="large">{t('sum.title')}</h1>
      <Section footer={t('sum.policy', { h: boot.policy.cancel_cutoff_h })}>
        {move && <Cell title={t('sum.move_from')} after={whenLong(move.date, move.time)} />}
        <Cell title={move ? t('sum.move_to') : t('sum.when')} after={whenLong(slot.date, slot.time)} />
        {(staff || move?.staff) && <Cell title={t('sum.staff')} after={staff?.name ?? move?.staff ?? ''} />}
        <Cell title={t('sum.service')} subtitle={addonRows.map((a) => '+ ' + a.name).join(' · ') || undefined} after={svc.name} />
        <Cell title={t('sum.duration')} after={duration(dur)} />
        {boot.loyalty?.ready != null && price > 0 && <Cell title={t('sum.loyalty')} after={`−${boot.loyalty.ready}%`} />}
        <Cell title={t('sum.price')} after={money(boot.loyalty?.ready != null && price > 0 ? applyDiscount(price, boot.loyalty.ready) : price, svc.price_from)} />
      </Section>
      {!move && quote && (quote.warnings.length > 0 || quote.will_wait) && (
        <Section>
          {quote.warnings.map((w) => <div class="note">{t('sum.warn_' + w)}</div>)}
          {quote.will_wait && <div class="note">{t('sum.will_wait')}</div>}
        </Section>
      )}
      <MainAction text={action.text} onClick={action.fn} enabled={!busy} busy={busy} hidden={alts !== null} />
      <Sheet open={gate === 'privacy'} onClose={() => setGate(null)} title={boot.privacy.title || t('gate.privacy_title')}>
        <div style={{ margin: '0 16px 12px', whiteSpace: 'pre-line', fontSize: 14 }}>{boot.privacy.text}</div>
      </Sheet>
      <Sheet open={gate === 'phone'} onClose={() => setGate(null)} title={t('gate.phone_title')}>
        <div style={{ margin: '0 16px 12px' }}>{t('gate.phone_text')}</div>
        {gateMsg && <div class="muted" style={{ margin: '0 16px 12px' }} role="status">{gateMsg}</div>}
      </Sheet>
      <Sheet open={alts !== null} onClose={() => setAlts(null)} title={t('taken.title')}>
        {alts && alts.length > 0 ? (
          <>
            <div class="muted" style={{ margin: '0 16px 8px' }}>{t('taken.text')}</div>
            <Section>{alts.map((s) => <Cell title={whenLong(s.date, s.time)} chevron onClick={() => { setSlot(s); setAlts(null); }} />)}</Section>
          </>
        ) : <div class="muted" style={{ margin: '0 16px 16px' }}>{t('taken.none')}</div>}
        <Cell title={t('short.back')} chevron onClick={() => ctx.pop()} />
      </Sheet>
    </div>
  );
}
