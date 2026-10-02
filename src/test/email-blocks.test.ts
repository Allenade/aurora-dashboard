import { describe, expect, it } from 'vitest'
import { blocksToHtml, htmlToBlocks, previewPlaceholders } from '@/lib/blocks'

describe('email blocks', () => {
  it('turns a saved template into heading, text, and button sections', () => {
    const blocks = htmlToBlocks(
      '<h1>Hello {{firstName}}</h1><p>Your {{track}} seat is {{amount}}. Reference {{reference}}.</p><p><a href="{{payLink}}">Pay</a></p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>',
    )
    expect(blocks.map((block) => block.type)).toEqual(['heading', 'text', 'button', 'text'])
    expect(blocks[2]).toMatchObject({ type: 'button', label: 'Pay', href: '{{payLink}}' })
    expect(blocksToHtml(blocks)).toContain('{{unsubscribeUrl}}')
    expect(blocksToHtml(blocks)).not.toContain('60000')
  })

  it('shows placeholders as readable labels in the preview', () => {
    const preview = previewPlaceholders(
      '<h1>Hello {{firstName}}</h1><p>Your {{track}} payment of {{amount}} is open.</p>',
    )
    expect(preview).toContain('[First name]')
    expect(preview).toContain('[Course]')
    expect(preview).toContain('[Amount]')
    expect(preview).not.toMatch(/Ada|Robotics/)
  })
})
