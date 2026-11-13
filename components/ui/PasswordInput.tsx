"use client";

import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

/** A password input with a show/hide eye on its right edge. Takes the usual input props. */
export function PasswordInput({
  className,
  toggleClassName = "text-text-secondary",
  ...props
}: Omit<ComponentProps<"input">, "type"> & { toggleClassName?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className={cn(className, "w-full pr-12")} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className={cn(toggleClassName, "absolute inset-y-0 right-0 flex w-12 items-center justify-center")}
      >
        <EyeIcon off={show} />
      </button>
    </div>
  );
}
