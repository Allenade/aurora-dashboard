export type UserType = 'buyer' | 'procurement' | 'admin' | 'vendor'

export type SessionRole = {
  id: string
  slug: string
  name: string
}

export type SessionPermission = {
  action: string
  resource: string
}

export type SessionRule = {
  action: string | string[]
  subject: string | string[]
  inverted?: boolean
}

export type SessionUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  type: UserType
  avatarUrl?: string | null
  roles: SessionRole[]
  permissions: SessionPermission[]
  rules: SessionRule[]
}

export type LoginResponse = {
  user: SessionUser
  redirectTo: string
  accessToken: string
  refreshToken: string
}

export type RefreshResponse = {
  accessToken: string
  refreshToken: string
}
