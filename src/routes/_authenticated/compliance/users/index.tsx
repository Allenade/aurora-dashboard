import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { useSessionUser } from '@/components/ability'
import { DataTable, type Column } from '@/components/data-tables/data-table'
import { EmptyState, PageHeader, QueryBody } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { isSuperAdmin } from '@/lib/ability'
import { formatWatDate } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys.factory'
import { ApiError, api } from '@/queries/api'
import type { AdminUser } from '@/queries/users/interfaces/user.dto'
import type { SessionUser } from '@/queries/auth/interfaces/session.dto'

export const Route = createFileRoute('/_authenticated/compliance/users/')({
  component: UsersPage,
})

/** Live directory. Omitting page and limit returns a plain array. */
const LIST_USERS_PATH = '/users'

/** Super admin delete. Matches DELETE /admin/users/:id. */
function deleteUserPath(id: string) {
  return `/admin/users/${id}`
}

function UsersPage() {
  const signedIn = useSessionUser()
  const canDelete = isSuperAdmin(signedIn)
  const queryClient = useQueryClient()
  const users = useQuery({
    queryKey: queryKeys.users.all,
    enabled: canDelete,
    queryFn: () => api<AdminUser[]>({ method: 'GET', path: LIST_USERS_PATH }),
  })
  const [pending, setPending] = useState<AdminUser | null>(null)

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ ok?: boolean }>({ method: 'DELETE', path: deleteUserPath(id) }),
    onSuccess: async () => {
      toast.success('User deleted')
      setPending(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the user'),
  })

  const columns: Column<AdminUser>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => userTypeLabel(row.original.type),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => userStatusLabel(row.original.status),
    },
    {
      id: 'joined',
      header: 'Joined',
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {formatWatDate(row.original.joinedIso)}
        </span>
      ),
    },
    ...(canDelete
      ? [
          {
            id: 'delete',
            header: '',
            cell: ({ row }: { row: { original: AdminUser } }) => {
              if (isOwnAccount(row.original, signedIn)) {
                return (
                  <span className="text-xs text-muted-foreground">
                    This is your account
                  </span>
                )
              }
              return (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  aria-label={`Delete ${row.original.name}`}
                  onClick={() => setPending(row.original)}
                >
                  Delete
                </Button>
              )
            },
          } satisfies Column<AdminUser>,
        ]
      : []),
  ]

  return (
    <div>
      <PageHeader
        eyebrow="USERS"
        title="Users"
        description="Accounts that can sign in. Deleting an account removes it. This cannot be undone."
      />
      {canDelete ? (
        <QueryBody loading={users.isLoading} error={users.error}>
          {users.data ? (
            users.data.length ? (
              <DataTable columns={columns} data={users.data} />
            ) : (
              <EmptyState title="No users yet" body="Accounts will show up here." />
            )
          ) : null}
        </QueryBody>
      ) : (
        <EmptyState
          title="Super admin only"
          body="Only a super admin can manage users."
        />
      )}
      <Dialog
        open={pending != null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this user?</DialogTitle>
            <DialogDescription>
              {pending
                ? `${pending.name} will be removed. This cannot be undone.`
                : 'This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending || pending == null}
              onClick={() => {
                if (pending) remove.mutate(pending.id)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function isOwnAccount(
  account: { id: string; email: string },
  signedIn: SessionUser | null,
) {
  if (!signedIn) return false
  if (account.id === signedIn.id) return true
  return account.email.trim().toLowerCase() === signedIn.email.trim().toLowerCase()
}

function userTypeLabel(type: string) {
  if (type === 'buyer') return 'Buyer'
  if (type === 'procurement') return 'Procurement'
  if (type === 'admin') return 'Admin'
  if (type === 'vendor') return 'Vendor'
  return type
}

function userStatusLabel(status: string) {
  if (status === 'ACTIVE' || status === 'active') return 'Active'
  if (status === 'Suspended' || status === 'suspended') return 'Suspended'
  return status
}
