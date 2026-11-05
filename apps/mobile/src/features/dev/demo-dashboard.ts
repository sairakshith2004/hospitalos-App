import type { RoleCode } from '@/features/access/roles';
import type { Tone } from '@/theme/tokens';

import { devToolsEnabled } from './flags';

/**
 * DEVELOPMENT ONLY. Synthetic dashboard content for visual design and layout testing with the
 * role preview. It is shown only for a development demo session, always under a DEMO DATA label,
 * and never in production builds (see `features/dashboard/dashboard-content.ts`).
 *
 * Rules for this file:
 * - Aggregate counts and generic task titles only: no patient names, MRNs, phone numbers,
 *   diagnoses, medicines given to a person, or individual bills.
 * - Outpatient operations only (no wards, beds or admissions: inpatient care is out of scope).
 * - Never used as a source of workflow records; real figures come from the API (phase 1.11).
 */
export type DemoMetric = Readonly<{ label: string; value: string; caption: string; tone: Tone }>;
export type DemoTask = Readonly<{ title: string; detail: string; tag: string; tone: Tone }>;
export type DemoDashboard = Readonly<{
  metrics: readonly DemoMetric[];
  tasks: readonly DemoTask[];
}>;

const DEMO_DASHBOARDS: Readonly<Record<RoleCode, DemoDashboard>> = {
  SA: {
    metrics: [
      { label: 'Outpatient visits', value: '58', caption: '41 checked in', tone: 'primary' },
      { label: 'Prescriptions waiting', value: '11', caption: 'Pharmacy queue', tone: 'secondary' },
      { label: 'Results to verify', value: '4', caption: 'Laboratory', tone: 'warning' },
    ],
    tasks: [
      {
        title: 'Review open billing corrections',
        detail: 'Billing · 2 waiting for Finance',
        tag: 'Today',
        tone: 'warning',
      },
      {
        title: 'Check unassigned nurse sessions',
        detail: 'Administration · 2 sessions',
        tag: 'Today',
        tone: 'primary',
      },
    ],
  },
  ADM: {
    metrics: [
      { label: 'Outpatient visits', value: '58', caption: 'Across 14 doctors', tone: 'primary' },
      { label: 'Unassigned sessions', value: '2', caption: 'Nurse assignments', tone: 'warning' },
      { label: 'Open corrections', value: '2', caption: 'Waiting for Finance', tone: 'neutral' },
    ],
    tasks: [
      {
        title: 'Assign nurses to afternoon sessions',
        detail: 'Administration · 2 sessions',
        tag: 'Today',
        tone: 'warning',
      },
      {
        title: 'Review visits still in consultation',
        detail: 'Reception · 3 visits',
        tag: 'Check',
        tone: 'neutral',
      },
    ],
  },
  REC: {
    metrics: [
      { label: 'Appointments today', value: '42', caption: '18 checked in', tone: 'primary' },
      { label: 'Walk-ins', value: '6', caption: 'Tokens issued', tone: 'secondary' },
      { label: 'Follow-ups due', value: '9', caption: 'To book this week', tone: 'warning' },
    ],
    tasks: [
      {
        title: 'Check in expected arrivals',
        detail: 'Reception · 5 in the next hour',
        tag: 'Now',
        tone: 'primary',
      },
      {
        title: 'Book recommended follow-ups',
        detail: 'Reception · 3 overdue',
        tag: 'Overdue',
        tone: 'warning',
      },
    ],
  },
  DOC: {
    metrics: [
      { label: 'My appointments', value: '16', caption: '7 seen', tone: 'primary' },
      { label: 'Waiting now', value: '4', caption: 'Checked in', tone: 'secondary' },
      { label: 'Results to review', value: '3', caption: 'Verified lab results', tone: 'warning' },
    ],
    tasks: [
      {
        title: 'Next patient in queue',
        detail: 'Consultation · token 12',
        tag: 'Now',
        tone: 'primary',
      },
      {
        title: 'Complete open consultations',
        detail: 'Clinical · 1 in progress',
        tag: 'Today',
        tone: 'neutral',
      },
    ],
  },
  NUR: {
    metrics: [
      { label: 'My patients today', value: '9', caption: 'Assigned sessions', tone: 'primary' },
      { label: 'Vitals due', value: '3', caption: 'Before consultation', tone: 'warning' },
      {
        label: 'Sessions assigned',
        value: '2',
        caption: 'Morning and afternoon',
        tone: 'secondary',
      },
    ],
    tasks: [
      {
        title: 'Record vitals for checked-in patients',
        detail: 'Nursing · 3 waiting',
        tag: 'Now',
        tone: 'warning',
      },
    ],
  },
  PHA: {
    metrics: [
      {
        label: 'Prescriptions waiting',
        value: '11',
        caption: '2 partly dispensed',
        tone: 'primary',
      },
      { label: 'Dispensed today', value: '27', caption: 'First expiry first out', tone: 'success' },
      { label: 'Near-expiry batches', value: '5', caption: 'Within 30 days', tone: 'warning' },
    ],
    tasks: [
      {
        title: 'Work the prescription queue',
        detail: 'Pharmacy · 11 waiting',
        tag: 'Now',
        tone: 'primary',
      },
    ],
  },
  LAB: {
    metrics: [
      { label: 'Samples to collect', value: '7', caption: 'Ordered today', tone: 'primary' },
      { label: 'Results to enter', value: '5', caption: 'In process', tone: 'secondary' },
      { label: 'Results to verify', value: '4', caption: 'Entered by others', tone: 'warning' },
    ],
    tasks: [
      {
        title: 'Verify results entered by colleagues',
        detail: 'Laboratory · 4 waiting',
        tag: 'Today',
        tone: 'warning',
      },
    ],
  },
  FIN: {
    metrics: [
      { label: 'Invoices issued', value: '38', caption: 'Today', tone: 'primary' },
      { label: 'Collected', value: '₹1,24,500', caption: 'Payments today', tone: 'success' },
      { label: 'Open corrections', value: '2', caption: 'Resolved in Release 3', tone: 'warning' },
    ],
    tasks: [
      {
        title: 'Review issued invoices with balances',
        detail: 'Billing · 6 part-paid',
        tag: 'Today',
        tone: 'neutral',
      },
    ],
  },
  HR: {
    metrics: [
      { label: 'Staff on duty', value: '46', caption: 'Outpatient departments', tone: 'primary' },
      { label: 'New logins', value: '2', caption: 'Waiting for roles', tone: 'warning' },
    ],
    tasks: [
      {
        title: 'Create logins for new staff',
        detail: 'HR · 2 starters',
        tag: 'This week',
        tone: 'primary',
      },
    ],
  },
  INV: {
    metrics: [
      { label: 'Low-stock items', value: '6', caption: 'General store', tone: 'warning' },
      { label: 'Purchase orders', value: '3', caption: 'Awaiting approval', tone: 'secondary' },
    ],
    tasks: [
      {
        title: 'Review reorder suggestions',
        detail: 'Inventory · 6 items',
        tag: 'This week',
        tone: 'neutral',
      },
    ],
  },
  MKT: {
    metrics: [
      { label: 'New enquiries', value: '9', caption: 'This week', tone: 'primary' },
      { label: 'Converted', value: '4', caption: 'Became patients', tone: 'success' },
    ],
    tasks: [
      {
        title: 'Follow up open enquiries',
        detail: 'Outreach · 5 open',
        tag: 'This week',
        tone: 'neutral',
      },
    ],
  },
};

/** Demo content for the role, or `undefined` outside development builds. */
export function getDemoDashboard(role: RoleCode): DemoDashboard | undefined {
  return devToolsEnabled ? DEMO_DASHBOARDS[role] : undefined;
}
