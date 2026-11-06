import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { maybeOne, one, run, transaction, type Db, type Executor } from '../db/sql';

/**
 * Synthetic hospital reference data for development and test databases (architecture §6.3): no
 * real people, products of real manufacturers are not implied, prices are illustrative. Idempotent:
 * existing rows (by code) are left as they are. Never run against a production database.
 */

const DEPARTMENTS = [
  { code: 'GENMED', name: 'General Medicine', clinical: true },
  { code: 'PAED', name: 'Paediatrics', clinical: true },
  { code: 'ORTHO', name: 'Orthopaedics', clinical: true },
  { code: 'DERM', name: 'Dermatology', clinical: true },
  { code: 'PHARMACY', name: 'Pharmacy', clinical: false },
  { code: 'LAB', name: 'Laboratory', clinical: false },
] as const;

const DOCTORS = [
  {
    no: 'DOC-SYN-01',
    name: 'Dr. Meera Iyer (synthetic)',
    dept: 'GENMED',
    specialty: 'General Medicine',
    reg: 'SYN-REG-1001',
    fee: 50_000,
    days: [1, 2, 3, 4, 5, 6],
    start: '09:00',
    end: '13:00',
    slot: 15,
  },
  {
    no: 'DOC-SYN-02',
    name: 'Dr. Arjun Rao (synthetic)',
    dept: 'PAED',
    specialty: 'Paediatrics',
    reg: 'SYN-REG-1002',
    fee: 60_000,
    days: [1, 3, 5],
    start: '10:00',
    end: '14:00',
    slot: 20,
  },
  {
    no: 'DOC-SYN-03',
    name: 'Dr. Kavya Nair (synthetic)',
    dept: 'ORTHO',
    specialty: 'Orthopaedics',
    reg: 'SYN-REG-1003',
    fee: 80_000,
    days: [2, 4, 6],
    start: '14:00',
    end: '18:00',
    slot: 20,
  },
  {
    no: 'DOC-SYN-04',
    name: 'Dr. Farhan Ali (synthetic)',
    dept: 'DERM',
    specialty: 'Dermatology',
    reg: 'SYN-REG-1004',
    fee: 70_000,
    days: [1, 2, 3, 4, 5],
    start: '16:00',
    end: '19:00',
    slot: 15,
  },
] as const;

const SERVICES = [
  { code: 'LAB-CBC', name: 'Complete blood count', kind: 'lab', price: 35_000, dept: 'LAB' },
  { code: 'LAB-FBS', name: 'Fasting blood sugar', kind: 'lab', price: 15_000, dept: 'LAB' },
  { code: 'LAB-LFT', name: 'Liver function test', kind: 'lab', price: 60_000, dept: 'LAB' },
  { code: 'LAB-LIPID', name: 'Lipid profile', kind: 'lab', price: 70_000, dept: 'LAB' },
  {
    code: 'PROC-DRESSING',
    name: 'Wound dressing',
    kind: 'procedure',
    price: 20_000,
    dept: 'GENMED',
  },
  { code: 'PROC-NEBULIZE', name: 'Nebulization', kind: 'procedure', price: 25_000, dept: 'PAED' },
] as const;

const LAB_TESTS = [
  {
    code: 'CBC',
    name: 'Complete blood count',
    sample: 'blood',
    service: 'LAB-CBC',
    tat: 6,
    parameters: [
      { name: 'Haemoglobin', unit: 'g/dL', low: 12, high: 16 },
      { name: 'Total WBC count', unit: '/µL', low: 4000, high: 11000 },
      { name: 'Platelet count', unit: '/µL', low: 150000, high: 450000 },
    ],
  },
  {
    code: 'FBS',
    name: 'Fasting blood sugar',
    sample: 'plasma',
    service: 'LAB-FBS',
    tat: 4,
    parameters: [{ name: 'Glucose (fasting)', unit: 'mg/dL', low: 70, high: 100 }],
  },
  {
    code: 'LFT',
    name: 'Liver function test',
    sample: 'serum',
    service: 'LAB-LFT',
    tat: 12,
    parameters: [
      { name: 'ALT', unit: 'U/L', low: 7, high: 56 },
      { name: 'AST', unit: 'U/L', low: 10, high: 40 },
      { name: 'Total bilirubin', unit: 'mg/dL', low: 0.1, high: 1.2 },
    ],
  },
  {
    code: 'LIPID',
    name: 'Lipid profile',
    sample: 'serum',
    service: 'LAB-LIPID',
    tat: 12,
    parameters: [
      { name: 'Total cholesterol', unit: 'mg/dL', low: null, high: 200 },
      { name: 'HDL cholesterol', unit: 'mg/dL', low: 40, high: null },
      { name: 'Triglycerides', unit: 'mg/dL', low: null, high: 150 },
    ],
  },
] as const;

