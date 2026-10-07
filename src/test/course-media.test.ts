import { describe, expect, it } from 'vitest'
import {
  COURSE_IMAGE_MAX_BYTES,
  COURSE_SYLLABUS_PDF_MAX_BYTES,
  COURSE_SYLLABUS_TEXT_MAX_CHARS,
  IMAGE_UPLOAD_UNAVAILABLE,
  SYLLABUS_UPLOAD_UNAVAILABLE,
  courseUploadErrorMessage,
  imageFileError,
  readCourseMedia,
  syllabusFileError,
  syllabusTextBody,
  syllabusTextProblem,
} from '@/lib/course-media'

describe('course picture and syllabus checks', () => {
  it('keeps a real http picture and syllabus and drops anything else', () => {
    expect(
      readCourseMedia({
        imageUrl: ' https://cdn.example/robotics.jpg ',
        syllabus: {
          url: 'https://cdn.example/week.pdf',
          filename: ' Week plan.pdf ',
          text: ' Week 1 ',
        },
      }),
    ).toEqual({
      imageUrl: 'https://cdn.example/robotics.jpg',
      syllabus: {
        url: 'https://cdn.example/week.pdf',
        filename: 'Week plan.pdf',
        text: ' Week 1 ',
      },
    })
    expect(
      readCourseMedia({ imageUrl: ' javascript:alert(1) ', syllabus: null }),
    ).toEqual({
      imageUrl: null,
      syllabus: { url: null, filename: null, text: null },
    })
  })

  it('accepts jpeg, png, and webp up to 5 MB', () => {
    expect(imageFileError({ name: 'a.jpg', type: 'image/jpeg', size: 10 })).toBeNull()
    expect(imageFileError({ name: 'a.png', type: 'image/png', size: 10 })).toBeNull()
    expect(imageFileError({ name: 'a.webp', type: 'image/webp', size: 10 })).toBeNull()
    expect(imageFileError({ name: 'a.jpg', type: '', size: 10 })).toBeNull()
    expect(imageFileError({ name: 'anim.gif', type: 'image/gif', size: 10 })).toBe(
      'Use a JPEG, PNG, or WebP picture.',
    )
    expect(
      imageFileError({
        name: 'big.jpg',
        type: 'image/jpeg',
        size: COURSE_IMAGE_MAX_BYTES + 1,
      }),
    ).toBe('Pictures must be 5 MB or smaller.')
  })

  it('accepts a PDF up to 10 MB', () => {
    expect(
      syllabusFileError({ name: 'week.pdf', type: 'application/pdf', size: 10 }),
    ).toBeNull()
    expect(syllabusFileError({ name: 'week.pdf', type: '', size: 10 })).toBeNull()
    expect(syllabusFileError({ name: 'week.txt', type: 'text/plain', size: 10 })).toBe(
      'Use a PDF.',
    )
    expect(
      syllabusFileError({
        name: 'week.pdf',
        type: 'application/pdf',
        size: COURSE_SYLLABUS_PDF_MAX_BYTES + 1,
      }),
    ).toBe('The syllabus PDF must be 10 MB or smaller.')
  })

  it('clears blank topics and refuses text over 50,000 characters', () => {
    expect(syllabusTextBody('  ')).toEqual({ text: null })
    expect(syllabusTextBody('Week 1: Sensors')).toEqual({ text: 'Week 1: Sensors' })
    expect(syllabusTextBody('x'.repeat(COURSE_SYLLABUS_TEXT_MAX_CHARS))).toEqual({
      text: 'x'.repeat(COURSE_SYLLABUS_TEXT_MAX_CHARS),
    })
    expect(syllabusTextBody('x'.repeat(COURSE_SYLLABUS_TEXT_MAX_CHARS + 1))).toEqual({
      error: 'Week-by-week topics must be 50,000 characters or fewer.',
    })
  })

  it('turns storage, size, and bad-file responses into plain sentences', () => {
    expect(
      courseUploadErrorMessage(
        503,
        'Cloudflare R2 storage is not configured.',
        'image',
      ),
    ).toBe(IMAGE_UPLOAD_UNAVAILABLE)
    expect(
      courseUploadErrorMessage(503, 'Cloudflare R2 storage is not configured.', 'pdf'),
    ).toBe(SYLLABUS_UPLOAD_UNAVAILABLE)
    expect(courseUploadErrorMessage(413, 'File too large', 'image')).toBe(
      'Pictures must be 5 MB or smaller.',
    )
    expect(courseUploadErrorMessage(413, 'File too large', 'pdf')).toBe(
      'The syllabus PDF must be 10 MB or smaller.',
    )
    expect(
      courseUploadErrorMessage(400, 'Image must be jpeg, png, or webp', 'image'),
    ).toBe('Image must be jpeg, png, or webp')
    expect(courseUploadErrorMessage(400, 'Syllabus file must be a PDF', 'pdf')).toBe(
      'Syllabus file must be a PDF',
    )
    expect(courseUploadErrorMessage(400, '', 'image')).toBe(
      'Use a JPEG, PNG, or WebP picture.',
    )
    expect(
      courseUploadErrorMessage(
        503,
        'Could not reach the server. Check that it is running, then try again.',
        'image',
      ),
    ).toBe('Could not reach the server. Check that it is running, then try again.')
    expect(syllabusTextProblem(400, 'Syllabus text exceeds 50000 characters')).toBe(
      'Syllabus text exceeds 50000 characters',
    )
    expect(syllabusTextProblem(400, '')).toBe('That text could not be saved.')
  })
})
