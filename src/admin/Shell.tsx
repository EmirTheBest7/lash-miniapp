import type { ComponentChildren } from 'preact';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';

/** A Settings category screen: "‹ Settings", a title, and the content. */
export function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: ComponentChildren }) {
  return (
    <div class="page">
      <div class="back-row"><button onClick={onBack} aria-label={t('adm.s_back')}><Icon name="back" />{t('adm.tab_settings')}</button></div>
      <h1 class="large">{title}</h1>
      {children}
    </div>
  );
}

/** A text field with its inline validation message underneath (red), set from the server's `message` (the field name) on a 400. */
export function FieldErr({ show, text }: { show: boolean; text: string }) {
  return show ? <div class="field-err" role="alert">{text}</div> : null;
}
