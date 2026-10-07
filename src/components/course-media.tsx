import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAbility } from '@/components/ability'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { allows } from '@/lib/ability'
import {
  imageFileError,
  mediaErrorMessage,
  readCourseMedia,
  syllabusFileError,
  syllabusHtmlToLines,
  syllabusLinesToHtml,
  syllabusTextBody,
  syllabusTextProblem,
  uploadCourseFile,
} from '@/lib/course-media'
import { ApiError, api } from '@/queries/api'
import type {
  AdminCourse,
  CourseSyllabus,
} from '@/queries/courses/interfaces/course.dto'

export function CourseThumb({ url }: { url?: string | null }) {
  const src = readCourseMedia({ imageUrl: url }).imageUrl
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      className="size-8 shrink-0 rounded-md border border-border object-cover"
    />
  )
}

/** Shown on a new course until the draft exists and uploads have an id. */
export function CourseMediaLater() {
  return (
    <div className="space-y-3">
      <section className="space-y-1 rounded-md border border-border px-3 py-3">
        <h3 className="text-sm font-medium">Course picture</h3>
        <p className="text-sm text-muted-foreground">
          You can add a picture after the course is created.
        </p>
      </section>
      <section className="space-y-1 rounded-md border border-border px-3 py-3">
        <h3 className="text-sm font-medium">Syllabus</h3>
        <p className="text-sm text-muted-foreground">
          You can add a syllabus after the course is created.
        </p>
      </section>
    </div>
  )
}

