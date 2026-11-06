import type { Tone } from '@/theme/tokens';

/**
 * One mapping from workflow status to tone, used by every screen so the same status always looks
 * the same: waiting/needs action = warning, under way = primary, done = success,
 * stopped = danger, scheduled = info, anything else neutral. The label always carries the meaning.
 */
const TONES: Readonly<Record<string, Tone>> = {
  // waiting for someone
  checked_in: 'warning',
  issued: 'warning',
  resulted: 'warning',
  pending: 'warning',
  collected: 'warning',
  sample_collected: 'warning',
  in_progress: 'primary',
  rejected_sample: 'danger',
  ordered: 'warning',
  draft: 'neutral',
  // under way
  in_consultation: 'primary',
  in_process: 'primary',
  partially_dispensed: 'primary',
  partially_paid: 'primary',
  // done
  completed: 'success',
  verified: 'success',
  dispensed: 'success',
  paid: 'success',
  booked_follow_up: 'success',
  // scheduled
  booked: 'info',
  scheduled: 'info',
  // stopped
  cancelled: 'danger',
  no_show: 'danger',
  rejected: 'danger',
  expired: 'danger',
  closed: 'neutral',
};

export function statusTone(status: string): Tone {
  return TONES[status] ?? 'neutral';
}
