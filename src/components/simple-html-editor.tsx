import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { escapeAttr, htmlToText } from '@/lib/email-compose'
import { uploadEmailImage } from '@/lib/upload-email-image'
import { cn } from 'cn'

export function SimpleHtmlEditor({
  label,
  value,
  onChange,
  placeholder = 'Write the message',
  readOnly = false,
  className,
}: {
  label: string
  value: string
  onChange: (html: string) => void
  placeholder?: string
  readOnly?: boolean
  className?: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const fileId = useId()
  const [focused, setFocused] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('https://')
  const [uploading, setUploading] = useState(false)
  const empty = !htmlToText(value)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (document.activeElement === editor) return
    if (editor.innerHTML !== value) editor.innerHTML = value
  }, [value])

  function emit() {
    onChange(editorRef.current?.innerHTML ?? '')
  }

  function run(command: string, argument?: string) {
    editorRef.current?.focus()
    document.execCommand(command, false, argument)
    emit()
  }

  function applyLink() {
    const url = linkUrl.trim()
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
      toast.error('Use a full link, starting with https://')
      return
    }
    const selection = window.getSelection()
    const collapsed = !selection || selection.isCollapsed
    if (collapsed) {
      run('insertHTML', `<a href="${escapeAttr(url)}">${escapeAttr(url)}</a>`)
    } else {
      run('createLink', url)
    }
    setLinkOpen(false)
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-black',
        className,
      )}
    >
      {readOnly ? null : (
        <div className="flex flex-wrap gap-1 border-b border-border p-1.5">
          <Button type="button" size="xs" variant="outline" onClick={() => run('bold')}>
            Bold
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => run('italic')}
          >
            Italic
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => run('insertUnorderedList')}
          >
            List
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setLinkOpen((open) => !open)}
          >
            Link
          </Button>
          <input
            id={fileId}
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setUploading(true)
              void uploadEmailImage(file)
                .then((url) => {
                  if (!url) return
                  run('insertHTML', `<img src="${escapeAttr(url)}" alt="" />`)
                })
                .finally(() => setUploading(false))
            }}
          />
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={uploading}
            render={<label htmlFor={fileId} />}
          >
            {uploading ? 'Uploading' : 'Image'}
          </Button>
        </div>
      )}
      {linkOpen && !readOnly ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
          <Input
            aria-label="Link address"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://"
          />
          <Button type="button" size="sm" variant="outline" onClick={applyLink}>
            Add link
          </Button>
        </div>
      ) : null}
      <div className="relative">
        {empty && !focused ? (
          <span className="pointer-events-none absolute top-2 left-3 text-sm text-muted-foreground">
            {placeholder}
          </span>
        ) : null}
        <div
          ref={editorRef}
          role="textbox"
          aria-label={label}
          aria-multiline="true"
          contentEditable={!readOnly}
          suppressContentEditableWarning
          className="min-h-36 px-3 py-2 text-sm outline-none [&_a]:text-primary [&_img]:my-2 [&_img]:max-w-full [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            emit()
          }}
          onInput={emit}
        />
      </div>
    </div>
  )
}
