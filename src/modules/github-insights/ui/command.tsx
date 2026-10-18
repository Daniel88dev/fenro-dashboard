"use client";

import { Command as CommandPrimitive } from "cmdk";
import type { ComponentProps } from "react";

export function Command({
  className = "",
  ...props
}: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={`text-ink flex size-full flex-col overflow-hidden ${className}`}
      {...props}
    />
  );
}

export function CommandInput({
  className = "",
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <CommandPrimitive.Input
      data-slot="command-input"
      autoComplete="off"
      data-1p-ignore
      data-lpignore="true"
      data-bwignore
      data-form-type="other"
      className={`text-ink placeholder:text-ink-faint min-w-0 flex-1 bg-transparent outline-none ${className}`}
      {...props}
    />
  );
}

export function CommandList({
  className = "",
  ...props
}: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={`overflow-x-hidden overflow-y-auto overscroll-contain p-1.5 ${className}`}
      {...props}
    />
  );
}

export function CommandEmpty({
  className = "",
  ...props
}: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={`text-ink-muted px-3 py-7 text-center text-[13px] ${className}`}
      {...props}
    />
  );
}

export function CommandGroup({
  className = "",
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={`[&_[cmdk-group-heading]]:text-ink-muted pb-1.5 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:font-medium ${className}`}
      {...props}
    />
  );
}

export function CommandItem({
  className = "",
  ...props
}: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={`data-[selected=true]:bg-surface-sunken flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[14.5px] outline-none select-none sm:min-h-[38px] sm:text-[13.5px] [&_svg]:pointer-events-none [&_svg]:shrink-0 ${className}`}
      {...props}
    />
  );
}

export function CommandShortcut({
  className = "",
  ...props
}: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="command-shortcut"
      className={`border-hairline bg-surface-raised text-ink-muted shrink-0 rounded border px-[5px] font-mono text-[10.5px] ${className}`}
      {...props}
    />
  );
}
