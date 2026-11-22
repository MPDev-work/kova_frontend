import type { UserProfile } from '../types/marketplace';

export type DashboardPath = '/admin' | '/seller';

/**
 * Returns the target dashboard route for Root Admin or approved Store Owner accounts,
 * or null for standard customers, guests, and pending/rejected seller applicants.
 */
export function getUserDashboardPath(
  user: UserProfile | null | undefined,
): DashboardPath | null {
  if (!user) return null;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (roles.includes('admin') || roles.includes('root_admin')) {
    return '/admin';
  }
  // Pending or rejected seller applicants remain customers until approved by Admin
  if (
    user.store?.status === 'approved' ||
    user.store?.status === 'suspended'
  ) {
    return '/seller';
  }
  if (roles.includes('store_owner') && !user.store) {
    return '/seller';
  }
  return null;
}
