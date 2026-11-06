import {
  appointmentSchema,
  encounterSchema,
  errorEnvelopeSchema,
  invoiceListSchema,
  invoiceSchema,
  labOrderSchema,
  labTestListSchema,
  prescriptionSchema,
  receiptSchema,
} from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { many, one, run } from '../../src/db/sql';

import {
  bearer,
  createTestDoctor,
  firstSlotTomorrow,
  idem,
  moveToToday,
  registerPatient,
  signedIn,
  startTestApi,
  unique,
  type Session,
  type TestApi,
  type TestDoctor,
} from './api-support';

let api: TestApi;
let rec: Session;

beforeAll(async () => {
  api = await startTestApi();
  rec = await signedIn(api, ['REC']);
});

afterAll(async () => {
  await api.close();
});

const codeOf = (body: unknown) => errorEnvelopeSchema.parse(body).error.code;

/** A patient checked in today with the doctor and an encounter in progress. */
async function inConsultation(doctor: TestDoctor) {
  const patient = await registerPatient(api, rec);
  const slot = await firstSlotTomorrow(api, rec, doctor.doctorId);
  const booked = appointmentSchema.parse(
    (
      await request(api.app)
        .post('/api/v1/appointments')
        .set(bearer(rec))
        .set(idem())
        .send({ patientId: patient.id, doctorId: doctor.doctorId, slotStart: slot })
        .expect(201)
    ).body,
  );
  await moveToToday(api, booked.id);
  await request(api.app)
    .post(`/api/v1/appointments/${booked.id}/check-in`)
    .set(bearer(rec))
    .set(idem())
    .send()
    .expect(200);
  const encounter = encounterSchema.parse(
    (
      await request(api.app)
        .post('/api/v1/encounters')
        .set(bearer(doctor.session))
        .send({ appointmentId: booked.id })
        .expect(201)
    ).body,
  );
  return { patient, appointmentId: booked.id, encounter };
}

/** A private medicine with one batch, so stock tests never interfere with each other. */
async function privateMedicine(
  batches: readonly { qty: number; expiresInDays: number; status?: string }[],
) {
  const sku = `MED-T-${unique().toUpperCase()}`;
  const item = await one(
    api.owner,
    sql`insert into stock_items (sku, kind, name, base_unit) values (${sku}, 'medicine', ${sku}, 'tablet') returning id`,
    z.object({ id: z.uuid() }),
  );
  await run(
    api.owner,
    sql`insert into medicine_products (stock_item_id, brand_name, dosage_form, route) values (${item.id}, ${sku}, 'tablet', 'oral')`,
  );
  for (const [i, b] of batches.entries()) {
    await run(
      api.owner,
      sql`insert into stock_batches (stock_item_id, location_id, batch_no, expiry_date, sale_price_paise, qty_on_hand, status)
          select ${item.id}, id, ${`B${i}-${sku}`}, current_date + ${b.expiresInDays}::int, 100, ${b.qty}, ${b.status ?? 'active'}
            from locations where code = 'PHARMACY-MAIN'`,
    );
  }
  return item.id;
}

async function prescribe(
  doctor: TestDoctor,
  encounterId: string,
  stockItemId: string,
  qty: number,
) {
  return prescriptionSchema.parse(
    (
      await request(api.app)
        .post(`/api/v1/encounters/${encounterId}/prescriptions`)
        .set(bearer(doctor.session))
        .send({
          items: [
            { stockItemId, dose: '1', frequency: 'daily', route: 'oral', qtyPrescribed: qty },
          ],
        })
        .expect(201)
    ).body,
  );
}

