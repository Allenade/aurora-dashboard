export type MinorRow = {
  id: string
  name: string
  email: string
  age: number
  tracks: string[]
  guardianStatus: 'captured' | 'unknown'
  reference: string
}

export type MinorListDto = {
  items: MinorRow[]
  total: number
  missingGuardian: number
}
