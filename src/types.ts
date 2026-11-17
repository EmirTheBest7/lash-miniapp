export type Role = 'client' | 'master' | 'owner';
export type LangCode = 'cs' | 'en' | 'ru' | 'uk';
export interface Me { id: number; name: string; username: string | null; role: Role; lang: LangCode; phone_set: boolean; privacy_accepted: boolean }
export interface Config { tz: string; studio_name: string; currency: string; min_client_version: number; contact_username: string | null; server_time: number }
export interface Service { id: number; name: string; description: string; duration_min: number; price: number; price_from: boolean }
export interface Category { id: number; name: string; services: Service[] }
export interface Addon { id: number; name: string; duration_min: number; price: number }
export type ApptStatus = 'pending' | 'pending_deposit' | 'confirmed';
export interface Staff { id: number; name: string; bio: string; color: string }
export interface Appt { id: number; rev: number; service_id: number; service: string; staff_id: number; staff: string | null; start: number; date: string; time: string; duration_min: number; status: ApptStatus; decide_by: string | null; can_change: boolean }
export interface StripDay { date: string; status: 'free' | 'full' | 'closed'; free: number }
export interface Slot { start: number; date: string; time: string; adjacent?: boolean }
export interface Quote { duration_min: number; price: number; price_from: boolean; warnings: string[]; will_wait: boolean; cancel_cutoff_h: number }
export interface Availability { strip: StripDay[]; first: { date: string; slots: Slot[] } | null; quote: Quote; staff: Staff[] }
export interface Bootstrap {
  me: Me; config: Config; start_param: string | null;
  categories: Category[]; addons: Addon[]; my: Appt[];
  again: { service_id: number; suggest: string } | null;
  policy: { cancel_cutoff_h: number; horizon_days: number };
  privacy: { title: string; text: string };
  marketing: boolean;
  loyalty: { visits: number; percent: number; progress: number; ready: number | null; pending: boolean } | null;
}
export type Outcome = 'ok' | 'idempotent' | 'slot_taken' | 'needs_gate' | 'too_late' | 'not_active' | 'illegal_state';
export interface AptRow { id: number; rev: number; start: number; date: string; time: string; status: string; service: string; staff_id: number; staff: string | null; decide_by: string | null }
export interface BookData { outcome: Outcome; appointment?: AptRow; alternatives?: Slot[]; needs?: { privacy: boolean; phone: boolean }; warnings?: string[]; reason?: string; my?: Appt[] }