describe('scheduling safety', () => {
  it('lets exactly one of 10 simultaneous bookings take a slot (BK-2)', async () => {
    const doctor = await createTestDoctor(api);
    const patients = await Promise.all(Array.from({ length: 10 }, () => registerPatient(api, rec)));
    const slot = await firstSlotTomorrow(api, rec, doctor.doctorId);
    const results = await Promise.all(
      patients.map((p) =>
        request(api.app)
          .post('/api/v1/appointments')
          .set(bearer(rec))
          .set(idem())
          .send({ patientId: p.id, doctorId: doctor.doctorId, slotStart: slot }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(
      results.filter((r) => r.status === 409).every((r) => codeOf(r.body) === 'SLOT_UNAVAILABLE'),
    ).toBe(true);
    // The slot is no longer offered.
    const day = slot.slice(0, 10);
    const offered = z
      .object({ slots: z.array(z.object({ start: z.string() })) })
      .parse(
        (
          await request(api.app)
            .get(`/api/v1/doctors/${doctor.doctorId}/availability?date=${day}`)
            .set(bearer(rec))
        ).body,
      )
      .slots.map((s) => s.start);
    expect(offered).not.toContain(slot);
  });

  it('gives simultaneous registrations distinct MRNs and warns about duplicates without merging', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => registerPatient(api, rec)));
    expect(new Set(results.map((r) => r.mrn)).size).toBe(8);
    const phone = `8${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const person = {
      firstName: 'Lakshmi',
      lastName: unique('Devi'),
      dob: '1975-02-03',
      sex: 'female',
      phone,
    };
    await request(api.app).post('/api/v1/patients').set(bearer(rec)).send(person).expect(201);
    const again = await request(api.app)
      .post('/api/v1/patients')
      .set(bearer(rec))
      .send({ ...person, firstName: 'Laxmi' });
    expect(again.status).toBe(409);
    expect(
      z.object({ candidates: z.array(z.object({ reason: z.string() })) }).parse(again.body)
        .candidates[0]?.reason,
    ).toBe('same_phone_and_dob');
    await request(api.app)
      .post('/api/v1/patients')
      .set(bearer(rec))
      .send({ ...person, firstName: 'Laxmi', confirmNotDuplicate: true })
      .expect(201);
    expect(
      (
        await request(api.app)
          .post('/api/v1/patients')
          .set(bearer(rec))
          .send({ ...person, dob: '2999-01-01', confirmNotDuplicate: true })
      ).status,
    ).toBe(422);
  });

  it('refuses check-in on a later or earlier day, allows a no-show after the day, and reschedules atomically', async () => {
    const doctor = await createTestDoctor(api);
    const patient = await registerPatient(api, rec);
    const slot = await firstSlotTomorrow(api, rec, doctor.doctorId);
    const a = appointmentSchema.parse(
      (
        await request(api.app)
          .post('/api/v1/appointments')
          .set(bearer(rec))
          .set(idem())
          .send({ patientId: patient.id, doctorId: doctor.doctorId, slotStart: slot })
          .expect(201)
      ).body,
    );
    expect(
      (
        await request(api.app)
          .post(`/api/v1/appointments/${a.id}/check-in`)
          .set(bearer(rec))
          .set(idem())
          .send()
      ).status,
    ).toBe(422);
    const next = z.object({ slots: z.array(z.object({ start: z.string() })) }).parse(
      (
        await request(api.app)
          .get(`/api/v1/doctors/${doctor.doctorId}/availability?date=${slot.slice(0, 10)}`)
          .set(bearer(rec))
      ).body,
    ).slots[3]?.start;
    const moved = appointmentSchema.parse(
      (
        await request(api.app)
          .post(`/api/v1/appointments/${a.id}/reschedule`)
          .set(bearer(rec))
          .send({ slotStart: next, reason: 'Patient asked' })
          .expect(200)
      ).body,
    );
    expect(moved.slotStart).toBe(next);
    expect(
      appointmentSchema.parse(
        (await request(api.app).get(`/api/v1/appointments/${a.id}`).set(bearer(rec))).body,
      ).status,
    ).toBe('rescheduled');
    // Two days back in time: shown as "did not arrive", can't be checked in, can be marked no-show.
    await moveToToday(api, moved.id);
    await moveToToday(api, moved.id);
    const past = appointmentSchema.parse(
      (await request(api.app).get(`/api/v1/appointments/${moved.id}`).set(bearer(rec))).body,
    );
    expect(past.didNotArrive).toBe(true);
    expect(
      (
        await request(api.app)
          .post(`/api/v1/appointments/${moved.id}/check-in`)
          .set(bearer(rec))
          .set(idem())
          .send()
      ).status,
    ).toBe(422);
    await request(api.app)
      .post(`/api/v1/appointments/${moved.id}/no-show`)
      .set(bearer(rec))
      .send()
      .expect(200);
  });

  it('gives walk-ins consecutive tokens and charges each once, even when retried', async () => {
    const doctor = await createTestDoctor(api);
    const [p1, p2] = await Promise.all([registerPatient(api, rec), registerPatient(api, rec)]);
    const key = idem();
    const w1 = appointmentSchema.parse(
      (
        await request(api.app)
          .post('/api/v1/appointments/walk-in')
          .set(bearer(rec))
          .set(key)
          .send({ patientId: p1.id, doctorId: doctor.doctorId })
          .expect(201)
      ).body,
    );
    const again = appointmentSchema.parse(
      (
        await request(api.app)
          .post('/api/v1/appointments/walk-in')
          .set(bearer(rec))
          .set(key)
          .send({ patientId: p1.id, doctorId: doctor.doctorId })
          .expect(201)
      ).body,
    );
    expect(again.id).toBe(w1.id);
    const w2 = appointmentSchema.parse(
      (
        await request(api.app)
          .post('/api/v1/appointments/walk-in')
          .set(bearer(rec))
          .set(idem())
          .send({ patientId: p2.id, doctorId: doctor.doctorId })
          .expect(201)
      ).body,
    );
    expect([w1.tokenNo, w2.tokenNo]).toEqual([1, 2]);
    const inv = invoiceListSchema.parse(
      (await request(api.app).get(`/api/v1/invoices?appointmentId=${w1.id}`).set(bearer(rec))).body,
    ).items;
    expect(inv[0]?.lines.filter((l) => l.sourceType === 'consultation')).toHaveLength(1);
    const reuse = await request(api.app)
      .post('/api/v1/appointments/walk-in')
      .set(bearer(rec))
      .set(key)
      .send({ patientId: p2.id, doctorId: doctor.doctorId });
    expect(codeOf(reuse.body)).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(
      (
        await request(api.app)
          .post('/api/v1/appointments/walk-in')
          .set(bearer(rec))
          .send({ patientId: p2.id, doctorId: doctor.doctorId })
      ).status,
    ).toBe(400);
  });
});

describe('pharmacy safety', () => {
  it('never oversells: of two simultaneous dispensings for 8 each from 10, one fails cleanly (DP-7)', async () => {
    const doctor = await createTestDoctor(api);
    const pha = await signedIn(api, ['PHA']);
    const medicine = await privateMedicine([{ qty: 10, expiresInDays: 300 }]);
    const a = await inConsultation(doctor);
    const b = await inConsultation(doctor);
    const rxA = await prescribe(doctor, a.encounter.id, medicine, 8);
    const rxB = await prescribe(doctor, b.encounter.id, medicine, 8);
    const [ra, rb] = await Promise.all([
      request(api.app)
        .post(`/api/v1/prescriptions/${rxA.id}/dispense`)
        .set(bearer(pha))
        .set(idem())
        .send({ lines: [{ prescriptionItemId: rxA.items[0]?.id, qty: 8 }] }),
      request(api.app)
        .post(`/api/v1/prescriptions/${rxB.id}/dispense`)
        .set(bearer(pha))
        .set(idem())
        .send({ lines: [{ prescriptionItemId: rxB.items[0]?.id, qty: 8 }] }),
    ]);
    expect([ra.status, rb.status].sort()).toEqual([201, 422]);
    expect(codeOf(ra.status === 422 ? ra.body : rb.body)).toBe('INSUFFICIENT_STOCK');
    const stock = await one(
      api.owner,
      sql`select sum(qty_on_hand)::int as q from stock_batches where stock_item_id = ${medicine}`,
      z.object({ q: z.number() }),
    );
    expect(stock.q).toBe(2);
    const movements = await many(
      api.owner,
      sql`select m.qty from stock_movements m join stock_batches b on b.id = m.batch_id where b.stock_item_id = ${medicine}`,
      z.object({ qty: z.number() }),
    );
    expect(movements.map((m) => m.qty)).toEqual([-8]);
  });

  it('skips expired and recalled stock, needs an acknowledgement for near-expiry stock, and refuses expired prescriptions', async () => {
    const doctor = await createTestDoctor(api);
    const pha = await signedIn(api, ['PHA']);
    const medicine = await privateMedicine([
      { qty: 50, expiresInDays: -1 },
      { qty: 50, expiresInDays: 200, status: 'recalled' },
      { qty: 5, expiresInDays: 10 },
      { qty: 50, expiresInDays: 400 },
    ]);
    const visit = await inConsultation(doctor);
    const rx = await prescribe(doctor, visit.encounter.id, medicine, 8);
    const line = { prescriptionItemId: rx.items[0]?.id, qty: 8 };
    const needsAck = await request(api.app)
      .post(`/api/v1/prescriptions/${rx.id}/dispense`)
      .set(bearer(pha))
      .set(idem())
      .send({ lines: [line] });
    expect(needsAck.status).toBe(422);
    expect(codeOf(needsAck.body)).toBe('UNPROCESSABLE');
    const ok = z
      .object({ lines: z.array(z.object({ batchNo: z.string(), qty: z.number() })) })
      .parse(
        (
          await request(api.app)
            .post(`/api/v1/prescriptions/${rx.id}/dispense`)
            .set(bearer(pha))
            .set(idem())
            .send({ lines: [{ ...line, acknowledgeNearExpiry: true }] })
            .expect(201)
        ).body,
      );
    expect(ok.lines.map((l) => [l.batchNo.slice(0, 2), l.qty])).toEqual([
      ['B2', 5],
      ['B3', 3],
    ]); // FEFO across batches

    const later = await inConsultation(doctor);
    const old = await prescribe(doctor, later.encounter.id, medicine, 1);
    await run(
      api.owner,
      sql`update prescriptions set valid_until = current_date - 1 where id = ${old.id}`,
    );
    const expired = await request(api.app)
      .post(`/api/v1/prescriptions/${old.id}/dispense`)
      .set(bearer(pha))
      .set(idem())
      .send({ lines: [{ prescriptionItemId: old.items[0]?.id, qty: 1 }] });
    expect(codeOf(expired.body)).toBe('PRESCRIPTION_EXPIRED');
    const rec2 = await signedIn(api, ['REC']);
    expect(
      (
        await request(api.app)
          .post(`/api/v1/prescriptions/${old.id}/dispense`)
          .set(bearer(rec2))
          .set(idem())
          .send({ lines: [] })
      ).status,
    ).toBe(403);
  });
});

describe('billing safety', () => {
  async function issuedVisitInvoice() {
    const doctor = await createTestDoctor(api, 40_000);
    const visit = await inConsultation(doctor);
    const tests = labTestListSchema.parse(
      (await request(api.app).get('/api/v1/lab-tests').set(bearer(doctor.session))).body,
    ).items;
    const fbs = tests.find((t) => t.code === 'FBS');
    const order = labOrderSchema.parse(
      (
        await request(api.app)
          .post(`/api/v1/encounters/${visit.encounter.id}/lab-orders`)
          .set(bearer(doctor.session))
          .send({ testId: fbs?.id })
          .expect(201)
      ).body,
    );
    const invoice = invoiceListSchema.parse(
      (
        await request(api.app)
          .get(`/api/v1/invoices?appointmentId=${visit.appointmentId}`)
          .set(bearer(rec))
      ).body,
    ).items[0];
    return { doctor, visit, order, invoice, fbsPrice: fbs?.pricePaise ?? 0 };
  }

  it('recalculates a draft when a service is cancelled, and corrects an issued invoice without rewriting it', async () => {
    const draftCase = await issuedVisitInvoice();
    await request(api.app)
      .post(`/api/v1/lab-orders/${draftCase.order.id}/cancel`)
      .set(bearer(draftCase.doctor.session))
      .send({ reason: 'Not needed after review' })
      .expect(200);
    const recalculated = invoiceSchema.parse(
      (
        await request(api.app)
          .get(`/api/v1/invoices/${draftCase.invoice?.id ?? ''}`)
          .set(bearer(rec))
      ).body,
    );
    expect(recalculated.totalPaise).toBe(40_000);
    expect(recalculated.lines.find((l) => l.sourceType === 'lab')).toMatchObject({
      isActive: false,
      deactivationReason: 'Not needed after review',
    });

    const issuedCase = await issuedVisitInvoice();
    const id = issuedCase.invoice?.id ?? '';
    const issued = invoiceSchema.parse(
      (
        await request(api.app)
          .post(`/api/v1/invoices/${id}/issue`)
          .set(bearer(rec))
          .send()
          .expect(200)
      ).body,
    );
    await request(api.app)
      .post(`/api/v1/lab-orders/${issuedCase.order.id}/cancel`)
      .set(bearer(issuedCase.doctor.session))
      .send({ reason: 'Sample could not be taken' })
      .expect(200);
    const after = invoiceSchema.parse(
      (await request(api.app).get(`/api/v1/invoices/${id}`).set(bearer(rec))).body,
    );
    expect(after.totalPaise).toBe(issued.totalPaise); // never rewritten
    expect(after.pendingCorrectionsPaise).toBe(issuedCase.fbsPrice);
    expect(after.collectablePaise).toBe(issued.totalPaise - issuedCase.fbsPrice);
    const tooMuch = await request(api.app)
      .post(`/api/v1/invoices/${id}/payments`)
      .set(bearer(rec))
      .set(idem())
      .send({ amountPaise: issued.totalPaise, method: 'cash' });
    expect(codeOf(tooMuch.body)).toBe('CORRECTION_PENDING');
    await request(api.app)
      .post(`/api/v1/invoices/${id}/payments`)
      .set(bearer(rec))
      .set(idem())
      .send({ amountPaise: after.collectablePaise, method: 'cash' })
      .expect(201);
    const fin = await signedIn(api, ['FIN']);
    const corrections = z
      .object({ items: z.array(z.object({ invoiceId: z.string() })) })
      .parse(
        (await request(api.app).get('/api/v1/billing-corrections').set(bearer(fin))).body,
      ).items;
    expect(corrections.map((c) => c.invoiceId)).toContain(id);
    // The database itself refuses to rewrite an issued invoice.
    await expect(
      run(api.owner, sql`update invoices set total_paise = 1, subtotal_paise = 1 where id = ${id}`),
    ).rejects.toThrow();
  });

  it('records a payment once, however often or concurrently it is retried (BL-3)', async () => {
    const { invoice } = await issuedVisitInvoice();
    const id = invoice?.id ?? '';
    await request(api.app).post(`/api/v1/invoices/${id}/issue`).set(bearer(rec)).send().expect(200);
    const key = idem();
    const body = { amountPaise: 1_000, method: 'card' };
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(api.app)
          .post(`/api/v1/invoices/${id}/payments`)
          .set(bearer(rec))
          .set(key)
          .send(body),
      ),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => receiptSchema.parse(r.body).receiptNo)).size).toBe(1);
    const payments = await one(
      api.owner,
      sql`select count(*)::int as n, sum(amount_paise)::int as s from payments where invoice_id = ${id}`,
      z.object({ n: z.number(), s: z.number() }),
    );
    expect(payments).toEqual({ n: 1, s: 1_000 });
  });

  it('offers no credit-note, refund, discount or export endpoint in Release 1', async () => {
    const fin = await signedIn(api, ['FIN']);
    for (const path of [
      '/api/v1/credit-notes',
      '/api/v1/refunds',
      '/api/v1/invoices/x/discounts',
      '/api/v1/invoices/x/export',
    ]) {
      expect((await request(api.app).post(path).set(bearer(fin)).send({})).status).toBe(404);
    }
  });
});

describe('laboratory safety', () => {
  it('enforces the order of lab steps and unique sample barcodes', async () => {
    const doctor = await createTestDoctor(api);
    const lab = await signedIn(api, ['LAB']);
    const visit = await inConsultation(doctor);
    const tests = labTestListSchema.parse(
      (await request(api.app).get('/api/v1/lab-tests').set(bearer(lab))).body,
    ).items;
    const order = labOrderSchema.parse(
      (
        await request(api.app)
          .post(`/api/v1/encounters/${visit.encounter.id}/lab-orders`)
          .set(bearer(doctor.session))
          .send({ testId: tests[0]?.id })
          .expect(201)
      ).body,
    );
    expect(
      (await request(api.app).post(`/api/v1/lab-orders/${order.id}/verify`).set(bearer(lab)).send())
        .status,
    ).toBe(422);
    expect(
      (
        await request(api.app)
          .post(`/api/v1/lab-orders/${order.id}/process`)
          .set(bearer(lab))
          .send()
      ).status,
    ).toBe(422);
    const barcode = `BC-${unique()}`;
    await request(api.app)
      .post(`/api/v1/lab-orders/${order.id}/collect`)
      .set(bearer(lab))
      .send({ barcode })
      .expect(200);
    expect(
      (
        await request(api.app)
          .post(`/api/v1/lab-orders/${order.id}/cancel`)
          .set(bearer(doctor.session))
          .send({ reason: 'too late' })
      ).status,
    ).toBe(422);
    const second = labOrderSchema.parse(
      (
        await request(api.app)
          .post(`/api/v1/encounters/${visit.encounter.id}/lab-orders`)
          .set(bearer(doctor.session))
          .send({ testId: tests[0]?.id })
          .expect(201)
      ).body,
    );
    expect(
      (
        await request(api.app)
          .post(`/api/v1/lab-orders/${second.id}/collect`)
          .set(bearer(lab))
          .send({ barcode })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(api.app)
          .post(`/api/v1/encounters/${visit.encounter.id}/entered-in-error`)
          .set(bearer(doctor.session))
          .send({ reason: 'wrong patient' })
      ).status,
    ).toBe(422);
  });
});