export function CourseMediaSections({
  courseId,
  courseName,
  imageUrl,
  syllabus,
  onChanged,
}: {
  courseId: string
  courseName: string
  imageUrl?: string | null
  syllabus?: CourseSyllabus | null
  onChanged: () => void
}) {
  const ability = useAbility()
  const canUpdate = allows(ability, 'update', 'course')
  const initial = readCourseMedia({ imageUrl, syllabus })
  const [picture, setPicture] = useState(initial.imageUrl)
  const [fileUrl, setFileUrl] = useState(initial.syllabus.url)
  const [filename, setFilename] = useState(initial.syllabus.filename)
  const [topics, setTopics] = useState(() =>
    syllabusHtmlToLines(initial.syllabus.text ?? ''),
  )
  const [pictureError, setPictureError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [topicsError, setTopicsError] = useState<string | null>(null)
  const pictureInput = useRef<HTMLInputElement>(null)
  const syllabusInput = useRef<HTMLInputElement>(null)

  const uploadPicture = useMutation({
    mutationFn: (file: File) =>
      uploadCourseFile(`/admin/courses/${courseId}/image`, file, 'image'),
    onSuccess: (next) => {
      if (next && typeof next === 'object' && 'imageUrl' in next) {
        setPicture(readCourseMedia(next).imageUrl)
      }
      setPictureError(null)
      toast.success('Picture saved')
      onChanged()
    },
    onError: (err) => {
      const message = mediaErrorMessage(err, 'Could not upload the picture')
      setPictureError(message)
      toast.error(message)
    },
  })

  const removePicture = useMutation({
    mutationFn: () =>
      api<AdminCourse>({ method: 'DELETE', path: `/admin/courses/${courseId}/image` }),
    onSuccess: (next) => {
      if (next && typeof next === 'object' && 'imageUrl' in next) {
        setPicture(readCourseMedia(next).imageUrl)
      } else {
        setPicture(null)
      }
      setPictureError(null)
      toast.success('Picture removed')
      onChanged()
    },
    onError: (err) => {
      const message = mediaErrorMessage(err, 'Could not remove the picture')
      setPictureError(message)
      toast.error(message)
    },
  })

  const uploadSyllabus = useMutation({
    mutationFn: (file: File) =>
      uploadCourseFile(`/admin/courses/${courseId}/syllabus`, file, 'pdf'),
    onSuccess: (next) => {
      if (next && typeof next === 'object' && 'syllabus' in next) {
        const media = readCourseMedia(next)
        setFileUrl(media.syllabus.url)
        setFilename(media.syllabus.filename)
      }
      setFileError(null)
      toast.success('Syllabus file saved')
      onChanged()
    },
    onError: (err) => {
      const message = mediaErrorMessage(err, 'Could not upload the syllabus')
      setFileError(message)
      toast.error(message)
    },
  })

  const removeSyllabus = useMutation({
    mutationFn: () =>
      api<AdminCourse>({
        method: 'DELETE',
        path: `/admin/courses/${courseId}/syllabus/file`,
      }),
    onSuccess: (next) => {
      if (next && typeof next === 'object' && 'syllabus' in next) {
        const media = readCourseMedia(next)
        setFileUrl(media.syllabus.url)
        setFilename(media.syllabus.filename)
      } else {
        setFileUrl(null)
        setFilename(null)
      }
      setFileError(null)
      toast.success('Syllabus file removed')
      onChanged()
    },
    onError: (err) => {
      const message = mediaErrorMessage(err, 'Could not remove the syllabus file')
      setFileError(message)
      toast.error(message)
    },
  })

  const saveTopics = useMutation({
    mutationFn: (text: string) => {
      const body = syllabusTextBody(text)
      if ('error' in body) return Promise.reject(new Error(body.error))
      return api<AdminCourse>({
        method: 'PATCH',
        path: `/admin/courses/${courseId}/syllabus/text`,
        body,
      })
    },
    onSuccess: (next) => {
      if (next && typeof next === 'object' && 'syllabus' in next) {
        setTopics(syllabusHtmlToLines(readCourseMedia(next).syllabus.text ?? ''))
      }
      setTopicsError(null)
      toast.success('Topics saved')
      onChanged()
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? syllabusTextProblem(err.statusCode, err.message)
          : mediaErrorMessage(err, 'Could not save the topics')
      setTopicsError(message)
      toast.error(message)
    },
  })

  const pictureBusy = uploadPicture.isPending || removePicture.isPending
  const fileBusy = uploadSyllabus.isPending || removeSyllabus.isPending
  const fileLabel = filename || (fileUrl ? 'Syllabus PDF' : null)

  function choosePicture(file: File | undefined) {
    if (!file || pictureBusy) return
    const problem = imageFileError(file)
    if (problem) {
      setPictureError(problem)
      toast.error(problem)
      return
    }
    setPictureError(null)
    uploadPicture.mutate(file)
  }

  function chooseSyllabus(file: File | undefined) {
    if (!file || fileBusy) return
    const problem = syllabusFileError(file)
    if (problem) {
      setFileError(problem)
      toast.error(problem)
      return
    }
    setFileError(null)
    uploadSyllabus.mutate(file)
  }

  return (
    <div className="space-y-3">
      <section className="space-y-2 rounded-md border border-border px-3 py-3">
        <h3 className="text-sm font-medium">Course picture</h3>
        <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP. Up to 5 MB.</p>
        {picture ? (
          <img
            src={picture}
            alt={`${courseName} picture`}
            className="max-h-36 rounded-md border border-border object-contain"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No picture yet.</p>
        )}
        {canUpdate ? (
          <div className="flex flex-wrap gap-2">
            <input
              ref={pictureInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-label="Course picture file"
              disabled={pictureBusy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                choosePicture(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pictureBusy}
              onClick={() => pictureInput.current?.click()}
            >
              {uploadPicture.isPending ? 'Uploading' : picture ? 'Replace' : 'Upload'}
            </Button>
            {picture ? (
              <Button
                type="button"
                variant="outline"
                aria-label="Remove course picture"
                disabled={pictureBusy}
                onClick={() => removePicture.mutate()}
              >
                Remove
              </Button>
            ) : null}
          </div>
        ) : null}
        {pictureError ? (
          <p className="text-sm text-destructive">{pictureError}</p>
        ) : null}
      </section>

      <section className="space-y-2 rounded-md border border-border px-3 py-3">
        <h3 className="text-sm font-medium">Syllabus</h3>
        <p className="text-xs text-muted-foreground">PDF, up to 10 MB.</p>
        {fileLabel ? (
          fileUrl ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-sm underline"
            >
              {fileLabel}
            </a>
          ) : (
            <p className="text-sm">{fileLabel}</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">No syllabus file yet.</p>
        )}
        {canUpdate ? (
          <div className="flex flex-wrap gap-2">
            <input
              ref={syllabusInput}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              tabIndex={-1}
              aria-label="Syllabus PDF file"
              disabled={fileBusy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                chooseSyllabus(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={fileBusy}
              onClick={() => syllabusInput.current?.click()}
            >
              {uploadSyllabus.isPending ? 'Uploading' : 'Upload PDF'}
            </Button>
            {fileLabel ? (
              <Button
                type="button"
                variant="outline"
                aria-label="Remove syllabus file"
                disabled={fileBusy}
                onClick={() => removeSyllabus.mutate()}
              >
                Remove
              </Button>
            ) : null}
          </div>
        ) : null}
        {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
        <label className="block space-y-1.5 text-sm">
          <span>Week-by-week topics</span>
          <Textarea
            value={topics}
            readOnly={!canUpdate}
            rows={8}
            placeholder={'Week 1:\nSensors and boards\n\nWeek 2:\nMotors'}
            onChange={(event) => setTopics(event.target.value)}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          One topic per line. A line that ends with : or starts with # is a heading. A
          blank line starts a new group.
        </p>
        <SyllabusPreview source={topics} />
        {canUpdate ? (
          <p className="text-xs text-muted-foreground">
            Leave this empty and save to clear it.
          </p>
        ) : null}
        {canUpdate ? (
          <Button
            type="button"
            variant="outline"
            aria-label="Save week-by-week topics"
            disabled={saveTopics.isPending}
            onClick={() => saveTopics.mutate(topics)}
          >
            {saveTopics.isPending ? 'Saving' : 'Save'}
          </Button>
        ) : null}
        {topicsError ? <p className="text-sm text-destructive">{topicsError}</p> : null}
      </section>
    </div>
  )
}

function SyllabusPreview({ source }: { source: string }) {
  const html = syllabusLinesToHtml(source)
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Preview</p>
      {html ? (
        <div
          aria-label="Syllabus preview"
          className="rounded-md border border-border px-3 py-2 text-sm [&_h2]:text-sm [&_h2]:font-medium [&_li]:mt-0.5 [&_ul+h2]:mt-3 [&_ul]:mt-1 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-xs text-muted-foreground">Type a line to see the list.</p>
      )}
    </div>
  )
}
