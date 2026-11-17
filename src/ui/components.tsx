import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { bindMain, haptic, webApp } from '../tg';
import { Icon, type IconName } from './Icon';

export function Section({ title, footer, children }: { title?: string; footer?: string; children: ComponentChildren }) {
  return (
    <section class="section">
      {title && <div class="sec-title">{title}</div>}
      <div class="sec-body">{children}</div>
      {footer && <div class="sec-foot">{footer}</div>}
    </section>
  );
}

export function Cell(p: { title: string; subtitle?: string; after?: ComponentChildren; icon?: IconName; chevron?: boolean; selected?: boolean; destructive?: boolean; onClick?: () => void }) {
  const inner = (
    <>
      {p.icon && <span class="c-icon"><Icon name={p.icon} /></span>}
      <span class="c-main">
        <div class="c-title">{p.title}</div>
        {p.subtitle && <div class="c-sub">{p.subtitle}</div>}
      </span>
      {(p.after || p.chevron) && <span class="c-after">{p.after}{p.chevron && <Icon name="chevron" class="chev" />}</span>}
    </>
  );
  const cls = `cell${p.icon ? ' has-icon' : ''}${p.selected ? ' selected' : ''}${p.destructive ? ' destructive' : ''}`;
  return p.onClick ? <button class={cls} onClick={() => { haptic.select(); p.onClick!(); }}>{inner}</button> : <div class={cls}>{inner}</div>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button class="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => { haptic.select(); onChange(!checked); }} />;
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div class="segmented" role="tablist">
      {options.map((o) => <button role="tab" aria-selected={o.value === value} onClick={() => { haptic.select(); onChange(o.value); }}>{o.label}</button>)}
    </div>
  );
}

export function Chip(p: { label: string; sub?: string; selected?: boolean; disabled?: boolean; struck?: boolean; onClick?: () => void }) {
  return (
    <button class={`chip${p.struck ? ' struck' : ''}`} aria-pressed={!!p.selected} disabled={p.disabled} onClick={() => { haptic.select(); p.onClick?.(); }}>
      {p.label}{p.sub && <span class="chip-sub">{p.sub}</span>}
    </button>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ComponentChildren }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <>
      <div class={`sheet-back${open ? ' open' : ''}`} onClick={onClose} />
      <div class={`sheet${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open}>
        <div class="grab" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </>
  );
}

export function Toast({ text }: { text: string | null }) {
  return text ? <div class="toast" role="status">{text}</div> : null;
}

export function Avatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((s) => s[0] ?? '').join('').toUpperCase() || '?';
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return <span class="avatar" style={{ background: `hsl(${h} 45% 48%)` }} aria-hidden="true">{initials}</span>;
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div aria-busy="true">{Array.from({ length: lines }, (_, i) => <div class="skel" style={{ width: `${88 - ((i * 17) % 40)}%` }} />)}</div>;
}

export function Empty({ title, text, icon = 'info', action }: { title: string; text?: string; icon?: IconName; action?: ComponentChildren }) {
  return <div class="empty"><Icon name={icon} /><h3>{title}</h3>{text && <div>{text}</div>}{action}</div>;
}

export function Button({ children, onClick, secondary, disabled }: { children: ComponentChildren; onClick: () => void; secondary?: boolean; disabled?: boolean }) {
  return <button class={`btn${secondary ? ' secondary' : ''}`} disabled={disabled} onClick={() => { haptic.tap(); onClick(); }}>{children}</button>;
}

/** The primary action: Telegram's NATIVE bottom button when present; a themed bar only in a plain browser (dev, tests). */
export function MainAction({ text, onClick, enabled = true, busy = false, hidden = false }: { text: string; onClick: () => void; enabled?: boolean; busy?: boolean; hidden?: boolean }) {
  const native = !!webApp()?.MainButton;
  // Hidden while an informational sheet is open (the bar would cover the sheet's bottom actions, natively and in a browser).
  useEffect(() => (native && !hidden ? bindMain({ text, onClick, enabled, busy }) : undefined), [native, hidden, text, onClick, enabled, busy]);
  return native || hidden ? null : <div class="fallback-bar"><Button onClick={onClick} disabled={!enabled || busy}>{busy ? '…' : text}</Button></div>;
}
