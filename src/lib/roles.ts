import type {
  SessionPermission,
  SessionRule,
  SessionUser,
} from '@/queries/auth/interfaces/session.dto'

export type AppRole = 'compliance_viewer' | 'compliance_manager' | 'super_admin'

const ROLE_LABEL: Record<AppRole, string> = {
  compliance_viewer: 'Compliance Viewer',
  compliance_manager: 'Compliance Manager',
  super_admin: 'Super Admin',
}

export function roleLabel(role: AppRole) {
  return ROLE_LABEL[role]
}

const READ_RESOURCES = [
  'enter_first',
  'course',
  'email',
  'refund',
  'audit',
  'compliance',
] as const

export function permissionsForRole(role: AppRole): SessionPermission[] {
  if (role === 'super_admin') return [{ action: 'manage', resource: 'all' }]

  const permissions: SessionPermission[] = []
  for (const resource of READ_RESOURCES) {
    permissions.push({ action: 'read', resource }, { action: 'list', resource })
  }

  if (role === 'compliance_manager') {
    permissions.push(
      { action: 'update', resource: 'enter_first' },
      { action: 'create', resource: 'refund' },
      { action: 'update', resource: 'refund' },
      { action: 'create', resource: 'email' },
      { action: 'update', resource: 'email' },
      { action: 'create', resource: 'compliance' },
      { action: 'update', resource: 'compliance' },
    )
  }

  return permissions
}

export function rulesForRole(role: AppRole): SessionRule[] {
  return permissionsForRole(role).map((permission) => ({
    action: permission.action,
    subject: permission.resource,
  }))
}

export function sessionUser(input: {
  id: string
  email: string
  firstName: string
  lastName: string
  role: AppRole
}): SessionUser {
  return {
    id: input.id,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    type: 'admin',
    avatarUrl: null,
    roles: [{ id: `role_${input.role}`, slug: input.role, name: roleLabel(input.role) }],
    permissions: permissionsForRole(input.role),
    rules: rulesForRole(input.role),
  }
}
