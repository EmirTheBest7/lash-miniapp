const P: Record<string, string> = {
  chevron: 'M9 6l6 6-6 6', back: 'M15 6l-6 6 6 6', check: 'M5 12.5l4.5 4.5L19 7.5', close: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14',
  calendar: 'M4 7h16v13H4zM8 3v4M16 3v4M4 11h16', user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c1-4 4-6 8-6s7 2 8 6', clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 7.5v.5', list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', settings: 'M12 15a3 3 0 100-6 3 3 0 000 6z',
  home: 'M4 11l8-7 8 7v9H4zM10 20v-6h4v6', scissors: 'M6 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM6 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM8 7l12 10M8 17L20 7', rules: 'M6 3h9l4 4v14H6zM9 12h7M9 16h7', heart: 'M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.500-7 10-7 10z',
  mail: 'M3 6h18v12H3zM3 7l9 7 9-7', gift: 'M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-3 0-4-4-1-4 2 0 1 4 1 4zm0 0c3 0 4-4 1-4-2 0-1 4-1 4z', team: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c.5-3.500 3-5 6-5s5.500 1.500 6 5M17 10a2.500 2.500 0 100-5M17 15c2.500.300 4 1.800 4.500 5', help: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.500 9.500a2.500 2.500 0 114 2c-.800.600-1.500 1-1.500 2M12 17v.5', system: 'M5 7h14M5 12h14M5 17h14M9 5v4M15 10v4M8 15v4',
};
export type IconName = keyof typeof P;
export function Icon({ name, class: cls = '' }: { name: IconName; class?: string }) {
  return <svg class={`icon ${cls}`} viewBox="0 0 24 24" aria-hidden="true"><path d={P[name]} /></svg>;
}
