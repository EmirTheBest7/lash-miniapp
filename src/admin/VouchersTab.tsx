import { useCallback, useEffect, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { money } from '../format';
import { getLang, t } from '../i18n';
import { haptic, openTelegramLink } from '../tg';
import { Button, Cell, Section, Segmented, Sheet, Skeleton, Switch } from '../ui/components';
import type { AdminBoot, VoucherCreated, VoucherRow } from './types';

const LOCALE: Record<string, string> = { cs: 'cs-CZ', en: 'en-GB', ru: 'ru-RU', uk: 'uk-UA' };
/** A date WITH the year: a voucher that expires is no place for a guess. */
const dateOf = (ts: number): string => new Intl.DateTimeFormat(LOCALE[getLang()] ?? 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Prague' }).format(new Date(ts * 1000));
const num = (v: string): number => Math.max(0, Math.round(Number(v) || 0));

type Form = { kind: 'value' | 'service'; value: number; service: number; months: number; date: string; partial: boolean; method: 'cash' | 'transfer' | 'other'; received: string; note: string };
const blank = (boot: AdminBoot): Form => ({ kind: 'value', value: 500, service: boot.services.find((s) => !s.is_addon)?.id ?? 0, months: 12, date: '', partial: true, method: 'cash', received: '', note: '' });

/** Gift vouchers (owner). A voucher is created only after the money was received; its code is shown ONCE, here, right after creation. */
export function VouchersTab({ boot, toast }: { boot: AdminBoot; toast: (s: string) => void }) {
  const [items, setItems] = useState<VoucherRow[] | null>(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState<VoucherRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState<Form>(blank(boot));
  const [op, setOp] = useState(newOpId());
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<VoucherCreated | null>(null);
  const [confirmVoid, setConfirmVoid] = useState(false);

  const load = useCallback(async () => {
    const r = await api<{ enabled: boolean; items: VoucherRow[] }>('admin/vouchers/list');
    if (!r.ok) { setErr(true); return; }
    setErr(false); setItems(r.data.items);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const worth = f.kind === 'value' ? f.value : (boot.services.find((s) => s.id === f.service)?.price ?? 0);
  const what = (v: VoucherRow): string => (v.kind === 'service' ? `${v.service ?? ''}` : money(v.value));
  const status = (v: VoucherRow): string => t(`vch.s_${v.status}`);

  async function create() {
    if (busy) return;
    if (f.kind === 'value' && f.value < 100) { haptic.error(); toast(t('vch.min')); return; }
    setBusy(true);
    const body: Record<string, unknown> = { op, kind: f.kind, partial: f.partial, method: f.method, received: f.received === '' ? worth : num(f.received), note: f.note.trim() };
    if (f.kind === 'value') body.value = f.value; else body.service = f.service;
    if (f.date) body.date = f.date; else body.months = f.months;
    const r = await api<VoucherCreated>('admin/vouchers/create', body);
    setBusy(false);
    if (!r.ok) { haptic.error(); toast(t(r.error.code === 'bad_request' ? 'adm.bad_input' : 'err.network')); return; }
    haptic.success(); setCreating(false); setCreated(r.data); setOp(newOpId()); setF(blank(boot)); await load();
  }

  async function act(route: 'extend' | 'void', body: Record<string, unknown>) {
    if (!open || busy) return;
    setBusy(true);
    const r = await api<{ ok: boolean; voucher: VoucherRow }>(`admin/vouchers/${route}`, { id: open.id, ...body }, newOpId());
    setBusy(false);
    if (!r.ok || !r.data.ok) { haptic.error(); toast(t('vch.cannot')); return; }
    haptic.success(); setOpen(r.data.voucher); setConfirmVoid(false); await load();
  }

  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast(t('vch.copied')); } catch { toast(text); } };
  const share = (c: VoucherCreated) => openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(c.link ?? '')}&text=${encodeURIComponent(c.link ? t('vch.share_text') : `${t('vch.share_text')} ${c.code ?? ''}`)}`);

  if (err) return <div class="page"><div class="note">{t('err.network')}</div><Button onClick={() => void load()}>{t('btn.retry')}</Button></div>;
  if (!items) return <div class="page"><Skeleton lines={5} /></div>;
  return (
    <div class="page">
      <h1 class="large">{t('adm.tab_vouchers')}</h1>
      <Section footer={t('vch.note')}>
        <Cell title={t('vch.new')} icon="plus" chevron onClick={() => { setF(blank(boot)); setCreating(true); }} />
      </Section>
      {items.length === 0 ? <div class="note" data-testid="vch-empty">{t('vch.none')}</div> : (
        <Section>
          {items.map((v) => (
            <Cell key={v.id} title={`…${v.hint} · ${what(v)}`} subtitle={`${status(v)} · ${t('vch.until', { d: dateOf(v.expires_at) })}`} after={v.kind === 'value' ? money(v.balance) : undefined} chevron onClick={() => { setConfirmVoid(false); setOpen(v); }} />
          ))}
        </Section>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title={t('vch.new')}>
        <Segmented options={[{ value: 'value', label: t('vch.k_value') }, { value: 'service', label: t('vch.k_service') }]} value={f.kind} onChange={(v) => setF({ ...f, kind: v })} />
        {f.kind === 'value'
          ? <label class="field"><span>{t('vch.amount')}</span><input type="number" inputMode="numeric" min={100} step={50} value={f.value} onInput={(e) => setF({ ...f, value: num((e.target as HTMLInputElement).value) })} /></label>
          : <label class="field"><span>{t('vch.service')}</span>
              <select value={f.service} onChange={(e) => setF({ ...f, service: Number((e.target as HTMLSelectElement).value) })}>
                {boot.services.filter((s) => !s.is_addon).map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}
              </select></label>}
        <label class="field"><span>{t('vch.valid')}</span>
          <select value={f.date ? 'date' : String(f.months)} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; v === 'date' ? setF({ ...f, date: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10) }) : setF({ ...f, date: '', months: Number(v) }); }}>
            {[6, 12, 24].map((m) => <option value={m} key={m}>{t('vch.months', { n: m })}</option>)}
            <option value="date">{t('vch.pick_date')}</option>
          </select>
          {f.date && <input type="date" value={f.date} onInput={(e) => setF({ ...f, date: (e.target as HTMLInputElement).value })} />}
        </label>
        {f.kind === 'value' && <Section footer={t('vch.partial_hint')}><Cell title={t('vch.partial')} after={<Switch label={t('vch.partial')} checked={f.partial} onChange={(v) => setF({ ...f, partial: v })} />} /></Section>}
        <label class="field"><span>{t('vch.method')}</span>
          <select value={f.method} onChange={(e) => setF({ ...f, method: (e.target as HTMLSelectElement).value as Form['method'] })}>
            <option value="cash">{t('vch.m_cash')}</option><option value="transfer">{t('vch.m_transfer')}</option><option value="other">{t('vch.m_other')}</option>
          </select></label>
        <label class="field"><span>{t('vch.received')}</span><input type="number" inputMode="numeric" min={0} placeholder={String(worth)} value={f.received} onInput={(e) => setF({ ...f, received: (e.target as HTMLInputElement).value })} /></label>
        <label class="field"><span>{t('vch.note_label')}</span><input maxLength={200} value={f.note} onInput={(e) => setF({ ...f, note: (e.target as HTMLInputElement).value })} /></label>
        <Button onClick={() => void create()} disabled={busy}>{busy ? '…' : t('vch.create')}</Button>
      </Sheet>

      <Sheet open={created !== null} onClose={() => setCreated(null)} title={t('vch.created')}>
        {created && (created.replayed
          ? <div class="note">{t('vch.replayed')}</div>
          : <>
              <div class="note">{t('vch.once')}</div>
              <div class="vch-code" data-testid="vch-code">{created.code}</div>
              {created.link ? <div class="note" data-testid="vch-link">{created.link}</div> : <div class="note">{t('vch.no_link')}</div>}
              <Button onClick={() => void copy(created.code ?? '')}>{t('vch.copy_code')}</Button>
              {created.link && <Button secondary onClick={() => void copy(created.link ?? '')}>{t('vch.copy_link')}</Button>}
              <Button secondary onClick={() => share(created)}>{t('vch.share')}</Button>
            </>)}
      </Sheet>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? `…${open.hint} · ${what(open)}` : ''}>
        {open && (
          <>
            <Section>
              <Cell title={t('vch.status')} after={status(open)} />
              {open.kind === 'value' && <Cell title={t('vch.balance')} after={`${money(open.balance)} · ${t('vch.reserved', { n: money(open.reserved) || '0' })}`} />}
              <Cell title={t('vch.valid')} after={`${dateOf(open.expires_at)}${open.extended ? ' (+)' : ''}`} />
              <Cell title={t('vch.sold')} subtitle={`${t('vch.m_' + open.method)} · ${t('vch.paid_received', { p: money(open.paid) || '0', r: money(open.received) || '0' })}`} after={dateOf(open.sold_at)} />
              <Cell title={open.kind === 'service' ? t('vch.single_service') : open.partial ? t('vch.partial_on') : t('vch.partial_off')} />
              {open.note && <Cell title={open.note} />}
            </Section>
            {open.status !== 'void' && (
              <>
                <Button secondary onClick={() => void act('extend', { months: 3 })} disabled={busy}>{t('vch.ext3')}</Button>
                <Button secondary onClick={() => void act('extend', { months: 12 })} disabled={busy}>{t('vch.ext12')}</Button>
                <Button secondary onClick={() => (confirmVoid ? void act('void', {}) : setConfirmVoid(true))} disabled={busy}>{confirmVoid ? t('vch.void_confirm') : t('vch.void')}</Button>
              </>
            )}
          </>
        )}
      </Sheet>
    </div>
  );
}
