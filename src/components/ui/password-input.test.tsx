import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PasswordInput } from '@/components/ui/password-input'

describe('PasswordInput', () => {
  it('toggles between a hidden and visible password', async () => {
    const user = userEvent.setup()
    render(
      <>
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" defaultValue="secret" />
      </>,
    )

    const field = screen.getByLabelText('Password')
    expect(field).toHaveAttribute('type', 'password')

    const toggle = screen.getByRole('button', { name: 'Show password' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await user.click(toggle)

    expect(field).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Hide password' }))

    expect(field).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument()
  })
})
