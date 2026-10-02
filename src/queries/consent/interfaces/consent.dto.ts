export type PolicyDto = {
  id: string
  name: string
  status: 'draft' | 'published'
  url: string
  updatedAt: string
}

export type ConsentOverview = {
  captured: number
  missing: number
  marketingOptIn: number
  policies: PolicyDto[]
}
