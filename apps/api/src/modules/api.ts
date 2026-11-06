import type { RequestHandler, Router } from 'express';

import type { Db } from '../db/sql';
import { AppError } from '../lib/errors';
import type { Logger } from '../lib/logger';
import type { Mailer } from '../mail/mailer';
import { authenticate } from '../middleware/authenticate';
import type { SettingsProvider } from '../settings';

import { staffRouter } from './admin/staff.routes';
import { createStaffService } from './admin/staff.service';
import { publicAuthRouter, sessionRouter } from './auth/auth.routes';
import { createAuthService } from './auth/auth.service';
import { billingRouter } from './billing/billing.routes';
import { createBillingService } from './billing/billing.service';
import { clinicalRouter } from './clinical/clinical.routes';
import { createClinicalService } from './clinical/clinical.service';
import { dashboardRouter } from './dashboard/dashboard.routes';
import { createDashboardService } from './dashboard/dashboard.service';
import { labRouter } from './lab/lab.routes';
import { createLabService } from './lab/lab.service';
import { patientsRouter } from './patients/patients.routes';
import { createPatientsService } from './patients/patients.service';
import { pharmacyRouter } from './pharmacy/pharmacy.routes';
import { createPharmacyService } from './pharmacy/pharmacy.service';
import { referenceRouter } from './reference/reference.routes';
import { createReferenceService } from './reference/reference.service';
import { schedulingRouter } from './scheduling/scheduling.routes';
import { createSchedulingService } from './scheduling/scheduling.service';

export type ApiDeps = Readonly<{
  db: Db;
  settings: SettingsProvider;
  mailer: Mailer;
  resetCodePepper: string;
  logger: Logger;
}>;

export type ApiModules = Readonly<{
  publicRouters: readonly Router[];
  gate: readonly RequestHandler[];
  protectedRouters: readonly Router[];
}>;

function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * App-version check (architecture §6.2, AV-1 to AV-4): once a minimum version is configured for a
 * platform, requests from older or unidentified app builds answer 426, except the version policy
 * itself and sign-out.
 */
export function appVersionGate(settings: SettingsProvider): RequestHandler {
  return async (req, _res, next) => {
    const path = req.originalUrl.split('?')[0] ?? '';
    if (
      path === '/api/v1/app/version-policy' ||
      (req.method === 'DELETE' && path === '/api/v1/auth/sessions/current')
    ) {
      next();
      return;
    }
    const s = await settings.get();
    if (s.app_min_version_android === null && s.app_min_version_ios === null) {
      next();
      return;
    }
    const platform = req.get('x-app-platform');
    const version = req.get('x-app-version') ?? '';
    const minimum =
      platform === 'android'
        ? s.app_min_version_android
        : platform === 'ios'
          ? s.app_min_version_ios
          : null;
    const known = /^\d+\.\d+\.\d+$/.test(version);
    if (platform === 'web') {
      next();
      return;
    }
    if (
      !known ||
      (minimum !== null && compareVersions(version, minimum) < 0) ||
      (minimum === null && platform !== 'android' && platform !== 'ios')
    ) {
      throw new AppError(426, 'APP_UPDATE_REQUIRED', 'Update the app to continue.');
    }
    next();
  };
}

export function buildApi(deps: ApiDeps): ApiModules {
  const auth = createAuthService(deps);
  const staff = createStaffService(deps.db);
  return {
    publicRouters: [publicAuthRouter(auth, deps.settings)],
    gate: [appVersionGate(deps.settings)],
    protectedRouters: [
      sessionRouter(auth),
      staffRouter(staff),
      referenceRouter(createReferenceService(deps.db)),
      patientsRouter(createPatientsService(deps.db)),
      schedulingRouter(createSchedulingService(deps.db)),
      clinicalRouter(createClinicalService(deps.db)),
      pharmacyRouter(createPharmacyService(deps.db)),
      labRouter(createLabService(deps.db)),
      billingRouter(createBillingService(deps.db)),
      dashboardRouter(createDashboardService(deps.db)),
    ],
  };
}

export const authenticateWith = authenticate;