type Batch = Readonly<{
  no: string;
  expiresInDays: number;
  qty: number;
  price: number;
  status?: 'recalled';
}>;
type Medicine = Readonly<{
  sku: string;
  brand: string;
  form: string;
  route: string;
  unit: string;
  pack: string;
  ingredients: readonly (readonly [string, number, string])[];
  batches: readonly Batch[];
}>;

const MEDICINES: readonly Medicine[] = [
  {
    sku: 'MED-PCM-500',
    brand: 'Paracip 500 (synthetic)',
    form: 'tablet',
    route: 'oral',
    unit: 'tablet',
    pack: '10 tablets',
    ingredients: [['Paracetamol', 500, 'mg']],
    batches: [
      { no: 'PCM-A1', expiresInDays: 400, qty: 500, price: 200 },
      { no: 'PCM-A0', expiresInDays: 45, qty: 60, price: 200 },
      { no: 'PCM-OLD', expiresInDays: -10, qty: 30, price: 200 },
    ],
  },
  {
    sku: 'MED-PCM-650',
    brand: 'Paracip 650 (synthetic)',
    form: 'tablet',
    route: 'oral',
    unit: 'tablet',
    pack: '15 tablets',
    ingredients: [['Paracetamol', 650, 'mg']],
    batches: [{ no: 'PCM6-B1', expiresInDays: 300, qty: 300, price: 300 }],
  },
  {
    sku: 'MED-AMX-500',
    brand: 'Amoxil-S 500 (synthetic)',
    form: 'capsule',
    route: 'oral',
    unit: 'capsule',
    pack: '10 capsules',
    ingredients: [['Amoxicillin', 500, 'mg']],
    batches: [
      { no: 'AMX-C1', expiresInDays: 200, qty: 200, price: 900 },
      { no: 'AMX-RC', expiresInDays: 250, qty: 100, price: 900, status: 'recalled' },
    ],
  },
  {
    sku: 'MED-CTZ-10',
    brand: 'Cetriz 10 (synthetic)',
    form: 'tablet',
    route: 'oral',
    unit: 'tablet',
    pack: '10 tablets',
    ingredients: [['Cetirizine', 10, 'mg']],
    batches: [{ no: 'CTZ-D1', expiresInDays: 500, qty: 400, price: 150 }],
  },
  {
    sku: 'MED-MET-500',
    brand: 'Glucomet 500 (synthetic)',
    form: 'tablet',
    route: 'oral',
    unit: 'tablet',
    pack: '20 tablets',
    ingredients: [['Metformin', 500, 'mg']],
    batches: [{ no: 'MET-E1', expiresInDays: 365, qty: 600, price: 250 }],
  },
  {
    sku: 'MED-AML-5',
    brand: 'Amlopress 5 (synthetic)',
    form: 'tablet',
    route: 'oral',
    unit: 'tablet',
    pack: '10 tablets',
    ingredients: [['Amlodipine', 5, 'mg']],
    batches: [{ no: 'AML-F1', expiresInDays: 420, qty: 300, price: 350 }],
  },
  {
    sku: 'MED-IBU-400',
    brand: 'Brufen-S 400 (synthetic)',
    form: 'tablet',
    route: 'oral',
    unit: 'tablet',
    pack: '10 tablets',
    ingredients: [['Ibuprofen', 400, 'mg']],
    batches: [{ no: 'IBU-G1', expiresInDays: 380, qty: 250, price: 280 }],
  },
  {
    sku: 'MED-PAR-SYR',
    brand: 'Paracip Syrup (synthetic)',
    form: 'syrup',
    route: 'oral',
    unit: 'bottle',
    pack: '60 ml bottle',
    ingredients: [['Paracetamol', 120, 'mg/5ml']],
    batches: [{ no: 'PSY-H1', expiresInDays: 220, qty: 40, price: 4500 }],
  },
];

const id = z.object({ id: z.uuid() });

async function departmentId(tx: Executor, code: string): Promise<string> {
  return (await one(tx, sql`select id from departments where code = ${code}`, id)).id;
}

