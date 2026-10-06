import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CourseSelect } from '@/components/course-select'

describe('CourseSelect', () => {
  it('shows no courses yet when the catalogue is empty', () => {
    render(
      <CourseSelect
        courses={[]}
        loading={false}
        error={false}
        value=""
        onChange={() => {}}
      />,
    )
    expect(screen.getByText('No courses yet.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Course' })).not.toBeInTheDocument()
  })

  it('does not offer options while courses are loading or unavailable', () => {
    const { rerender } = render(
      <CourseSelect
        courses={undefined}
        loading
        error={false}
        value=""
        onChange={() => {}}
      />,
    )
    expect(screen.getByText('Loading courses.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    rerender(
      <CourseSelect
        courses={undefined}
        loading={false}
        error
        value=""
        onChange={() => {}}
      />,
    )
    expect(screen.getByText('Courses could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('lists only the courses it was given', () => {
    render(
      <CourseSelect
        courses={[{ slug: 'robotics', name: 'Robotics Track' }]}
        loading={false}
        error={false}
        value=""
        onChange={() => {}}
      />,
    )
    const select = screen.getByRole('combobox', { name: 'Course' })
    expect(
      [...select.querySelectorAll('option')].map((option) => option.textContent),
    ).toEqual(['All courses', 'Robotics Track'])
  })

  it('drops a selected course that is not in the live list', () => {
    const onChange = vi.fn()
    render(
      <CourseSelect
        courses={[{ slug: 'robotics', name: 'Robotics Track' }]}
        loading={false}
        error={false}
        value="ghost-track"
        onChange={onChange}
      />,
    )
    expect(onChange).toHaveBeenCalledWith('')
  })
})
