import { PERMISSIONS, ROLE_CODES, signInRequestSchema } from '@hospitalos/contracts';

describe('@hospitalos/contracts in the app', () => {
  it('loads the canonical catalogue and schemas', () => {
    expect(PERMISSIONS).toHaveLength(88);
    expect(ROLE_CODES).toHaveLength(11);
    expect(
      signInRequestSchema.safeParse({ username: 'a', password: 'b', deviceLabel: 'c' }).success,
    ).toBe(true);
  });
});
