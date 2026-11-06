import { ROLE_CODES } from '@hospitalos/contracts';

import { ROLE_PERMISSIONS } from '@/features/access/role-permissions';
import { formatPaise } from '@/services/format';

import { ROLE_HOME, quickActionsFor, type MetricLike } from '../role-home';

const figures = (entries: Record<string, number>) =>
  new Map<string, MetricLike>(
    Object.entries(entries).map(([key, value]) => [key, { key, value, unit: 'count' }]),
  );

describe('role home configuration', () => {
  it('has a home layout for all 11 roles', () => {
    expect(Object.keys(ROLE_HOME).sort()).toEqual([...ROLE_CODES].sort());
  });

  it.each(ROLE_CODES)('%s only gets quick actions its permissions allow (max 4)', (role) => {
    const permissions = ROLE_PERMISSIONS[role];
    const actions = quickActionsFor(role, permissions);
    expect(actions.length).toBeLessThanOrEqual(4);
    for (const action of actions) {
      expect(action.anyOf.some((p) => permissions.includes(p))).toBe(true);
    }
  });

  it('gives reception its booking actions and keeps marketing away from patient actions', () => {
    const rec = quickActionsFor('REC', ROLE_PERMISSIONS.REC).map((a) => a.id);
    expect(rec).toEqual(expect.arrayContaining(['register', 'book', 'queue']));
    const mkt = quickActionsFor('MKT', ROLE_PERMISSIONS.MKT).map((a) => a.id);
    expect(mkt).not.toContain('register');
    expect(mkt).not.toContain('search');
    // No Work Queue section exists for marketing, so no button leads to an empty page.
    expect(mkt).not.toContain('queue');
  });

  it('builds summaries only from returned figures', () => {
    const rec = ROLE_HOME.REC.summary(figures({ waiting_now: 3 }), formatPaise);
    expect(rec).toBe('3 waiting now');
    expect(ROLE_HOME.REC.summary(figures({}), formatPaise)).toBeNull();
    expect(ROLE_HOME.MKT.summary(figures({ anything: 9 }), formatPaise)).toBeNull();
  });

  it('formats money in summaries from paise', () => {
    const fin = ROLE_HOME.FIN.summary(figures({ collected_today: 86_800 }), formatPaise);
    expect(fin).toBe(`${formatPaise(86_800)} collected today`);
  });

  it('never configures a time-series chart (no historical data exists)', () => {
    for (const home of Object.values(ROLE_HOME)) {
      for (const chart of home.charts) {
        expect(['flow', 'pipeline', 'money']).toContain(chart.kind);
      }
    }
  });
});
