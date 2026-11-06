import { describe, expect, it } from 'vitest';

import { createPool } from '../src/db/client';

// No database needed: the pool connects lazily, and these tests only emit events.
const unused = 'unused';
const URL_WITHOUT_SERVER = `postgres://nobody:${unused}@127.0.0.1:1/hospitalos_test`;

describe('createPool', () => {
  it('survives an idle-connection error instead of crashing the process', async () => {
    const pool = createPool(URL_WITHOUT_SERVER, 1);
    expect(() => pool.emit('error', new Error('terminating connection'))).not.toThrow();
    await pool.end();
  });

  it('passes idle-connection errors to the handler', async () => {
    const seen: (string | undefined)[] = [];
    const pool = createPool(URL_WITHOUT_SERVER, 1, (error) => seen.push(error.code));
    pool.emit('error', Object.assign(new Error('terminating connection'), { code: '57P01' }));
    expect(seen).toEqual(['57P01']);
    await pool.end();
  });
});
