"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      // Sonner's own styles are unlayered, so these overrides are marked important. Text is 14px; on a
      // touch screen the action and the close button are 44px, and the close button joins the row's
      // end instead of hanging off the corner at 20px.
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          title: "text-sm! leading-snug!",
          description: "text-sm! leading-snug! text-foreground-2!",
          actionButton:
            "rounded-full! px-3.5! text-sm! focus-visible:shadow-none! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring! pointer-coarse:h-11! pointer-coarse:px-4!",
          closeButton:
            "focus-visible:shadow-none! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring! pointer-coarse:static! pointer-coarse:order-last! pointer-coarse:-my-2! pointer-coarse:-mr-2! pointer-coarse:size-11! pointer-coarse:shrink-0! pointer-coarse:transform-none! pointer-coarse:border-0! pointer-coarse:bg-transparent! [&_svg]:pointer-coarse:size-4!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
