import * as React from "react"

import { cn } from "@/lib/utils"

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  )
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-sm font-medium text-foreground",
        className,
      )}
      {...props}
    />
  )
}

const fieldStyles =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldStyles, className)} {...props} />
})

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldStyles, "min-h-24 resize-y", className)}
      {...props}
    />
  )
})

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(fieldStyles, "appearance-none bg-background", className)}
      {...props}
    />
  )
})

export function SectionTitle({
  title,
  description,
  className,
}: {
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <h2 className="text-balance text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {description ? (
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  )
}

const badgeTones = {
  blue: "bg-primary/10 text-primary",
  gray: "bg-muted text-muted-foreground",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-destructive/10 text-destructive",
  green: "bg-emerald-100 text-emerald-700",
} as const

export function Badge({
  tone = "gray",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof badgeTones
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  )
}
