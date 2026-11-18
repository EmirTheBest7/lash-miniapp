export interface StaffRow { id: number; name: string; bio: string; color: string; active: boolean; linked: boolean; tg_id: number | null; mine: boolean; admin: boolean; off: number[]; weekly: Record<string, [string, string][]>; future: number }
export interface SvcRow { id: number; name: string; is_addon: boolean; duration_min: number; buffer_min: number; price: number; price_from: boolean; active: boolean; staff_only?: boolean; aftercare?: Record<'cs' | 'en' | 'ru' | 'uk', string>; rebook_after_days?: number | null; names: Record<'cs' | 'en' | 'ru' | 'uk', string>; category_id: number | null }
export interface AdminSettings extends SchedSettings { slot_step_min: number; min_notice_h: number; horizon_days: number; cancel_cutoff_h: number; buffer_may_exceed_close: boolean; loyalty_enabled: boolean; loyalty_visits: number; loyalty_percent: number }
export interface AdminBoot {
  me: { id: number; name: string; role: 'master' | 'owner'; lang: string };
  config: { tz: string; studio_name: string; server_time: number; today: string };
  staff: StaffRow[]; services: SvcRow[]; vouchers_on?: boolean; categories: { id: number; name: string }[]; loyalty_pending: { id: number; client: string; percent: number }[]; settings: AdminSettings; can_manage: boolean;
}
export interface LaunchItem { id: string; ok: boolean; required: boolean; where: string }
export interface StudioInfo {
  studio_name: string; address: string; lat: number; lon: number; contact_name: string; contact_username: string; instagram: string; portfolio_url: string;
  cancel_policy_cs: string; cancel_policy_en: string; cancel_policy_ru: string; cancel_policy_uk: string;
}
export interface LaunchData { items: LaunchItem[]; progress: { done: number; total: number }; studio: StudioInfo; can_manage: boolean }
export type VoucherStatus = 'active' | 'reserved' | 'used' | 'expired' | 'void';
export interface VoucherRow {
  id: number; kind: 'value' | 'service'; hint: string; status: VoucherStatus; service: string | null; value: number; balance: number; reserved: number; partial: boolean;
  expires_at: number; extended: boolean; sold_at: number; paid: number; method: 'cash' | 'transfer' | 'other'; received: number; note: string;
}
export interface VoucherSettings { months: number; partial: boolean; min: number; terms: Record<'cs' | 'en' | 'ru' | 'uk', string> }
export interface VoucherCreated { replayed: boolean; code?: string; link?: string | null; qr?: string; voucher: VoucherRow }
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

export interface SchedSettings {
  automation_on: boolean; waitlist_min_notice_h: number;
  rem1_on: boolean; rem1_h: number; rem1_auto: boolean; rem1_warn: boolean; rem2_on: boolean; rem2_h: number;
  rem_unanswered_on: boolean; rem_unanswered_h: number; agenda_on: boolean; agenda_time: string; agenda_empty: boolean;
  waitlist_on: boolean; waitlist_offer_h: number; backup_on: boolean; backup_time: string; backup_key: boolean; backup_last: number; ad_min_days: number;
  privacy_reviewed?: boolean; autocomplete_on: boolean; autocomplete_h: number; fill_nudge_on: boolean; google_review_url: string; review_delay_h: number; review_gap_days: number;
}
export interface BroadcastInfo { optin: number; clients: number; skipped?: number; min_days?: number; last: { text: string; recipients: number; at: number } | null }
