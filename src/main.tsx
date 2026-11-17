import { render } from 'preact';
import { App } from './app';
import { ensureFresh } from './version';
import { applyTheme, watchTheme } from './theme';
import { readyAndExpand, webApp } from './tg';
import './ui/ui.css';

async function start(): Promise<void> {
  const q = new URLSearchParams(location.search);
  const wantMock = !webApp() && (import.meta.env.DEV || import.meta.env.VITE_MOCK === '1');
  if (wantMock) {
    const m = await import('./dev/mock');
    m.installMockTelegram();
    if (q.has('mock')) m.installMockApi();
  }
  readyAndExpand();
  applyTheme();
  watchTheme();
  void ensureFresh(__BUILD_ID__, import.meta.env.BASE_URL);
  const root = document.getElementById('app')!;
  if ((import.meta.env.DEV || import.meta.env.VITE_GALLERY === '1') && q.has('gallery')) {
    const { Gallery } = await import('./screens/Gallery');
    render(<Gallery />, root);
  } else {
    render(<App />, root);
  }
}
void start();
