import type { Appt, Bootstrap, Quote, Slot, Staff } from './types';

export type Screen =
  | { k: 'home' }
  | { k: 'pick'; service: number; addons: number[]; move?: Appt; prefer?: string }
  | { k: 'summary'; service: number; addons: number[]; slot: Slot; quote: Quote | null; move?: Appt; staff?: Staff }
  | { k: 'done'; kind: 'confirmed' | 'pending' | 'moved'; when: { date: string; time: string }; service: string; staff: string | null; decideBy: string | null }
  | { k: 'appts' };

export interface Ctx {
  boot: Bootstrap;
  push(s: Screen): void;
  pop(): void;
  replace(s: Screen): void;
  home(): void;
  toast(text: string): void;
  setMy(my: Appt[]): void;
  reload(): Promise<void>;
  /** Staff only: leave the client view and return to the admin app. */
  exitClientView?(): void;
}