export async function seedCatalogue(db: Db, nodeEnv: string | undefined): Promise<void> {
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new Error(
      'The synthetic catalogue exists only in development and test (NODE_ENV). Nothing was changed.',
    );
  }
  const database = await one(
    db,
    sql`select current_database() as name`,
    z.object({ name: z.string() }),
  );
  if (database.name !== 'hospitalos_dev' && database.name !== 'hospitalos_test') {
    throw new Error(
      'The synthetic catalogue is refused outside hospitalos_dev and hospitalos_test.',
    );
  }

  await transaction(db, async (tx) => {
    for (const d of DEPARTMENTS) {
      await run(
        tx,
        sql`insert into departments (code, name, is_clinical) values (${d.code}, ${d.name}, ${d.clinical}) on conflict (code) do nothing`,
      );
    }
    for (const [code, name, kind] of [
      ['PHARMACY-MAIN', 'Main pharmacy', 'pharmacy'],
      ['STORE-MAIN', 'Main store', 'store'],
      ['LAB-MAIN', 'Main laboratory', 'lab'],
    ] as const) {
      await run(
        tx,
        sql`insert into locations (code, name, kind) values (${code}, ${name}, ${kind}) on conflict (code) do nothing`,
      );
    }

    for (const doc of DOCTORS) {
      const existing = await maybeOne(
        tx,
        sql`select id from employees where employee_no = ${doc.no}`,
        id,
      );
      const employeeId =
        existing?.id ??
        (
          await one(
            tx,
            sql`insert into employees (employee_no, full_name, department_id, designation)
              values (${doc.no}, ${doc.name}, ${await departmentId(tx, doc.dept)}, 'Consultant') returning id`,
            id,
          )
        ).id;
      const profile = await maybeOne(
        tx,
        sql`select id from doctor_profiles where employee_id = ${employeeId}`,
        id,
      );
      if (profile) continue;
      const created = await one(
        tx,
        sql`insert into doctor_profiles (employee_id, department_id, specialty, registration_no, default_slot_minutes, consultation_fee_paise)
            values (${employeeId}, ${await departmentId(tx, doc.dept)}, ${doc.specialty}, ${doc.reg}, ${doc.slot}, ${doc.fee})
            returning id`,
        id,
      );
      for (const weekday of doc.days) {
        await run(
          tx,
          sql`insert into doctor_schedules (doctor_id, weekday, start_time, end_time, slot_minutes, valid_from)
              values (${created.id}, ${weekday}, ${doc.start}::time, ${doc.end}::time, ${doc.slot}, date '2026-01-01')`,
        );
      }
    }

    for (const s of SERVICES) {
      await run(
        tx,
        sql`insert into service_catalogue (code, name, kind, price_paise, department_id)
            values (${s.code}, ${s.name}, ${s.kind}, ${s.price}, ${await departmentId(tx, s.dept)})
            on conflict (code) do nothing`,
      );
    }

    for (const t of LAB_TESTS) {
      const exists = await maybeOne(tx, sql`select id from lab_tests where code = ${t.code}`, id);
      if (exists) continue;
      const service = await one(
        tx,
        sql`select id from service_catalogue where code = ${t.service}`,
        id,
      );
      const test = await one(
        tx,
        sql`insert into lab_tests (code, name, sample_type, service_id, turnaround_hours)
            values (${t.code}, ${t.name}, ${t.sample}, ${service.id}, ${t.tat}) returning id`,
        id,
      );
      for (const [index, p] of t.parameters.entries()) {
        await run(
          tx,
          sql`insert into lab_test_parameters (test_id, name, unit, ref_low, ref_high, sort_order)
              values (${test.id}, ${p.name}, ${p.unit}, ${p.low}, ${p.high}, ${index})`,
        );
      }
    }

    const pharmacy = await one(tx, sql`select id from locations where code = 'PHARMACY-MAIN'`, id);
    for (const m of MEDICINES) {
      const exists = await maybeOne(tx, sql`select id from stock_items where sku = ${m.sku}`, id);
      if (exists) continue;
      const item = await one(
        tx,
        sql`insert into stock_items (sku, kind, name, base_unit, reorder_level)
            values (${m.sku}, 'medicine', ${m.brand}, ${m.unit}, 50) returning id`,
        id,
      );
      await run(
        tx,
        sql`insert into medicine_products (stock_item_id, brand_name, manufacturer, dosage_form, route, pack_size)
            values (${item.id}, ${m.brand}, 'Synthetic Pharma Ltd (fictional)', ${m.form}, ${m.route}, ${m.pack})`,
      );
      for (const [name, value, unit] of m.ingredients) {
        await run(
          tx,
          sql`insert into ingredients (name) values (${name}) on conflict (name) do nothing`,
        );
        await run(
          tx,
          sql`insert into product_ingredients (product_id, ingredient_id, strength_value, strength_unit)
              select ${item.id}, id, ${value}, ${unit} from ingredients where name = ${name}`,
        );
      }
      for (const b of m.batches) {
        const batch = await one(
          tx,
          sql`insert into stock_batches (stock_item_id, location_id, batch_no, expiry_date, unit_cost_paise, sale_price_paise, qty_on_hand, status)
              values (${item.id}, ${pharmacy.id}, ${b.no}, current_date + ${b.expiresInDays}::int,
                      ${Math.round(b.price * 0.7)}, ${b.price}, ${b.qty}, ${b.status ?? 'active'})
              returning id`,
          id,
        );
        await run(
          tx,
          sql`insert into stock_movements (batch_id, kind, qty, balance_after, reason, ref_type, actor_label)
              values (${batch.id}, 'receipt', ${b.qty}, ${b.qty}, 'Synthetic opening stock', 'seed', 'seed:catalogue')`,
        );
      }
    }
  });
}
