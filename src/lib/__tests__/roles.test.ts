import { describe, expect, it } from 'vitest';
import { canManageUser } from '../roles';

// Same matrix as the backend's role-rank.spec.ts.
describe('canManageUser', () => {
  const ROLES = ['DRIVER', 'MANAGER', 'TEAMLEAD', 'ADMIN'] as const;
  const expected: Record<string, Record<string, boolean>> = {
    DRIVER: { DRIVER: false, MANAGER: false, TEAMLEAD: false, ADMIN: false },
    MANAGER: { DRIVER: true, MANAGER: false, TEAMLEAD: false, ADMIN: false },
    TEAMLEAD: { DRIVER: true, MANAGER: true, TEAMLEAD: false, ADMIN: false },
    ADMIN: { DRIVER: true, MANAGER: true, TEAMLEAD: true, ADMIN: true },
  };

  for (const me of ROLES) {
    for (const target of ROLES) {
      it(`${me} → ${target}`, () => {
        expect(canManageUser({ id: 'a', role: me }, { id: 'b', role: target })).toBe(
          expected[me][target],
        );
      });
    }
  }

  it('never yourself; nothing without a signed-in user', () => {
    expect(canManageUser({ id: 'a', role: 'ADMIN' }, { id: 'a', role: 'MANAGER' })).toBe(false);
    expect(canManageUser(null, { id: 'b', role: 'DRIVER' })).toBe(false);
  });
});
