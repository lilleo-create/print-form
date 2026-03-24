import type { Role, User } from '../types';

type UserRoleFlags = {
  isAdmin?: boolean;
  isSeller?: boolean;
  isBuyer?: boolean;
};

type UserCapabilities = {
  canAccessAdmin?: boolean;
  canAccessSeller?: boolean;
};

type UserLike = Pick<User, 'role'> & {
  roles?: UserRoleFlags | null;
  capabilities?: UserCapabilities | null;
};

export const normalizeRole = (role?: string | null): Role => {
  const normalized = (role ?? '').toLowerCase();
  if (normalized === 'admin') {
    return 'admin';
  }
  if (normalized === 'seller') {
    return 'seller';
  }
  return 'buyer';
};

export const canAccessAdmin = (user?: UserLike | null): boolean => {
  if (!user) {
    return false;
  }
  if (user.capabilities?.canAccessAdmin === true) {
    return true;
  }
  if (user.roles?.isAdmin === true) {
    return true;
  }
  return normalizeRole(user.role) === 'admin';
};

export const hasRequiredRole = (user: UserLike | null | undefined, requiredRole: Role | Role[]): boolean => {
  if (!user) {
    return false;
  }

  const required = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const normalizedRole = normalizeRole(user.role);
  return required.includes(normalizedRole);
};
