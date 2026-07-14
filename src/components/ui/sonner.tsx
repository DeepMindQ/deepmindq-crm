"use client"

import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "oklch(0.13 0.01 260)",
          "--normal-text": "oklch(0.95 0 0)",
          "--normal-border": "oklch(0.27 0.005 260)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
