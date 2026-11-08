export type InviteOfferType = 'discount_percent' | 'discount_fixed' | 'free'
export type InviteTrackScope = 'all' | 'selected'

export type InvitePerson = {
  id: string
  firstName: string
  lastName: string
  email: string
}

export type Invite = {
  id: string
  code: string
  label: string | null
  personId: string | null
  person: InvitePerson | null
  lockToPerson: boolean
  offerType: InviteOfferType
  discountPercent: number | null
  discountAmount: number | null
  trackScope: InviteTrackScope
  trackSlugs: string[]
  maxRedemptions: number | null
  redemptionCount: number
  expiresAt: string | null
  active: boolean
  notes: string | null
  discountLabel: string
  enrollUrl: string
  createdAt: string
  updatedAt: string
}

export type InvitePage = {
  items: Invite[]
  total: number
  page: number
  limit: number
  pageCount: number
}

export type CreateInviteBody = {
  label?: string
  personId?: string
  lockToPerson?: boolean
  offerType: InviteOfferType
  discountPercent?: number
  discountAmount?: number
  trackScope?: InviteTrackScope
  trackSlugs?: string[]
  maxRedemptions?: number
  expiresAt?: string
  notes?: string
}

export type UpdateInviteBody = {
  label?: string | null
  active?: boolean
  lockToPerson?: boolean
  maxRedemptions?: number | null
  expiresAt?: string | null
  notes?: string | null
}
