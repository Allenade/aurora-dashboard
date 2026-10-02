import { useState, type ComponentProps } from "react"
import { EyeIcon, EyeOffIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "cn"

import { Input } from "@/components/ui/input"

function PasswordInput({
  className,
  disabled,
  id,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false)
  const label = visible ? "Hide password" : "Show password"

  return (
    <div className="relative w-full">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-11", className)}
        {...props}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-pressed={visible}
        aria-controls={id}
        onMouseDown={(event) => {
          // Keep the field focused so mobile keyboards stay open.
          event.preventDefault()
        }}
        onClick={() => setVisible((current) => !current)}
        className={cn(
          "absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground outline-none transition-colors touch-manipulation hover:text-primary focus-visible:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:text-primary disabled:pointer-events-none disabled:opacity-50",
          visible && "text-primary",
        )}
      >
        <HugeiconsIcon
          icon={visible ? EyeOffIcon : EyeIcon}
          strokeWidth={2}
          className="size-4"
          aria-hidden
        />
      </button>
    </div>
  )
}

export { PasswordInput }
