import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Can, useAbility } from '@/components/ability'
import { allows } from '@/lib/ability'
import { PageHeader, QueryBody } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { queryKeys } from '@/lib/query-keys.factory'
import { ApiError, api } from '@/queries/api'
import type { OrganizationSettings } from '@/queries/settings/interfaces/settings.dto'

export const Route = createFileRoute('/_authenticated/compliance/settings/')({
  component: SettingsPage,
})

function SettingsPage() {
  const client = useQueryClient()
  const canEdit = allows(useAbility(), 'manage', 'settings')
  const settings = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api<OrganizationSettings>({ method: 'GET', path: '/admin/settings/organization' }),
  })
  const [form, setForm] = useState<OrganizationSettings | null>(null)
  useEffect(() => {
    if (settings.data) setForm(settings.data)
  }, [settings.data])
  const save = useMutation({
    mutationFn: (body: OrganizationSettings) =>
      api<OrganizationSettings>({ method: 'PATCH', path: '/admin/settings/organization', body }),
    onSuccess: async (data) => {
      setForm(data)
      toast.success('Settings saved')
      await client.invalidateQueries({ queryKey: queryKeys.settings })
      await client.invalidateQueries({ queryKey: queryKeys.compliance.tests })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not save settings'),
  })
  return (
    <div>
      <PageHeader
        eyebrow="SETTINGS"
        title="Organization"
        description="Retention, legal entity, and policy versions. Anyone who can read compliance can view these. Only a super admin can edit them."
      />
      <QueryBody loading={settings.isLoading} error={settings.error}>
        {form ? (
          <form
            className="grid max-w-xl gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              save.mutate(form)
            }}
          >
            <Field label="Legal entity" disabled={!canEdit} value={form.legalEntityName} onChange={(legalEntityName) => setForm({ ...form, legalEntityName })} />
            <Field label="RC number" disabled={!canEdit} value={form.rcNumber} onChange={(rcNumber) => setForm({ ...form, rcNumber })} />
            <Field label="Tax id" disabled={!canEdit} value={form.taxId} onChange={(taxId) => setForm({ ...form, taxId })} />
            <Field
              label="Abandoned retention (days)"
              disabled={!canEdit}
              value={String(form.retentionAbandonedDays)}
              onChange={(value) => setForm({ ...form, retentionAbandonedDays: Number(value) || 0 })}
            />
            <Field
              label="Paid retention (days)"
              disabled={!canEdit}
              value={String(form.retentionPaidDays)}
              onChange={(value) => setForm({ ...form, retentionPaidDays: Number(value) || 0 })}
            />
            <Field label="Terms version" disabled={!canEdit} value={form.termsVersion} onChange={(termsVersion) => setForm({ ...form, termsVersion })} />
            <Field label="Privacy version" disabled={!canEdit} value={form.privacyVersion} onChange={(privacyVersion) => setForm({ ...form, privacyVersion })} />
            <Field label="Terms URL" disabled={!canEdit} value={form.termsUrl} onChange={(termsUrl) => setForm({ ...form, termsUrl })} />
            <Field label="Privacy URL" disabled={!canEdit} value={form.privacyUrl} onChange={(privacyUrl) => setForm({ ...form, privacyUrl })} />
            <Field
              label="Marketing policy URL"
              disabled={!canEdit}
              value={form.marketingPolicyUrl}
              onChange={(marketingPolicyUrl) => setForm({ ...form, marketingPolicyUrl })}
            />
            {canEdit ? null : (
              <p className="text-xs text-muted-foreground">Only a super admin can edit these settings.</p>
            )}
            <Can action="manage" subject="settings">
              <Button type="submit" disabled={save.isPending}>
                Save
              </Button>
            </Can>
          </form>
        ) : null}
      </QueryBody>
    </div>
  )
}

function Field({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
