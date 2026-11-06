import type { RoleCode } from '@hospitalos/contracts';
import type { Href } from 'expo-router';

import type { IconName } from '@/components/Icon';
import type { Permission } from '@/features/access/permissions';
import type { Tone } from '@/theme/tokens';

/**
 * How each role's Home is arranged. Everything shown comes from GET /api/v1/dashboard (same-day
 * figures) or from the role's permissions. Nothing here invents a number: a summary part or a
 * chart appears only when every figure it needs was returned, and charts show either parts of a
 * real whole or an ordered pipeline from one moment, never a trend.
 */

export type MetricLike = Readonly<{ key: string; value: number; unit: 'count' | 'paise' }>;
type Figures = ReadonlyMap<string, MetricLike>;

/** Icon and tone for each figure the API can return. */
export const METRIC_STYLE: Readonly<Record<string, { icon: IconName; tone: Tone }>> = {
  appointments_today: { icon: 'calendar', tone: 'primary' },
  arrived_today: { icon: 'check', tone: 'success' },
  waiting_now: { icon: 'hourglass', tone: 'warning' },
  new_patients_today: { icon: 'person-add', tone: 'secondary' },
  my_appointments_today: { icon: 'calendar', tone: 'primary' },
  my_queue: { icon: 'people', tone: 'warning' },
  my_open_encounters: { icon: 'stethoscope', tone: 'secondary' },
  my_sessions_today: { icon: 'time', tone: 'primary' },
  my_patients_waiting: { icon: 'people', tone: 'warning' },
  rx_waiting: { icon: 'document', tone: 'warning' },
  dispensed_today: { icon: 'medkit', tone: 'success' },
  low_stock_items: { icon: 'cube', tone: 'danger' },
  expiring_batches: { icon: 'alarm', tone: 'warning' },
  samples_pending: { icon: 'barcode', tone: 'warning' },
  tests_in_process: { icon: 'flask', tone: 'primary' },
  awaiting_verification: { icon: 'shield', tone: 'secondary' },
  draft_invoices: { icon: 'document', tone: 'neutral' },
  collected_today: { icon: 'wallet', tone: 'success' },
  outstanding: { icon: 'receipt', tone: 'warning' },
  active_staff: { icon: 'people', tone: 'primary' },
  audit_events_today: { icon: 'shield', tone: 'secondary' },
};

export const TASK_ICON: Readonly<Record<string, IconName>> = {
  follow_ups_due: 'calendar-add',
  my_follow_ups: 'calendar-add',
  open_corrections: 'receipt',
};

export type QuickActionId =
  | 'register'
  | 'book'
  | 'queue'
  | 'search'
  | 'followups'
  | 'staff'
  | 'nurses'
  | 'invoices'
  | 'dispense'
  | 'worklist';

export type QuickAction = Readonly<{
  id: QuickActionId;
  label: string;
  hint: string;
  icon: IconName;
  href: Href;
  /** Shown when the person holds any of these. */
  anyOf: readonly Permission[];
}>;

