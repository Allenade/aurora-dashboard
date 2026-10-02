export type InventoryRow = {
  id: string
  system: string
  fields: string
  purpose: string
  retention: string
}

export type DataRequestRow = {
  id: string
  type: 'access' | 'correction' | 'deletion'
  enrollee: string
  email: string
  status: 'queued' | 'in_progress' | 'fulfilled' | 'rejected'
  due: string
}

export type RetentionRow = {
  id: string
  record: string
  keep: string
  basis: string
}

export type DataRequestOverview = {
  inventory: InventoryRow[]
  requests: DataRequestRow[]
  retention: RetentionRow[]
}
