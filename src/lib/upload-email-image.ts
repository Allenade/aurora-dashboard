import { toast } from 'sonner'
import { UNREACHABLE_MESSAGE } from '@/services/api/api.error'

export async function uploadEmailImage(file: File) {
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Pictures must be 5 MB or smaller.')
    return null
  }
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) {
    toast.error('Use a JPEG, PNG, WebP, or GIF picture.')
    return null
  }
  try {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch('/api/bff/admin/emails/images', {
      method: 'POST',
      body: form,
      credentials: 'include',
    })
    const payload = (await response.json().catch(() => null)) as {
      publicUrl?: string
      message?: string
    } | null
    if (!response.ok || !payload?.publicUrl) {
      toast.error(payload?.message || 'The picture did not upload')
      return null
    }
    return payload.publicUrl
  } catch {
    toast.error(UNREACHABLE_MESSAGE)
    return null
  }
}