export const QUICK_ACTIONS: Readonly<Record<QuickActionId, QuickAction>> = {
  register: {
    id: 'register',
    label: 'Register patient',
    hint: 'New MRN',
    icon: 'person-add',
    href: '/patients/register',
    anyOf: ['patient:create'],
  },
  book: {
    id: 'book',
    label: 'Book appointment',
    hint: 'Find the patient first',
    icon: 'calendar-add',
    href: '/search',
    anyOf: ['appointment:book'],
  },
  queue: {
    id: 'queue',
    label: 'Work queue',
    hint: 'Today, live',
    icon: 'queue',
    href: '/queue',
    // The roles that have a Work Queue section (see RoleQueues).
    anyOf: [
      'appointment:check_in',
      'encounter:write',
      'vitals:record',
      'prescription:dispense',
      'lab:process',
      'lab_result:verify',
      'invoice:read',
    ],
  },
  search: {
    id: 'search',
    label: 'Search patient',
    hint: 'MRN, phone, name',
    icon: 'search',
    href: '/search',
    anyOf: ['patient:read_demographics'],
  },
  followups: {
    id: 'followups',
    label: 'Follow-ups',
    hint: 'Due and overdue',
    icon: 'alarm',
    href: '/follow-ups',
    anyOf: ['followup:schedule'],
  },
  staff: {
    id: 'staff',
    label: 'Staff accounts',
    hint: 'Create and manage',
    icon: 'people',
    href: '/admin/staff',
    anyOf: ['user:create', 'user:manage', 'user_role:assign'],
  },
  nurses: {
    id: 'nurses',
    label: 'Nurse sessions',
    hint: 'Assign to doctors',
    icon: 'clipboard',
    href: '/admin/nurse-assignments',
    anyOf: ['nurse_assignment:manage'],
  },
  invoices: {
    id: 'invoices',
    label: 'Invoices',
    hint: 'Issue and collect',
    icon: 'receipt',
    href: '/queue',
    anyOf: ['invoice:read'],
  },
  dispense: {
    id: 'dispense',
    label: 'Dispense',
    hint: 'Prescription queue',
    icon: 'medkit',
    href: '/queue',
    anyOf: ['prescription:dispense'],
  },
  worklist: {
    id: 'worklist',
    label: 'Lab worklist',
    hint: 'Collect, enter, verify',
    icon: 'flask',
    href: '/queue',
    anyOf: ['lab:process', 'lab_result:enter', 'lab_result:verify'],
  },
};

export type ChartSpec =
  | Readonly<{
      kind: 'flow';
      title: string;
    }>
  | Readonly<{
      kind: 'pipeline';
      title: string;
      keys: readonly string[];
      labels: readonly string[];
    }>
  | Readonly<{ kind: 'money'; title: string; keys: readonly string[]; labels: readonly string[] }>;

export type RoleHome = Readonly<{
  /** Eyebrow for the hero panel. */
  eyebrow: string;
  heroIcon: IconName;
  /** Live one-line summary from the returned figures, or null when they are missing. */
  summary: (f: Figures, money: (paise: number) => string) => string | null;
  charts: readonly ChartSpec[];
  actions: readonly QuickActionId[];
}>;

