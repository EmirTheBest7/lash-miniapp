import { LangTabs } from './LangTabs';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { money } from '../format';
import { getLang, t } from '../i18n';
import { haptic, openTelegramLink } from '../tg';
import { Button, Cell, Section, Segmented, Sheet, Skeleton, Switch } from '../ui/components';
import type { AdminBoot, VoucherCreated, VoucherRow, VoucherSettings } from './types';

const LOCALE: Record<string, string> = { cs: 'cs-CZ', en: 'en-GB', ru: 'ru-RU', uk: 'uk-UA' };
/** A date WITH the year: a voucher that expires is no place for a guess. */
const dateOf = (ts: number): string => new Intl.DateTimeFormat(LOCALE[getLang()] ?? 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Prague' }).format(new Date(ts * 1000));
/** The printable card (PNG): studio, what the voucher is, expiry, the QR, only the LAST 4 characters of the code as text. Drawn on a canvas so every language and font works. */
async function cardPng(opts: { studio: string; title: string; what: string; until: string; hint: string; scan: string; qr: string }): Promise<Blob | null> {
  const img = new Image();
  img.src = opts.qr;
  try { await img.decode(); } catch { return null; }
  const W = 900, H = 1200, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#222'; g.lineWidth = 6; g.strokeRect(30, 30, W - 60, H - 60);
  g.fillStyle = '#111'; g.textAlign = 'center';
  const fit = (text: string, size: number, y: number, weight = 600) => { let s = size; g.font = `${weight} ${s}px system-ui, sans-serif`; while (g.measureText(text).width > W - 160 && s > 18) { s -= 2; g.font = `${weight} ${s}px system-ui, sans-serif`; } g.fillText(text, W / 2, y); };
  fit(opts.studio, 54, 140); fit(opts.title, 40, 215, 400); fit(opts.what, 76, 335);
  fit(opts.until, 38, 410, 400);
  g.imageSmoothingEnabled = false;
  g.drawImage(img, (W - 560) / 2, 460, 560, 560);
  fit(opts.scan, 30, 1070, 400);
  g.font = '600 44px ui-monospace, Menlo, monospace'; g.fillText(opts.hint, W / 2, 1135);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}
const toBase64 = (blob: Blob): Promise<string> => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
const saveBlob = (blob: Blob, name: string): void => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const num = (v: string): number => Math.max(0, Math.round(Number(v) || 0));

type Form = { kind: 'value' | 'service'; value: number; service: number; months: number; date: string; partial: boolean; method: 'cash' | 'transfer' | 'other'; received: string; note: string };
const blank = (boot: AdminBoot, d?: VoucherSettings): Form => ({ kind: 'value', value: Math.max(500, d?.min ?? 0), service: boot.services.find((s) => !s.is_addon)?.id ?? 0, months: d?.months ?? 12, date: '', partial: d?.partial ?? true, method: 'cash', received: '', note: '' });

/** Gift vouchers (owner). A voucher is created only after the money was received; its code is shown ONCE, here, right after creation. */
export function VouchersTab({ boot, toast }: { boot: AdminBoot; toast: (s: string) => void }) {
  const [items, setItems] = useState<VoucherRow[] | null>(null);
  const [defs, setDefs] = useState<VoucherSettings | null>(null);
  const [editDefs, setEditDefs] = useState<VoucherSettings | null>(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState<VoucherRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState<Form>(blank(boot));
  const [op, setOp] = useState(newOpId());
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<VoucherCreated | null>(null);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [confirmReissue, setConfirmReissue] = useState(false);

  const load = useCallback(async () => {
    const r = await api<{ enabled: boolean; settings: VoucherSettings; items: VoucherRow[] }>('admin/vouchers/list');
    if (!r.ok) { setErr(true); return; }
    setErr(false); setItems(r.data.items); setDefs(r.data.settings);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const worth = f.kind === 'value' ? f.value : (boot.services.find((s) => s.id === f.service)?.price ?? 0);
  const what = (v: VoucherRow): string => (v.kind === 'service' ? `${v.service ?? ''}` : money(v.value));
  const status = (v: VoucherRow): string => t(`vch.s_${v.status}`);

  async function create() {
    if (busy) return;
    const min = defs?.min ?? 100;
    if (f.kind === 'value' && f.value < min) { haptic.error(); toast(t('vch.min', { n: min })); return; }
    setBusy(true);
    const body: Record<string, unknown> = { op, kind: f.kind, partial: f.partial, method: f.method, received: f.received === '' ? worth : num(f.received), note: f.note.trim() };
    if (f.kind === 'value') body.value = f.value; else body.service = f.service;
    if (f.date) body.date = f.date; else body.months = f.months;
    const r = await api<VoucherCreated>('admin/vouchers/create', body);
    setBusy(false);
    if (!r.ok) { haptic.error(); toast(t(r.error.code === 'bad_request' ? 'adm.bad_input' : 'err.network')); return; }
    haptic.success(); setCreating(false); setCreated(r.data); setOp(newOpId()); setF(blank(boot, defs ?? undefined)); await load();
  }

  async function act(route: 'extend' | 'void', body: Record<string, unknown>) {
    if (!open || busy) return;
    setBusy(true);
    const r = await api<{ ok: boolean; voucher: VoucherRow }>(`admin/vouchers/${route}`, { id: open.id, ...body }, newOpId());
    setBusy(false);
    if (!r.ok || !r.data.ok) { haptic.error(); toast(t('vch.cannot')); return; }
    haptic.success(); setOpen(r.data.voucher); setConfirmVoid(false); await load();
  }

  const [card, setCard] = useState<string | null>(null);
  const downloadQr = (c: VoucherCreated) => { if (!c.qr) return; const a = document.createElement('a'); a.href = c.qr; a.download = 'voucher-qr.png'; document.body.appendChild(a); a.click(); a.remove(); toast(t('vch.saved_hint')); };
  const renderCard = (c: VoucherCreated): Promise<Blob | null> => {
    const v = c.voucher;
    return cardPng({ studio: boot.config.studio_name, title: t('vch.card_title'), what: v.kind === 'service' ? (v.service ?? '') : money(v.value), until: t('vch.valid') + ' ' + dateOf(v.expires_at), hint: `••••-${v.hint}`, scan: t('vch.card_scan'), qr: c.qr ?? '' });
  };
  const downloadCard = async (c: VoucherCreated) => {
    if (!c.qr) return;
    const blob = await renderCard(c);
    if (!blob) { toast(t('err.network')); return; }
    setCard(URL.createObjectURL(blob)); saveBlob(blob, 'voucher-card.png'); toast(t('vch.saved_hint'));
  };
  /** The rendered card goes to the owner's own chat (a CORS simple request: the PNG travels as base64 in the text/plain JSON body; the server caps it at 1 MiB and checks it). */
  const sendCard = async (c: VoucherCreated) => {
    if (!c.qr || busy) return;
    setBusy(true);
    const blob = await renderCard(c);
    if (!blob) { setBusy(false); toast(t('err.network')); return; }
    if (blob.size > 1_000_000) { setBusy(false); haptic.error(); toast(t('vch.too_big')); return; }
    const r = await api<{ sent: boolean }>('admin/vouchers/send-card', { id: c.voucher.id, png: await toBase64(blob) }, newOpId());
    setBusy(false);
    if (!r.ok) { haptic.error(); toast(t(r.error.code === 'too_large' ? 'vch.too_big' : 'err.network')); return; }
    haptic.success(); toast(t('vch.card_sent'));
  };
  const reissue = async () => {
    if (!open || busy) return;
    setBusy(true);
    const r = await api<VoucherCreated>('admin/vouchers/reissue', { op: newOpId(), id: open.id });
    setBusy(false);
    if (!r.ok) { haptic.error(); toast(t(r.error.code === 'voucher_reserved' ? 'vch.reissue_reserved' : 'vch.cannot')); setConfirmReissue(false); return; }
    haptic.success(); setOpen(null); setConfirmReissue(false); setCreated(r.data); await load();
  };
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast(t('vch.copied')); } catch { toast(text); } };
  const share = (c: VoucherCreated) => openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(c.link ?? '')}&text=${encodeURIComponent(c.link ? t('vch.share_text') : `${t('vch.share_text')} ${c.code ?? ''}`)}`);

  if (err) return <div class="page"><div class="note">{t('err.network')}</div><Button onClick={() => void load()}>{t('btn.retry')}</Button></div>;
  if (!items) return <div class="page"><Skeleton lines={5} /></div>;
  return (
    <div class="page">
      <h1 class="large">{t('adm.tab_vouchers')}</h1>
      <Section footer={t('vch.note')}>
        <Cell title={t('vch.new')} icon="plus" chevron onClick={() => { setF(blank(boot, defs ?? undefined)); setCreating(true); }} />
        <Cell title={t('vch.defaults')} chevron onClick={() => setEditDefs(defs ? JSON.parse(JSON.stringify(defs)) : null)} />
      </Section>
      {items.length === 0 ? <div class="note" data-testid="vch-empty">{t('vch.none')}</div> : (
        <Section>
          {items.map((v) => (
            <Cell key={v.id} title={`…${v.hint} · ${what(v)}`} subtitle={`${status(v)} · ${t('vch.until', { d: dateOf(v.expires_at) })}`} after={v.kind === 'value' ? money(v.balance) : undefined} chevron onClick={() => { setConfirmVoid(false); setConfirmReissue(false); setOpen(v); }} />
          ))}
        </Section>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title={t('vch.new')}>
        <Segmented options={[{ value: 'value', label: t('vch.k_value') }, { value: 'service', label: t('vch.k_service') }]} value={f.kind} onChange={(v) => setF({ ...f, kind: v })} />
        {f.kind === 'value'
          ? <label class="field"><span>{t('vch.amount', { n: defs?.min ?? 100 })}</span><input type="number" inputMode="numeric" min={defs?.min ?? 100} step={50} value={f.value} onInput={(e) => setF({ ...f, value: num((e.target as HTMLInputElement).value) })} /></label>
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

      <Sheet open={editDefs !== null} onClose={() => setEditDefs(null)} title={t('vch.defaults')}>
        {editDefs && (
          <>
            <label class="field"><span>{t('vch.def_months')}</span><input type="number" inputMode="numeric" min={1} max={60} value={editDefs.months} onInput={(e) => setEditDefs({ ...editDefs, months: Math.min(60, Math.max(1, num((e.target as HTMLInputElement).value))) })} /></label>
            <label class="field"><span>{t('vch.def_min')}</span><input type="number" inputMode="numeric" min={1} value={editDefs.min} onInput={(e) => setEditDefs({ ...editDefs, min: Math.max(1, num((e.target as HTMLInputElement).value)) })} /></label>
            <Section footer={t('vch.partial_hint')}><Cell title={t('vch.partial')} after={<Switch label={t('vch.partial')} checked={editDefs.partial} onChange={(v) => setEditDefs({ ...editDefs, partial: v })} />} /></Section>
            <Section footer={t('vch.terms_hint')}>
              <LangTabs label={t('vch.terms')} values={editDefs.terms} rows={3} max={600} canTranslate={!!boot.can_translate} toast={toast}
                onChange={(l, v) => setEditDefs((d) => (d ? { ...d, terms: { ...d.terms, [l]: v } } : d))} />
            </Section>
            <Button disabled={busy} onClick={async () => {
              setBusy(true);
              const r = await api<{ settings: VoucherSettings }>('admin/vouchers/settings', { ...editDefs }, newOpId());
              setBusy(false);
              if (!r.ok) { haptic.error(); toast(t('adm.bad_input')); return; }
              haptic.success(); toast(t('adm.saved')); setDefs(r.data.settings); setEditDefs(null);
            }}>{busy ? '…' : t('adm.save')}</Button>
          </>
        )}
      </Sheet>

      <Sheet open={created !== null} onClose={() => { setCreated(null); setCard(null); }} title={t('vch.created')}>
        {created && (created.replayed
          ? <div class="note">{t('vch.replayed')}</div>
          : <>
              <div class="note">{t('vch.once')}</div>
              <div class="vch-code" data-testid="vch-code">{created.code}</div>
              {created.qr && <img class="vch-qr" data-testid="vch-qr" alt="QR" src={created.qr} />}
              {created.link ? <div class="note" data-testid="vch-link">{created.link}</div> : <div class="note">{t('vch.no_link')}</div>}
              <Button onClick={() => void copy(created.code ?? '')}>{t('vch.copy_code')}</Button>
              {created.link && <Button secondary onClick={() => void copy(created.link ?? '')}>{t('vch.copy_link')}</Button>}
              <Button secondary onClick={() => share(created)}>{t('vch.share')}</Button>
              {created.qr && <Button secondary onClick={() => downloadQr(created)}>{t('vch.dl_qr')}</Button>}
              {created.qr && <Button secondary onClick={() => void downloadCard(created)}>{t('vch.dl_card')}</Button>}
              {created.qr && <Button secondary onClick={() => void sendCard(created)} disabled={busy}>{t('vch.send_card')}</Button>}
              <div class="note">{t('vch.in_chat')}</div>
              {card && <img class="vch-qr" data-testid="vch-card" alt="" src={card} />}
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
                <Button secondary onClick={() => (confirmReissue ? void reissue() : setConfirmReissue(true))} disabled={busy}>{confirmReissue ? t('vch.reissue_confirm') : t('vch.reissue')}</Button>
                <Button secondary onClick={() => (confirmVoid ? void act('void', {}) : setConfirmVoid(true))} disabled={busy}>{confirmVoid ? t('vch.void_confirm') : t('vch.void')}</Button>
              </>
            )}
          </>
        )}
      </Sheet>
    </div>
  );
}
