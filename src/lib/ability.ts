import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from '@casl/ability'
import type { SessionRule, SessionUser } from '@/queries/auth/interfaces/session.dto'

export const ACTIONS = [
  'read',
  'list',
  'create',
  'update',
  'delete',
  'manage',
] as const

/** Resources from the Core 3.0 permission enum. */
export const SUBJECTS = [
  'all',
  'enter_first',
  'course',
  'email',
  'refund',
  'audit',
  'compliance',
  'settings',
] as const

export type AppAction = (typeof ACTIONS)[number]
export type AppSubject = (typeof SUBJECTS)[number]
export type AppAbility = MongoAbility<[AppAction, AppSubject]>

const ACTION_SET = new Set<string>(ACTIONS)
const SUBJECT_SET = new Set<string>(SUBJECTS)

export function defineAbilityFor(user: SessionUser | null): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility)
  for (const rule of user?.rules ?? []) {
    const actions = toList(rule.action).filter((item): item is AppAction =>
      ACTION_SET.has(item),
    )
    const subjects = toList(rule.subject).filter((item): item is AppSubject =>
      SUBJECT_SET.has(item),
    )
    for (const action of actions) {
      for (const subject of subjects) {
        if (rule.inverted) cannot(action, subject)
        else can(action, subject)
      }
    }
  }
  return build()
}

export function allows(
  ability: AppAbility,
  action: AppAction,
  subject: AppSubject,
) {
  if (ability.can('manage', 'all')) return true
  if (ability.can('manage', subject)) return true
  return ability.can(action, subject)
}

/** Same rule as PiiAccessService.shouldMaskPii. */
export function shouldMaskPii(user: SessionUser | null) {
  const ability = defineAbilityFor(user)
  const revealed =
    allows(ability, 'update', 'enter_first') || allows(ability, 'manage', 'enter_first')
  return !revealed
}

export function isViewer(user: SessionUser | null) {
  return user?.roles.some((role) => role.slug === 'compliance_viewer') ?? false
}

function toList(value: string | string[]) {
  return Array.isArray(value) ? value : [value]
}

export type { SessionRule }
