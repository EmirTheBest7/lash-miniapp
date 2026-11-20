import { api, newOpId } from '../api';
import { t } from '../i18n';
import type { Ctx } from '../nav';
import { openTelegramLink } from '../tg';

/** "Message the master": in the "direct" contact mode a t.me link, otherwise (default) a note through the bot: her username is never in the app. */
export async function writeMaster(ctx: Ctx): Promise<void> {
  const u = ctx.boot.config.contact_username;
  if (u) { openTelegramLink(`https://t.me/${u}`); return; }
  const r = await api<{ sent: boolean }>('contact', {}, newOpId());
  ctx.toast(t(!r.ok ? 'err.generic' : r.data.sent ? 'home.master_told' : 'home.master_told_again'));
}
