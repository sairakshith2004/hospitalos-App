import {
  doctorListSchema,
  hospitalInfoSchema,
  labTestListSchema,
  medicineListSchema,
  serviceListSchema,
} from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { many } from '../../src/db/sql';

import { bearer, signedIn, startTestApi, type TestApi } from './api-support';

let api: TestApi;

beforeAll(async () => {
  api = await startTestApi();
});

afterAll(async () => {
  await api.close();
});

describe('hospital reference data', () => {
  it('serves the hospital day from the server clock and the departments', async () => {
    const s = await signedIn(api, ['REC']);
    const hospital = await request(api.app).get('/api/v1/hospital').set(bearer(s));
    expect(hospital.body).toMatchObject({ timezone: 'Asia/Kolkata', currency: 'INR' });
    expect(hospitalInfoSchema.parse(hospital.body).today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const departments = await request(api.app).get('/api/v1/departments').set(bearer(s));
    expect(
      z
        .object({ items: z.array(z.object({ code: z.string() })) })
        .parse(departments.body)
        .items.map((d) => d.code),
    ).toEqual(expect.arrayContaining(['GENMED', 'PAED', 'ORTHO', 'DERM']));
  });

  it('lists doctors with fees for schedule readers only', async () => {
    const rec = await signedIn(api, ['REC']);
    const res = await request(api.app).get('/api/v1/doctors?department=genmed').set(bearer(rec));
    expect(res.status).toBe(200);
    const doctors = doctorListSchema.parse(res.body).items;
    expect(doctors.length).toBeGreaterThan(0);
    expect(
      doctors.every(
        (d) => d.departmentCode === 'GENMED' && Number.isInteger(d.consultationFeePaise),
      ),
    ).toBe(true);
    const hr = await signedIn(api, ['HR']);
    expect((await request(api.app).get('/api/v1/doctors').set(bearer(hr))).status).toBe(403);
  });

  it('changes a consultation fee only with fee:manage, with a reason and an audit row', async () => {
    const rec = await signedIn(api, ['REC']);
    const doctor = doctorListSchema.parse(
      (await request(api.app).get('/api/v1/doctors').set(bearer(rec))).body,
    ).items[0];
    if (!doctor) throw new Error('no doctor seeded');
    expect(
      (
        await request(api.app)
          .put(`/api/v1/doctors/${doctor.id}/fee`)
          .set(bearer(rec))
          .send({ consultationFeePaise: 1, reason: 'attempt' })
      ).status,
    ).toBe(403);
    const adm = await signedIn(api, ['ADM']);
    const bad = await request(api.app)
      .put(`/api/v1/doctors/${doctor.id}/fee`)
      .set(bearer(adm))
      .send({ consultationFeePaise: -5, reason: 'typo' });
    expect(bad.status).toBe(422);
    const fractional = await request(api.app)
      .put(`/api/v1/doctors/${doctor.id}/fee`)
      .set(bearer(adm))
      .send({ consultationFeePaise: 100.5, reason: 'paise only' });
    expect(fractional.status).toBe(422);
    const ok = await request(api.app)
      .put(`/api/v1/doctors/${doctor.id}/fee`)
      .set(bearer(adm))
      .send({
        consultationFeePaise: doctor.consultationFeePaise,
        reason: 'Annual review, unchanged',
      });
    expect(ok.status).toBe(200);
    const audit = await many(
      api.owner,
      sql`select action, reason from audit_logs where entity_id = ${doctor.id} and action = 'fee.changed'`,
      z.object({ action: z.string(), reason: z.string() }),
    );
    expect(audit.at(-1)?.reason).toBe('Annual review, unchanged');
  });

  it('adds weekly hours with schedule:manage and refuses overlapping hours', async () => {
    const adm = await signedIn(api, ['ADM']);
    const doctor = doctorListSchema.parse(
      (await request(api.app).get('/api/v1/doctors?department=DERM').set(bearer(adm))).body,
    ).items[0];
    if (!doctor) throw new Error('no doctor seeded');
    const sunday = {
      weekday: 7,
      startTime: '09:00',
      endTime: '10:00',
      slotMinutes: 15,
      reason: 'Sunday clinic trial',
    };
    const first = await request(api.app)
      .post(`/api/v1/doctors/${doctor.id}/schedules`)
      .set(bearer(adm))
      .send(sunday);
    const overlap = await request(api.app)
      .post(`/api/v1/doctors/${doctor.id}/schedules`)
      .set(bearer(adm))
      .send({ ...sunday, startTime: '09:30', endTime: '11:00' });
    expect([201, 409]).toContain(first.status); // 409 when a previous run already added it
    expect(overlap.status).toBe(409);
    const backwards = await request(api.app)
      .post(`/api/v1/doctors/${doctor.id}/schedules`)
      .set(bearer(adm))
      .send({ ...sunday, startTime: '12:00', endTime: '11:00' });
    expect(backwards.status).toBe(422);
    const rec = await signedIn(api, ['REC']);
    expect(
      (
        await request(api.app)
          .post(`/api/v1/doctors/${doctor.id}/schedules`)
          .set(bearer(rec))
          .send(sunday)
      ).status,
    ).toBe(403);
  });

  it('finds medicines by generic or brand and counts only dispensable stock', async () => {
    const doc = await signedIn(api, ['DOC']);
    const generic = medicineListSchema.parse(
      (await request(api.app).get('/api/v1/medicines?q=paracetamol').set(bearer(doc))).body,
    ).items;
    expect(generic.map((m) => m.sku)).toEqual(
      expect.arrayContaining(['MED-PCM-500', 'MED-PCM-650', 'MED-PAR-SYR']),
    );
    const pcm = generic.find((m) => m.sku === 'MED-PCM-500');
    expect(pcm?.ingredients).toEqual([{ name: 'Paracetamol', strength: 500, unit: 'mg' }]);
    // Seeded: 500 (active) + 60 (near expiry) + 30 (expired, excluded). Other tests may dispense.
    expect(pcm?.availableQty).toBeLessThanOrEqual(560);
    const amx = medicineListSchema.parse(
      (await request(api.app).get('/api/v1/medicines?q=amoxil').set(bearer(doc))).body,
    ).items[0];
    expect(amx?.availableQty).toBeLessThanOrEqual(200); // the recalled batch (100) never counts
    expect((await request(api.app).get('/api/v1/medicines?q=a').set(bearer(doc))).status).toBe(422);
    const fin = await signedIn(api, ['FIN']);
    expect((await request(api.app).get('/api/v1/medicines?q=para').set(bearer(fin))).status).toBe(
      403,
    );
  });

  it('lists lab tests with reference ranges and prices for laboratory and ordering roles', async () => {
    const lab = await signedIn(api, ['LAB']);
    const tests = labTestListSchema.parse(
      (await request(api.app).get('/api/v1/lab-tests').set(bearer(lab))).body,
    ).items;
    const cbc = tests.find((t) => t.code === 'CBC');
    expect(cbc?.parameters.find((p) => p.name === 'Haemoglobin')).toMatchObject({
      unit: 'g/dL',
      refLow: 12,
      refHigh: 16,
    });
    expect(cbc?.pricePaise).toBeGreaterThan(0);
    const rec = await signedIn(api, ['REC']);
    expect((await request(api.app).get('/api/v1/lab-tests').set(bearer(rec))).status).toBe(403);
  });

  it('changes a service price only with price:manage', async () => {
    const fin = await signedIn(api, ['FIN']);
    const services = serviceListSchema.parse(
      (await request(api.app).get('/api/v1/services').set(bearer(fin))).body,
    ).items;
    const dressing = services.find((s) => s.code === 'PROC-DRESSING');
    if (!dressing) throw new Error('no service seeded');
    expect(
      (
        await request(api.app)
          .put(`/api/v1/services/${dressing.id}/price`)
          .set(bearer(fin))
          .send({ pricePaise: dressing.pricePaise, reason: 'Price review' })
      ).status,
    ).toBe(204);
    const rec = await signedIn(api, ['REC']);
    expect(
      (
        await request(api.app)
          .put(`/api/v1/services/${dressing.id}/price`)
          .set(bearer(rec))
          .send({ pricePaise: 1, reason: 'attempt' })
      ).status,
    ).toBe(403);
  });
});
