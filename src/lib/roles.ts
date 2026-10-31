import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Chat role badge icon. Team leads get a shield to set them apart from plain
 * managers (headphones); drivers get a person. Mirrors the web chat, which
 * marks team leads with a shield too. Keep this the single source of truth so
 * every chat surface renders the same marker for a given role.
 */
export function roleBadgeIcon(role?: string | null): IoniconName {
  if (role === 'TEAMLEAD') return 'shield-outline';
  if (role === 'DRIVER') return 'person-outline';
  return 'headset-outline';
}

const ROLE_RANK: Record<string, number> = {
  DRIVER: 0,
  MANAGER: 1,
  TEAMLEAD: 2,
  ADMIN: 3,
};

/**
 * Mirror of the backend's user-management rule (is-fleet-backend
 * src/common/utils/role-rank.ts): DRIVER < MANAGER < TEAMLEAD < ADMIN. You
 * may edit, deactivate or reactivate only users ranked below you; ADMIN
 * accounts only as ADMIN; never yourself. The server enforces it — this
 * only hides actions it would refuse.
 */
export function canManageUser(
  me: { id: string; role: string } | null | undefined,
  target: { id: string; role: string } | null | undefined,
): boolean {
  if (!me || !target || me.id === target.id) return false;
  if (target.role === 'ADMIN') return me.role === 'ADMIN';
  const mine = ROLE_RANK[me.role];
  const theirs = ROLE_RANK[target.role];
  if (mine === undefined || theirs === undefined) return false;
  return mine > theirs;
}
