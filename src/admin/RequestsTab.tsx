import { useCallback, useEffect, useState } from 'preact/hooks';
import { api, newOpId } from '../api';
import { t } from '../i18n';
import { haptic } from '../tg';
import { Button, Cell, Empty, Section, Sheet, Skeleton } from '../ui/components';
import type { RequestRow } from './types';

/** Open requests to the master (V forwarded them, or the client wrote through the menu): answer through the bot, open the chat, mark done. Same actions as the note in the bot chat. */
export function RequestsTab({ toast, onCount }: { toast: (s: string) => void; onCount: (n: number) => void }) {
  const [items, setItems] = useState<RequestRow[] | null>(null);
  const [reply, setReply] = useState<RequestRow | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await api<{ items: RequestRow[] }>('admin/requests');
    if (r.ok) { setItems(r.data.items); onCount(r.data.items.length); }
  }, [onCount]);
  useEffect(() => { void load(); }, [load]);

  async function send() {
    if (!reply || !text.trim() || busy) return;
    setBusy(true);
    const r = await api('admin/requests/reply', { id: reply.id, text: text.trim() }, newOpId());
    setBusy(false);
    if (!r.ok) { haptic.error(); toast(t('adm.rq_failed')); return; }
    haptic.success(); toast(t('adm.rq_sent')); setReply(null); setText(''); await load();
  }
  async function done(id: number) {
    const r = await api('admin/requests/done', { id }, newOpId());
    if (r.ok) { haptic.success(); toast(t('adm.rq_done_toast')); await load(); }
  }

  if (!items) return <div class="page"><Skeleton lines={4} /></div>;
  return (
    <div class="page">
      <h1 class="large">{t('adm.rq_title')}</h1>
      {items.length === 0 && <Empty title={t('adm.rq_empty')} icon="info" />}
      {items.map((r) => (
        <Section key={r.id} title={`${r.name} · ${r.lang.toUpperCase()}`} footer={r.phone ?? undefined}>
          <Cell title={t(`adm.rq_r_${r.reason}`)} subtitle={r.messages.map((m) => `• ${m}`).join('\n')} />
          <div class="rq-actions" data-testid={`rq-${r.id}`}>
            <Button onClick={() => { setReply(r); setText(''); }}>{t('adm.rq_reply')}</Button>
            {r.chat_id !== null && <a class="btn secondary" href={`tg://user?id=${r.chat_id}`}>{t('adm.rq_open')}</a>}
            <Button secondary onClick={() => void done(r.id)}>{t('adm.rq_done')}</Button>
          </div>
        </Section>
      ))}
      <Sheet open={reply !== null} onClose={() => setReply(null)} title={reply ? `${t('adm.rq_reply')}: ${reply.name}` : ''}>
        <label class="field"><span>{t('adm.rq_note')}</span><textarea rows={4} maxLength={3000} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder={t('adm.rq_placeholder')} /></label>
        <Button onClick={() => void send()} disabled={busy || !text.trim()}>{busy ? '…' : t('adm.rq_send')}</Button>
      </Sheet>
    </div>
  );
}
