import { describe, expect, it } from 'vitest';

import {
  Capability,
  canAdjustAttendance,
  canViewAudit,
  hasCapability,
} from '../utils/capabilities';
import {
  InvalidRoleError,
  Role,
  RoleProfile,
  isRoleAllowed,
  normalizeRole,
  resolveRole,
} from './roles';

describe('Client Role and Permission Utilities', () => {
  it('maps canonical and legacy role values correctly', () => {
    expect(normalizeRole('PLATFORM_OWNER')).toBe(Role.PLATFORM_OWNER);
    expect(normalizeRole('SuperAdmin')).toBe(Role.COMPANY_ADMIN);
    expect(normalizeRole('Manager')).toBe(Role.STAFF);
    expect(normalizeRole('EndUser')).toBe(Role.USER);

    const resolvedManager = resolveRole('Manager');
    expect(resolvedManager.role).toBe(Role.STAFF);
    expect(resolvedManager.roleProfile).toBe(RoleProfile.MANAGER);
  });

  it('enforces capability-based permission logic', () => {
    expect(hasCapability({ role: 'CompanyAdmin' }, Capability.ATTENDANCE_ADJUST)).toBe(true);
    expect(hasCapability({ role: 'EndUser' }, Capability.ATTENDANCE_ADJUST)).toBe(false);
    expect(canAdjustAttendance({ role: 'PLATFORM_OWNER' })).toBe(true);
    expect(canViewAudit({ role: 'Manager' })).toBe(true);
  });

  it('uses explicit capability arrays when present', () => {
    const userWithScopedCaps = {
      role: 'EndUser',
      capabilities: [Capability.ATTENDANCE_VIEW],
    };

    expect(hasCapability(userWithScopedCaps, Capability.ATTENDANCE_VIEW)).toBe(true);
    expect(hasCapability(userWithScopedCaps, Capability.ATTENDANCE_ADJUST)).toBe(false);
  });

  it('applies guard logic for allowed role sets', () => {
    expect(isRoleAllowed('Manager', [RoleProfile.MANAGER])).toBe(true);
    expect(isRoleAllowed('CompanyAdmin', [Role.COMPANY_ADMIN])).toBe(true);
    expect(isRoleAllowed('EndUser', [Role.COMPANY_ADMIN, RoleProfile.MANAGER])).toBe(false);
  });

  it('throws InvalidRoleError for unknown roles', () => {
    expect(() => resolveRole('UnknownRole')).toThrow(InvalidRoleError);
    expect(() => normalizeRole('??')).toThrow('Unknown role');
  });
});
