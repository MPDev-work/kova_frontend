import type { UserProfile } from '../types/marketplace';

export type DashboardPath = '/admin' | '/seller';

/**
 * Returns the target dashboard route for Root Admin or Store Owner accounts,
 * or null for standard customers and guests.
 */
export function getUserDashboardPath(
  user: UserProfile | null | undefined,
): DashboardPath | null {
  if (!user) return null;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (roles.includes('admin') || roles.includes('root_admin')) {
    return '/admin';
  }
  if (roles.includes('store_owner') || Boolean(user.store)) {
    return '/seller';
  }
  return null;
}
