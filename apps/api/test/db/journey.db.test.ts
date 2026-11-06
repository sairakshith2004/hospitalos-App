import {
  appointmentSchema,
  chartSchema,
  dashboardSchema,
  dispensingSchema,
  encounterSchema,
  invoiceListSchema,
  invoiceSchema,
  labOrderSchema,
  labTestListSchema,
  medicineListSchema,
  prescriptionSchema,
  receiptSchema,
} from '@hospitalos/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  bearer,
  createTestDoctor,
  createTestUser,
  firstSlotTomorrow,
  idem,
  moveToToday,
  registerPatient,
  signIn,
  signedIn,
  startTestApi,
  type TestApi,
} from './api-support';

let api: TestApi;

beforeAll(async () => {
  api = await startTestApi();
});

afterAll(async () => {
  await api.close();
});

/**
 * The Release 1 acceptance scenario (docs/MOBILE-WORKFLOWS.md §2), end to end through the real API
 * and database, with a negative authorization check at each stage.
 */
describe('integrated outpatient journey', () => {
  it('runs from registration to follow-up with every department on the same records', async () => {
    const rec = await signedIn(api, ['REC']);
    const doctor = await createTestDoctor(api, 60_000);
    const pha = await signedIn(api, ['PHA']);
    const labA = await signedIn(api, ['LAB']);
    const labB = await signedIn(api, ['LAB']);
    const fin = await signedIn(api, ['FIN']);
    const adm = await signedIn(api, ['ADM']);
    const nurseUser = await createTestUser(api.owner, { roles: ['NUR'] });
    const nurse = await signIn(api.app, nurseUser);
    const mkt = await signedIn(api, ['MKT']);
    const otherDoctor = await createTestDoctor(api);

    // 1. Register (MRN); marketing can't.
    expect((await request(api.app).post('/api/v1/patients').set(bearer(mkt)).send({})).status).toBe(
      403,
    );
    const patient = await registerPatient(api, rec);
    expect(patient.mrn).toMatch(/^MRN\d{6}$/);
    const found = await request(api.app)
      .get(`/api/v1/patients?q=${patient.mrn.slice(3)}`)
      .set(bearer(rec));
    expect(
      z
        .object({ items: z.array(z.object({ id: z.string() })) })
        .parse(found.body)
        .items.map((p) => p.id),
    ).toEqual([patient.id]);

    // 2. Availability and booking.
    const slot = await firstSlotTomorrow(api, rec, doctor.doctorId);
    const booked = await request(api.app)
      .post('/api/v1/appointments')
      .set(bearer(rec))
      .set(idem())
      .send({ patientId: patient.id, doctorId: doctor.doctorId, slotStart: slot });
    expect(booked.status).toBe(201);
    const appointment = appointmentSchema.parse(booked.body);
    expect(appointment.status).toBe('booked');
    expect(
      (
        await request(api.app)
          .post('/api/v1/appointments')
          .set(bearer(doctor.session))
          .set(idem())
          .send({ patientId: patient.id, doctorId: doctor.doctorId, slotStart: slot })
      ).status,
    ).toBe(403);

    // 3. The day arrives; check-in gives a token and puts the fee on the draft invoice.
    await moveToToday(api, appointment.id);
    const checkIn = await request(api.app)
      .post(`/api/v1/appointments/${appointment.id}/check-in`)
      .set(bearer(rec))
      .set(idem())
      .send();
    expect(checkIn.status).toBe(200);
    expect(appointmentSchema.parse(checkIn.body)).toMatchObject({
      status: 'checked_in',
      tokenNo: 1,
    });
    const draft = invoiceListSchema.parse(
      (
        await request(api.app)
          .get(`/api/v1/invoices?appointmentId=${appointment.id}`)
          .set(bearer(rec))
      ).body,
    ).items;
    expect(draft).toHaveLength(1);
    expect(draft[0]).toMatchObject({ status: 'draft', totalPaise: 60_000 });

    // 4. The nurse assigned to the doctor's session records vitals; an unassigned nurse can't.
    const schedules = z
      .object({ items: z.array(z.object({ id: z.string(), weekday: z.number() })) })
      .parse(
        (
          await request(api.app)
            .get(`/api/v1/doctors/${doctor.doctorId}/schedules`)
            .set(bearer(rec))
        ).body,
      ).items;
    const today = z
      .object({ today: z.string() })
      .parse((await request(api.app).get('/api/v1/hospital').set(bearer(rec))).body).today;
    const isoDow = ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const sessionSchedule = schedules.find((s) => s.weekday === isoDow);
    const vitalsBody = {
      appointmentId: appointment.id,
      tempC: 37.2,
      pulse: 82,
      bpSys: 124,
      bpDia: 80,
      spo2: 98,
    };
    expect(
      (await request(api.app).post('/api/v1/vitals').set(bearer(nurse)).send(vitalsBody)).status,
    ).toBe(404);
    const assigned = await request(api.app)
      .post('/api/v1/nurse-assignments')
      .set(bearer(adm))
      .send({
        nurseUserId: nurseUser.id,
        doctorScheduleId: sessionSchedule?.id,
        sessionDate: today,
      });
    expect(assigned.status).toBe(201);
    expect(
      (await request(api.app).post('/api/v1/vitals').set(bearer(nurse)).send(vitalsBody)).status,
    ).toBe(201);
    expect(
      (
        await request(api.app)
          .post(`/api/v1/patients/${patient.id}/allergies`)
          .set(bearer(nurse))
          .send({ substance: 'Amoxicillin', severity: 'moderate', reaction: 'Rash' })
      ).status,
    ).toBe(201);
    // The nurse has no consultation actions.
    expect(
      (
        await request(api.app)
          .post('/api/v1/encounters')
          .set(bearer(nurse))
          .send({ appointmentId: appointment.id })
      ).status,
    ).toBe(403);

    // 5. The doctor starts the consultation; another doctor can't see or start it.
    expect(
      (
        await request(api.app)
          .post('/api/v1/encounters')
          .set(bearer(otherDoctor.session))
          .send({ appointmentId: appointment.id })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(api.app)
          .get(`/api/v1/patients/${patient.id}/chart`)
          .set(bearer(otherDoctor.session))
      ).status,
    ).toBe(404);
    const started = await request(api.app)
      .post('/api/v1/encounters')
      .set(bearer(doctor.session))
      .send({ appointmentId: appointment.id, chiefComplaint: 'Fever for two days' });
    expect(started.status).toBe(201);
    const encounter = encounterSchema.parse(started.body);
    const chart = chartSchema.parse(
      (
        await request(api.app)
          .get(`/api/v1/patients/${patient.id}/chart`)
          .set(bearer(doctor.session))
      ).body,
    );
    expect(chart.vitals[0]).toMatchObject({ pulse: 82, bpSys: 124 });
    expect(chart.allergies.map((a) => a.substance)).toContain('Amoxicillin');

    // 6. Notes, diagnosis, prescription (allergy acknowledgement), lab order, follow-up.
    await request(api.app)
      .post(`/api/v1/encounters/${encounter.id}/notes`)
      .set(bearer(doctor.session))
      .send({ kind: 'symptoms', body: 'Fever, body ache.' })
      .expect(201);
    await request(api.app)
      .post(`/api/v1/encounters/${encounter.id}/diagnoses`)
      .set(bearer(doctor.session))
      .send({ description: 'Viral fever', isPrimary: true })
      .expect(201);
    const pcm = medicineListSchema.parse(
      (await request(api.app).get('/api/v1/medicines?q=paracip 500').set(bearer(doctor.session)))
        .body,
    ).items[0];
    const amx = medicineListSchema.parse(
      (await request(api.app).get('/api/v1/medicines?q=amoxicillin').set(bearer(doctor.session)))
        .body,
    ).items[0];
    if (!pcm || !amx) throw new Error('medicines not seeded');
    const items = [
      {
        stockItemId: pcm.stockItemId,
        dose: '1 tablet',
        frequency: 'three times a day',
        route: 'oral',
        durationDays: 3,
        qtyPrescribed: 9,
        substitutionAllowed: true,
      },
      {
        stockItemId: amx.stockItemId,
        dose: '1 capsule',
        frequency: 'three times a day',
        route: 'oral',
        durationDays: 5,
        qtyPrescribed: 15,
      },
    ];
    const allergyStop = await request(api.app)
      .post(`/api/v1/encounters/${encounter.id}/prescriptions`)
      .set(bearer(doctor.session))
      .send({ items });
    expect(allergyStop.status).toBe(422);
    const rxRes = await request(api.app)
      .post(`/api/v1/encounters/${encounter.id}/prescriptions`)
      .set(bearer(doctor.session))
      .send({ items, allergyAcknowledged: true });
    expect(rxRes.status).toBe(201);
    const rx = prescriptionSchema.parse(rxRes.body);
    expect(rx.items.find((i) => i.stockItemId === amx.stockItemId)?.allergyAcknowledged).toBe(true);
    expect(
      (
        await request(api.app)
          .post(`/api/v1/encounters/${encounter.id}/prescriptions`)
          .set(bearer(pha))
          .send({ items, allergyAcknowledged: true })
      ).status,
    ).toBe(403);

    const cbc = labTestListSchema
      .parse((await request(api.app).get('/api/v1/lab-tests').set(bearer(doctor.session))).body)
      .items.find((t) => t.code === 'CBC');
    if (!cbc) throw new Error('CBC not seeded');
    const orderRes = await request(api.app)
      .post(`/api/v1/encounters/${encounter.id}/lab-orders`)
      .set(bearer(doctor.session))
      .send({ testId: cbc.id });
    expect(orderRes.status).toBe(201);
    const order = labOrderSchema.parse(orderRes.body);
    const dueFrom = today;
    const followUp = await request(api.app)
      .post(`/api/v1/encounters/${encounter.id}/follow-ups`)
      .set(bearer(doctor.session))
      .send({ reason: 'Review after the course', dueFrom, dueTo: dueFrom });
    expect(followUp.status).toBe(201);

    // 7. Medicine availability is visible to the doctor (done above through search).
    expect(pcm.availableQty).toBeGreaterThan(0);

    // 8. Complete the encounter: the appointment completes in the same transaction.
    await request(api.app)
      .post(`/api/v1/encounters/${encounter.id}/complete`)
      .set(bearer(doctor.session))
      .expect(200);
    expect(
      appointmentSchema.parse(
        (await request(api.app).get(`/api/v1/appointments/${appointment.id}`).set(bearer(rec)))
          .body,
      ).status,
    ).toBe('completed');
    expect(
      (
        await request(api.app)
          .post(`/api/v1/encounters/${encounter.id}/notes`)
          .set(bearer(doctor.session))
          .send({ kind: 'plan', body: 'late' })
      ).status,
    ).toBe(422);
    await request(api.app)
      .post(`/api/v1/encounters/${encounter.id}/notes`)
      .set(bearer(doctor.session))
      .send({ kind: 'addendum', body: 'Patient advised fluids.' })
      .expect(201);

    // 9. Laboratory: collect, process, enter, verify by a second technician.
    await request(api.app)
      .post(`/api/v1/lab-orders/${order.id}/collect`)
      .set(bearer(labA))
      .send({ barcode: `S-${order.orderNo}` })
      .expect(200);
    await request(api.app)
      .post(`/api/v1/lab-orders/${order.id}/process`)
      .set(bearer(labA))
      .send()
      .expect(200);
    const results = order.results.map((r) => ({
      parameterId: r.parameterId,
      valueNum: r.parameter === 'Haemoglobin' ? 10.5 : (r.refLow ?? 1) + 1,
    }));
    const entered = labOrderSchema.parse(
      (
        await request(api.app)
          .post(`/api/v1/lab-orders/${order.id}/results`)
          .set(bearer(labA))
          .send({ results })
          .expect(200)
      ).body,
    );
    expect(entered.results.find((r) => r.parameter === 'Haemoglobin')?.flag).toBe('low');
    expect(
      (
        await request(api.app)
          .post(`/api/v1/lab-orders/${order.id}/verify`)
          .set(bearer(labA))
          .send()
      ).status,
    ).toBe(403);
    await request(api.app)
      .post(`/api/v1/lab-orders/${order.id}/verify`)
      .set(bearer(labB))
      .send()
      .expect(200);
    const chartAfterLab = chartSchema.parse(
      (
        await request(api.app)
          .get(`/api/v1/patients/${patient.id}/chart`)
          .set(bearer(doctor.session))
      ).body,
    );
    expect(chartAfterLab.labResults.map((l) => l.orderId)).toContain(order.id);

    // 10–11. Pharmacy dispenses first-expiry-first-out; the expired batch is never used.
    const pcmItem = rx.items.find((i) => i.stockItemId === pcm.stockItemId);
    const amxItem = rx.items.find((i) => i.stockItemId === amx.stockItemId);
    if (!pcmItem || !amxItem) throw new Error('items missing');
    const key = idem();
    const dispensed = await request(api.app)
      .post(`/api/v1/prescriptions/${rx.id}/dispense`)
      .set(bearer(pha))
      .set(key)
      .send({
        lines: [
          { prescriptionItemId: pcmItem.id, qty: 9, acknowledgeNearExpiry: true },
          { prescriptionItemId: amxItem.id, qty: 15 },
        ],
      });
    expect(dispensed.status).toBe(201);
    const dispensing = dispensingSchema.parse(dispensed.body);
    expect(dispensing.prescriptionStatus).toBe('dispensed');
    expect(dispensing.lines.find((l) => l.prescriptionItemId === pcmItem.id)?.batchNo).toBe(
      'PCM-A0',
    ); // nearest unexpired expiry
    expect(dispensing.lines.some((l) => l.batchNo === 'PCM-OLD' || l.batchNo === 'AMX-RC')).toBe(
      false,
    );
    // A retry with the same key returns the same result and dispenses nothing more.
    const retry = await request(api.app)
      .post(`/api/v1/prescriptions/${rx.id}/dispense`)
      .set(bearer(pha))
      .set(key)
      .send({
        lines: [
          { prescriptionItemId: pcmItem.id, qty: 9, acknowledgeNearExpiry: true },
          { prescriptionItemId: amxItem.id, qty: 15 },
        ],
      });
    expect(retry.status).toBe(201);
    expect(dispensingSchema.parse(retry.body).id).toBe(dispensing.id);

    // 12. Invoice: consultation, lab and medicines on one visit invoice; issue; part payments; receipt.
    const visitInvoice = invoiceListSchema.parse(
      (
        await request(api.app)
          .get(`/api/v1/invoices?appointmentId=${appointment.id}`)
          .set(bearer(rec))
      ).body,
    ).items[0];
    if (!visitInvoice) throw new Error('no invoice');
    expect(
      visitInvoice.lines
        .filter((l) => l.isActive)
        .map((l) => l.sourceType)
        .sort(),
    ).toEqual(expect.arrayContaining(['consultation', 'dispensing', 'lab']));
    const medicines = 9 * 200 + 15 * 900;
    expect(visitInvoice.totalPaise).toBe(60_000 + cbc.pricePaise + medicines);
    expect(
      (
        await request(api.app)
          .post(`/api/v1/invoices/${visitInvoice.id}/payments`)
          .set(bearer(rec))
          .set(idem())
          .send({ amountPaise: 100, method: 'cash' })
      ).status,
    ).toBe(422); // draft
    const issued = invoiceSchema.parse(
      (
        await request(api.app)
          .post(`/api/v1/invoices/${visitInvoice.id}/issue`)
          .set(bearer(rec))
          .send()
          .expect(200)
      ).body,
    );
    expect(issued.invoiceNo).toMatch(/^INV\/\d{4}-\d{2}\/\d{6}$/);
    expect(
      (
        await request(api.app)
          .post(`/api/v1/invoices/${visitInvoice.id}/payments`)
          .set(bearer(rec))
          .set(idem())
          .send({ amountPaise: issued.totalPaise + 1, method: 'cash' })
      ).status,
    ).toBe(422);
    const part = receiptSchema.parse(
      (
        await request(api.app)
          .post(`/api/v1/invoices/${visitInvoice.id}/payments`)
          .set(bearer(rec))
          .set(idem())
          .send({ amountPaise: 50_000, method: 'upi', reference: 'UPI-TEST-1' })
          .expect(201)
      ).body,
    );
    expect(part.receiptNo).toMatch(/^RCP\//);
    expect(part.balancePaise).toBe(issued.totalPaise - 50_000);
    const rest = receiptSchema.parse(
      (
        await request(api.app)
          .post(`/api/v1/invoices/${visitInvoice.id}/payments`)
          .set(bearer(fin))
          .set(idem())
          .send({ amountPaise: part.balancePaise, method: 'cash' })
          .expect(201)
      ).body,
    );
    expect(rest.balancePaise).toBe(0);
    expect(
      invoiceSchema.parse(
        (await request(api.app).get(`/api/v1/invoices/${visitInvoice.id}`).set(bearer(fin))).body,
      ).status,
    ).toBe('paid');
    expect(
      (
        await request(api.app)
          .get(`/api/v1/invoices/${visitInvoice.id}`)
          .set(bearer(doctor.session))
      ).status,
    ).toBe(403);

    // 13. Reception books the recommended follow-up.
    const fus = z
      .object({
        items: z.array(
          z.object({ id: z.string(), patient: z.object({ id: z.string() }), timing: z.string() }),
        ),
      })
      .parse(
        (await request(api.app).get('/api/v1/follow-ups?status=pending').set(bearer(rec))).body,
      )
      .items.filter((f) => f.patient.id === patient.id);
    expect(fus[0]?.timing).toBe('due');
    const fuSlot = await firstSlotTomorrow(api, rec, doctor.doctorId);
    const fuBooked = await request(api.app)
      .post('/api/v1/appointments')
      .set(bearer(rec))
      .set(idem())
      .send({
        patientId: patient.id,
        doctorId: doctor.doctorId,
        slotStart: fuSlot,
        followUpId: fus[0]?.id,
      });
    expect(fuBooked.status).toBe(201);
    expect(appointmentSchema.parse(fuBooked.body).kind).toBe('follow_up');

    // 14. Dashboards show the new figures from the database.
    const recDash = dashboardSchema.parse(
      (await request(api.app).get('/api/v1/dashboard').set(bearer(rec))).body,
    );
    expect(recDash.metrics.find((m) => m.key === 'arrived_today')?.value).toBeGreaterThan(0);
    const finDash = dashboardSchema.parse(
      (await request(api.app).get('/api/v1/dashboard').set(bearer(fin))).body,
    );
    expect(finDash.metrics.find((m) => m.key === 'collected_today')?.value).toBeGreaterThanOrEqual(
      issued.totalPaise,
    );

    // 15. Marketing never touches patient data.
    expect(
      (await request(api.app).get(`/api/v1/patients?q=${patient.mrn}`).set(bearer(mkt))).status,
    ).toBe(403);
    expect(
      (await request(api.app).get(`/api/v1/patients/${patient.id}/chart`).set(bearer(mkt))).status,
    ).toBe(403);
  });
});
