import { describe, expect, it } from 'vitest';
import { DARK, LIGHT, themeVars } from '../src/theme';

describe('theme: every colour is a Telegram themeParam with a Telegram-default fallback', () => {
  it('uses themeParams when present', () => {
    const v = themeVars({ bg_color: '#112233', button_color: '#445566', destructive_text_color: '#ff0000' }, 'light');
    expect(v['--tg-bg']).toBe('#112233');
    expect(v['--tg-button']).toBe('#445566');
    expect(v['--tg-destructive']).toBe('#ff0000');
  });
  it('falls back to Telegram\'s own light and dark defaults', () => {
    expect(themeVars({}, 'light')['--tg-bg']).toBe(LIGHT.bg_color);
    expect(themeVars({}, 'dark')['--tg-bg']).toBe(DARK.bg_color);
    expect(themeVars({}, 'dark')['--tg-secondary-bg']).toBe(DARK.secondary_bg_color);
  });
  it('defines every variable the stylesheet reads', async () => {
    const css = (await import('node:fs')).readFileSync('src/ui/ui.css', 'utf8');
    const used = new Set([...css.matchAll(/var\((--tg-[a-z-]+)/g)].map((m) => m[1]));
    const defined = new Set(Object.keys(themeVars({}, 'light')));
    for (const name of used) expect(defined.has(name!), `${name} is used in ui.css but never defined`).toBe(true);
  });
  it('has no hard-coded brand colours in the stylesheet outside neutral white/black/alpha', async () => {
    const css = (await import('node:fs')).readFileSync('src/ui/ui.css', 'utf8');
    const hex = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    for (const c of hex) expect(['#fff', '#ffffff'].includes(c), `unexpected colour ${c}`).toBe(true);
  });
});
