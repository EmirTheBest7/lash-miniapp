export interface StaffRow { id: number; name: string; bio: string; color: string; active: boolean; linked: boolean; tg_id: number | null; mine: boolean; admin: boolean; off: number[]; weekly: Record<string, [string, string][]>; future: number }
export interface SvcRow { id: number; name: string; is_addon: boolean; duration_min: number; buffer_min: number; price: number; price_from: boolean; active: boolean; names: Record<'cs' | 'en' | 'ru' | 'uk', string>; category_id: number | null }
export interface AdminSettings { slot_step_min: number; min_notice_h: number; horizon_days: number; cancel_cutoff_h: number; buffer_may_exceed_close: boolean }
export interface AdminBoot {
  me: { id: number; name: string; role: 'master' | 'owner'; lang: string };
  config: { tz: string; studio_name: string; server_time: number; today: string };
  staff: StaffRow[]; services: SvcRow[]; categories: { id: number; name: string }[]; settings: AdminSettings; can_manage: boolean;
}
export type AdmStatus = 'pending' | 'pending_deposit' | 'confirmed' | 'completed' | 'no_show';
export interface AdmAppt {
  id: number; rev: number; staff_id: number; status: AdmStatus; start: number; end: number; buffer_min: number; service_id: number; service: string; addons: string[];
  price: number; auto: boolean; by: string; client: { id: number; name: string; phone: string | null; username: string | null; tg: boolean };
}
export interface Block { id: number; staff_id: number; start: number; end: number; reason: string }
export interface Override { staff_id: number; date: string; closed: boolean; intervals: [string, string][]; note: string }
export interface CalData { from: string; days: number; appointments: AdmAppt[]; work: Record<string, Record<string, [number, number][]>>; blocks: Block[]; overrides: Override[] }
export interface ClientHit { id: number; name: string; phone: string | null; username: string | null; tg: boolean }
export type MoveData = { outcome: string; appointment?: AdmAppt; alternatives?: { start: number; time: string; date: string }[]; reason?: string };
