export type ClaimDto = {
  id: string
  statement: string
  status: 'pass' | 'fail' | 'review'
  evidence: string
  owner: string
}

export type ClaimListDto = { items: ClaimDto[] }
