/** Account from GET /users when page and limit are omitted. */
export type AdminUser = {
  id: string
  name: string
  email: string
  company: string
  type: string
  status: string
  initials: string
  orders: number
  totalSpent: string
  joined: string
  joinedIso: string
  verified: boolean
}
