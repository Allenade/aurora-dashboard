import { cn } from 'cn'
import { useAbility } from '@/components/ability'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { allows } from '@/lib/ability'
import {
  courseLinkError,
  isHttpsLink,
  LINK_NAME_REQUIRED,
  LINK_URL_INVALID,
  moveLink,
  newLinkKey,
  type CourseLinkDraft,
} from '@/lib/course-links'

export function CourseLinksEditor({
  value,
  onChange,
}: {
  value: CourseLinkDraft[]
  onChange: (next: CourseLinkDraft[]) => void
}) {
  const ability = useAbility()
  const canUpdate = allows(ability, 'update', 'course')

  return (
    <section className="space-y-3 rounded-md border border-border px-3 py-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Links</h3>
        <p className="text-xs text-muted-foreground">
          Shown as buttons on the website. Each one opens in a new tab.
        </p>
      </div>
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">No links yet.</p>
      ) : (
        <ul className="space-y-3">
          {value.map((row, index) => (
            <CourseLinkRow
              key={row.key}
              row={row}
              index={index}
              total={value.length}
              canUpdate={canUpdate}
              onChange={(next) =>
                onChange(value.map((item) => (item.key === row.key ? next : item)))
              }
              onMove={(direction) => onChange(moveLink(value, index, direction))}
              onRemove={() => onChange(value.filter((item) => item.key !== row.key))}
            />
          ))}
        </ul>
      )}
      {canUpdate ? (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange([...value, { key: newLinkKey(), label: '', url: '' }])
          }
        >
          + Add another link
        </Button>
      ) : null}
    </section>
  )
}

function CourseLinkRow({
  row,
  index,
  total,
  canUpdate,
  onChange,
  onMove,
  onRemove,
}: {
  row: CourseLinkDraft
  index: number
  total: number
  canUpdate: boolean
  onChange: (next: CourseLinkDraft) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}) {
  const name = row.label.trim() || `link ${index + 1}`
  const url = row.url.trim()
  const problem = courseLinkError(row)
  const openable = isHttpsLink(url)

  return (
    <li className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      {canUpdate ? (
        <div className="grid gap-2">
          <Input
            aria-label={`Button name ${index + 1}`}
            aria-invalid={problem === LINK_NAME_REQUIRED || undefined}
            placeholder="Button name"
            autoComplete="off"
            value={row.label}
            onChange={(event) => onChange({ ...row, label: event.target.value })}
          />
          <Input
            aria-label={`Link address ${index + 1}`}
            aria-invalid={problem === LINK_URL_INVALID || undefined}
            placeholder="https://"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={row.url}
            onChange={(event) => onChange({ ...row, url: event.target.value })}
          />
        </div>
      ) : (
        <div className="space-y-0.5">
          <p className="text-sm">{row.label.trim() || 'Untitled link'}</p>
          {url ? (
            <p className="break-all text-xs text-muted-foreground">{url}</p>
          ) : null}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {openable ? (
          <a
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${name}`}
          >
            Open
          </a>
        ) : null}
        {canUpdate ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={`Move ${name} up`}
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              Up
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={`Move ${name} down`}
              disabled={index === total - 1}
              onClick={() => onMove(1)}
            >
              Down
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Remove ${name}`}
              onClick={onRemove}
            >
              ×
            </Button>
          </>
        ) : null}
      </div>
      {canUpdate && problem ? (
        <p className="text-sm text-destructive">{problem}</p>
      ) : null}
    </li>
  )
}