/** "3 waiting now" etc. for the figures that exist, joined; null when none of them exist. */
function parts(f: Figures, items: readonly [string, (v: number) => string][]): string | null {
  const out = items.flatMap(([key, text]) => {
    const m = f.get(key);
    return m === undefined ? [] : [text(m.value)];
  });
  return out.length > 0 ? out.join('  ·  ') : null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const FLOW: ChartSpec = { kind: 'flow', title: "Today's patient flow" };
const MONEY: ChartSpec = {
  kind: 'money',
  title: 'Collections and balances',
  keys: ['collected_today', 'outstanding'],
  labels: ['Collected today', 'Outstanding on issued invoices'],
};

const front = (f: Figures) =>
  parts(f, [
    ['waiting_now', (v) => `${v} waiting now`],
    ['arrived_today', (v) => `${v} arrived`],
    ['appointments_today', (v) => plural(v, 'appointment', 'appointments')],
  ]);

export const ROLE_HOME: Readonly<Record<RoleCode, RoleHome>> = {
  SA: {
    eyebrow: 'HOSPITAL OVERVIEW',
    heroIcon: 'shield',
    summary: (f, money) =>
      parts(f, [
        ['appointments_today', (v) => plural(v, 'appointment', 'appointments')],
        ['collected_today', (v) => `${money(v)} collected`],
        ['audit_events_today', (v) => plural(v, 'audit event', 'audit events')],
      ]),
    charts: [FLOW, MONEY],
    actions: ['staff', 'search', 'queue', 'nurses'],
  },
  ADM: {
    eyebrow: 'OPERATIONS',
    heroIcon: 'business',
    summary: (f, money) =>
      parts(f, [
        ['appointments_today', (v) => plural(v, 'appointment', 'appointments')],
        ['waiting_now', (v) => `${v} waiting`],
        ['outstanding', (v) => `${money(v)} outstanding`],
      ]),
    charts: [FLOW, MONEY],
    actions: ['nurses', 'staff', 'search', 'invoices'],
  },
  REC: {
    eyebrow: 'FRONT DESK',
    heroIcon: 'calendar',
    summary: front,
    charts: [FLOW],
    actions: ['register', 'book', 'queue', 'followups'],
  },
  DOC: {
    eyebrow: 'CONSULTATIONS',
    heroIcon: 'stethoscope',
    summary: (f) =>
      parts(f, [
        ['my_queue', (v) => `${v} in your queue`],
        ['my_open_encounters', (v) => plural(v, 'consultation open', 'consultations open')],
        ['my_appointments_today', (v) => `${v} booked today`],
      ]),
    charts: [
      {
        kind: 'pipeline',
        title: 'Your patients now',
        keys: ['my_queue', 'my_open_encounters'],
        labels: ['Checked in, waiting', 'In consultation'],
      },
    ],
    actions: ['queue', 'search'],
  },
  NUR: {
    eyebrow: 'NURSING',
    heroIcon: 'pulse',
    summary: (f) =>
      parts(f, [
        ['my_patients_waiting', (v) => plural(v, 'patient waiting', 'patients waiting')],
        ['my_sessions_today', (v) => plural(v, 'assigned session', 'assigned sessions')],
      ]),
    charts: [],
    actions: ['queue', 'search'],
  },
  PHA: {
    eyebrow: 'PHARMACY',
    heroIcon: 'medkit',
    summary: (f) =>
      parts(f, [
        ['rx_waiting', (v) => plural(v, 'prescription to dispense', 'prescriptions to dispense')],
        ['low_stock_items', (v) => `${v} low on stock`],
        ['expiring_batches', (v) => plural(v, 'batch expiring', 'batches expiring')],
      ]),
    charts: [
      {
        kind: 'pipeline',
        title: 'Dispensing today',
        keys: ['rx_waiting', 'dispensed_today'],
        labels: ['Waiting', 'Dispensed'],
      },
    ],
    actions: ['dispense', 'invoices'],
  },
  LAB: {
    eyebrow: 'LABORATORY',
    heroIcon: 'flask',
    summary: (f) =>
      parts(f, [
        ['samples_pending', (v) => plural(v, 'sample to collect', 'samples to collect')],
        ['awaiting_verification', (v) => `${v} awaiting verification`],
      ]),
    charts: [
      {
        kind: 'pipeline',
        title: 'Worklist by stage',
        keys: ['samples_pending', 'tests_in_process', 'awaiting_verification'],
        labels: ['To collect', 'In process', 'Awaiting verification'],
      },
    ],
    actions: ['worklist'],
  },
  FIN: {
    eyebrow: 'FINANCE',
    heroIcon: 'wallet',
    summary: (f, money) =>
      parts(f, [
        ['collected_today', (v) => `${money(v)} collected today`],
        ['outstanding', (v) => `${money(v)} outstanding`],
      ]),
    charts: [MONEY],
    actions: ['invoices'],
  },
  HR: {
    eyebrow: 'PEOPLE',
    heroIcon: 'people',
    summary: (f) =>
      parts(f, [
        ['active_staff', (v) => plural(v, 'active staff account', 'active staff accounts')],
      ]),
    charts: [],
    actions: ['staff'],
  },
  INV: {
    eyebrow: 'INVENTORY',
    heroIcon: 'cube',
    summary: (f) =>
      parts(f, [
        ['low_stock_items', (v) => `${v} at or below reorder level`],
        ['expiring_batches', (v) => plural(v, 'batch expiring', 'batches expiring')],
      ]),
    charts: [
      {
        kind: 'pipeline',
        title: 'Stock alerts',
        keys: ['low_stock_items', 'expiring_batches'],
        labels: ['Low stock', 'Expiring soon'],
      },
    ],
    actions: [],
  },
  MKT: {
    eyebrow: 'OUTREACH',
    heroIcon: 'megaphone',
    summary: () => null,
    charts: [],
    actions: [],
  },
};

export function quickActionsFor(
  role: RoleCode | undefined,
  permissions: readonly Permission[],
): QuickAction[] {
  const ids = role ? ROLE_HOME[role].actions : [];
  const all = new Set<QuickActionId>([...ids, 'queue']);
  return [...all]
    .map((id) => QUICK_ACTIONS[id])
    .filter((a) => a.anyOf.some((p) => permissions.includes(p)))
    .slice(0, 4);
}
