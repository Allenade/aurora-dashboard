export type EmailBlock =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'image'; url: string; alt: string }
  | { id: string; type: 'button'; label: string; href: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'columns'; left: string; right: string }

export function blocksToHtml(blocks: EmailBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === 'heading') return `<h1>${escapeHtml(block.text)}</h1>`
      if (block.type === 'text') return `<p>${escapeHtml(block.text)}</p>`
      if (block.type === 'image') {
        return `<img src="${escapeHtml(block.url)}" alt="${escapeHtml(block.alt)}" />`
      }
      if (block.type === 'button') {
        return `<p><a href="${escapeHtml(block.href)}">${escapeHtml(block.label)}</a></p>`
      }
      if (block.type === 'divider') return '<hr />'
      return `<table><tr><td>${escapeHtml(block.left)}</td><td>${escapeHtml(block.right)}</td></tr></table>`
    })
    .join('\n')
}

export function blocksToText(blocks: EmailBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === 'heading' || block.type === 'text') return block.text
      if (block.type === 'button') return `${block.label} ${block.href}`
      if (block.type === 'image') return block.alt
      if (block.type === 'columns') return `${block.left} ${block.right}`
      return ''
    })
    .filter(Boolean)
    .join('\n\n')
}

export function missingImageAlt(blocks: EmailBlock[]) {
  return blocks.filter((block) => block.type === 'image' && !block.alt.trim())
}

export function htmlToBlocks(html: string): EmailBlock[] {
  if (typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks: EmailBlock[] = []
  const visit = (node: Element) => {
    const tag = node.tagName.toLowerCase()
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const text = (node.textContent ?? '').trim()
      if (text) blocks.push({ id: blockId(), type: 'heading', text })
      return
    }
    if (tag === 'hr') {
      blocks.push({ id: blockId(), type: 'divider' })
      return
    }
    if (tag === 'img') {
      blocks.push({
        id: blockId(),
        type: 'image',
        url: node.getAttribute('src') ?? '',
        alt: node.getAttribute('alt') ?? '',
      })
      return
    }
    if (tag === 'table') {
      const cells = Array.from(node.querySelectorAll('td')).slice(0, 2)
      blocks.push({
        id: blockId(),
        type: 'columns',
        left: (cells[0]?.textContent ?? '').trim(),
        right: (cells[1]?.textContent ?? '').trim(),
      })
      return
    }
    if (tag === 'p' || tag === 'div' || tag === 'a') {
      const link = tag === 'a' ? node : node.querySelector(':scope > a')
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
      const linkText = (link?.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (link && text === linkText) {
        const href = link.getAttribute('href') ?? ''
        const unsubscribe = href.includes('unsubscribe') || /unsubscribe/i.test(linkText)
        if (unsubscribe) {
          blocks.push({ id: blockId(), type: 'text', text: `${linkText} ${href}`.trim() })
        } else {
          blocks.push({ id: blockId(), type: 'button', label: linkText || 'Open', href })
        }
        return
      }
      if (tag === 'div') {
        for (const child of Array.from(node.children)) visit(child)
        if (!node.children.length && text) blocks.push({ id: blockId(), type: 'text', text })
        return
      }
      if (text) blocks.push({ id: blockId(), type: 'text', text })
      return
    }
    for (const child of Array.from(node.children)) visit(child)
  }
  for (const child of Array.from(doc.body.children)) visit(child)
  if (!blocks.length) {
    const text = (doc.body.textContent ?? '').trim()
    if (text) blocks.push({ id: blockId(), type: 'text', text })
  }
  return blocks
}

export function blockId() {
  return `b_${Math.random().toString(16).slice(2)}`
}

const PLACEHOLDER_PREVIEW: Record<string, string> = {
  '{{firstName}}': '[First name]',
  '{{lastName}}': '[Last name]',
  '{{track}}': '[Course]',
  '{{amount}}': '[Amount]',
  '{{reference}}': '[Reference]',
  '{{cutoffDate}}': '[Cutoff date]',
  '{{payLink}}': '[Payment link]',
  '{{unsubscribeUrl}}': '[Unsubscribe link]',
}

export function previewPlaceholders(html: string) {
  return Object.entries(PLACEHOLDER_PREVIEW).reduce(
    (value, [token, label]) => value.replaceAll(token, label),
    html,
  )
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
