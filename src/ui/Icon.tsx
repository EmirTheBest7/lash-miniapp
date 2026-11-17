const P: Record<string, string> = {
  chevron: 'M9 6l6 6-6 6', back: 'M15 6l-6 6 6 6', check: 'M5 12.5l4.5 4.5L19 7.5', close: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14',
  calendar: 'M4 7h16v13H4zM8 3v4M16 3v4M4 11h16', user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c1-4 4-6 8-6s7 2 8 6', clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 7.5v.5', list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', settings: 'M12 15a3 3 0 100-6 3 3 0 000 6z',
};
export type IconName = keyof typeof P;
export function Icon({ name, class: cls = '' }: { name: IconName; class?: string }) {
  return <svg class={`icon ${cls}`} viewBox="0 0 24 24" aria-hidden="true"><path d={P[name]} /></svg>;
}
