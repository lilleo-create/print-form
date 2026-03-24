import { canAccessAdmin, hasRequiredRole } from '../shared/lib/authAccess';

describe('authAccess helpers', () => {
  it('allows admin access from capabilities first', () => {
    expect(
      canAccessAdmin({
        role: 'buyer',
        capabilities: { canAccessAdmin: true },
      })
    ).toBe(true);
  });

  it('allows admin access from role flags and uppercase role', () => {
    expect(
      canAccessAdmin({
        role: 'ADMIN',
        roles: { isAdmin: true },
      })
    ).toBe(true);
  });

  it('normalizes role checks for required role', () => {
    expect(hasRequiredRole({ role: 'SELLER' }, 'seller')).toBe(true);
    expect(hasRequiredRole({ role: 'ADMIN' }, ['buyer', 'seller'])).toBe(false);
  });
});
