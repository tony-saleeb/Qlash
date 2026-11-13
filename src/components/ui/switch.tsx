"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  checked,
  defaultChecked,
  disabled,
  readOnly,
  onCheckedChange,
  onClick,
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  const [uncontrolledChecked, setUncontrolledChecked] = React.useState(Boolean(defaultChecked))
  const isControlled = checked !== undefined
  const current = isControlled ? checked : uncontrolledChecked

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      checked={current}
      disabled={disabled}
      readOnly={readOnly}
      onCheckedChange={onCheckedChange}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || disabled || readOnly) return
        // The primitive toggles a hidden checkbox with an untrusted click, so the
        // checkbox never changes and onCheckedChange never runs.
        const toggleEvent = event as React.MouseEvent<HTMLElement> & {
          preventBaseUIHandler?: () => void
        }
        toggleEvent.preventBaseUIHandler?.()
        const next = !current
        onCheckedChange?.(next, {
          reason: "none",
          event: event.nativeEvent,
          cancel() {},
          allowPropagation() {},
          isCanceled: false,
          isPropagationAllowed: false,
          trigger: undefined,
        })
        if (!isControlled) setUncontrolledChecked(next)
      }}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent outline-none transition-colors after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[size=default]:h-[22px] data-[size=default]:w-10 data-[size=sm]:h-4 data-[size=sm]:w-7 data-[unchecked]:border-[#9aa6b4] data-[unchecked]:bg-[#c5ced8] data-[checked]:border-arena-signal data-[checked]:bg-arena-signal",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-white shadow-sm transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[unchecked]:translate-x-0.5 data-[checked]:translate-x-[22px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
