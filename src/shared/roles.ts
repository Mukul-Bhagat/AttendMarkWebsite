export enum Role {
  PLATFORM_OWNER = 'PLATFORM_OWNER',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  STAFF = 'STAFF',
  USER = 'USER',
}

export const ALL_ROLES = Object.values(Role);

export enum RoleProfile {
  PLATFORM_OWNER = 'PLATFORM_OWNER',
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  MANAGER = 'MANAGER',
  SESSION_ADMIN = 'SESSION_ADMIN',
  END_USER = 'END_USER',
}

export interface RoleResolution {
  role: Role;
  roleProfile: RoleProfile;
  rawNormalized: string;
}

export class InvalidRoleError extends Error {
  constructor(input: string) {
    super(`Unknown role: "${input}"`);
    this.name = 'InvalidRoleError';
  }
}

const normalizeToken = (input: string): string =>
  input.trim().toLowerCase().replace(/[\s_-]+/g, '');

const ROLE_TOKEN_TO_PROFILE: Record<string, RoleProfile> = {
  platformowner: RoleProfile.PLATFORM_OWNER,
  superadmin: RoleProfile.SUPER_ADMIN,
  companyadmin: RoleProfile.COMPANY_ADMIN,
  manager: RoleProfile.MANAGER,
  sessionadmin: RoleProfile.SESSION_ADMIN,
  staff: RoleProfile.SESSION_ADMIN,
  enduser: RoleProfile.END_USER,
  user: RoleProfile.END_USER,
};

const ROLE_PROFILE_TO_CANONICAL_ROLE: Record<RoleProfile, Role> = {
  [RoleProfile.PLATFORM_OWNER]: Role.PLATFORM_OWNER,
  [RoleProfile.SUPER_ADMIN]: Role.COMPANY_ADMIN,
  [RoleProfile.COMPANY_ADMIN]: Role.COMPANY_ADMIN,
  [RoleProfile.MANAGER]: Role.STAFF,
  [RoleProfile.SESSION_ADMIN]: Role.STAFF,
  [RoleProfile.END_USER]: Role.USER,
};

const resolveCanonicalToken = (token: string): RoleProfile | undefined => {
  if (token === normalizeToken(Role.PLATFORM_OWNER)) {
    return RoleProfile.PLATFORM_OWNER;
  }
  if (token === normalizeToken(Role.COMPANY_ADMIN)) {
    return RoleProfile.COMPANY_ADMIN;
  }
  if (token === normalizeToken(Role.STAFF)) {
    return RoleProfile.SESSION_ADMIN;
  }
  if (token === normalizeToken(Role.USER)) {
    return RoleProfile.END_USER;
  }
  return undefined;
};

export function resolveRole(input: string): RoleResolution {
  const trimmed = (input || '').trim();
  const token = normalizeToken(trimmed);

  if (!token) {
    throw new InvalidRoleError(input);
  }

  const roleProfile =
    resolveCanonicalToken(token) ||
    ROLE_TOKEN_TO_PROFILE[token] ||
    (() => {
      throw new InvalidRoleError(input);
    })();

  return {
    role: ROLE_PROFILE_TO_CANONICAL_ROLE[roleProfile],
    roleProfile,
    rawNormalized: trimmed,
  };
}

export function normalizeRole(input: string): Role {
  return resolveRole(input).role;
}

export const isRoleAllowed = (
  currentRole: Role | string,
  allowed: Array<Role | RoleProfile | string>,
  currentRoleProfile?: RoleProfile,
): boolean => {
  const resolvedCurrent = resolveRole(String(currentRole));
  const profile = currentRoleProfile || resolvedCurrent.roleProfile;
  const canonicalRole = resolvedCurrent.role;

  return allowed.some((allowedRole) => {
    const rawAllowed = String(allowedRole).trim();
    const resolvedAllowed = resolveRole(rawAllowed);
    const isCanonicalAllowed = ALL_ROLES.some(
      (role) => role.toLowerCase() === rawAllowed.toLowerCase(),
    );

    if (isCanonicalAllowed) {
      return canonicalRole === resolvedAllowed.role;
    }

    return profile === resolvedAllowed.roleProfile;
  });
};

export const getRoleDisplayLabel = (rawRole: string): string => {
  try {
    const { roleProfile, role } = resolveRole(rawRole);
    if (role === Role.PLATFORM_OWNER) return 'Platform Owner';
    if (
      roleProfile === RoleProfile.SUPER_ADMIN ||
      roleProfile === RoleProfile.COMPANY_ADMIN
    ) {
      return 'Company Administrator';
    }
    if (roleProfile === RoleProfile.MANAGER) return 'Manager';
    if (roleProfile === RoleProfile.SESSION_ADMIN) return 'Session Administrator';
    return 'End User';
  } catch {
    return rawRole || 'Guest';
  }
};
