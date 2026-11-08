export type Person = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type PersonPage = {
  items: Person[]
  total: number
  page: number
  limit: number
  pageCount: number
}

export type CreatePersonBody = {
  firstName: string
  lastName: string
  email: string
  phone?: string
  notes?: string
}

export type UpdatePersonBody = Partial<CreatePersonBody> & {
  phone?: string | null
  notes?: string | null
}
