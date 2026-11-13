"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState, useTransition } from "react"
import { Screen } from "@/components/ui/Screen"
import { Button } from "@/components/ui/Button"
import { OtpInput } from "@/components/ui/OtpInput"
import { PasswordInput } from "@/components/ui/PasswordInput"
import {
  codeSchema,
  firstIssue,
  loginSchema,
  resetSchema,
  signupSchema,
} from "@/lib/order/schema"
import { logIn, requestCode, verifyAndSetPassword } from "@/app/(order)/actions"
import { cn } from "@/lib/cn"

const field =
  "border-field-border focus:border-field-border-active rounded-field text-site-body bg-bg border-[1.5px] px-lg py-md font-medium outline-none transition-colors duration-(--duration-fast)"
const fieldLabel = "text-label flex flex-col gap-sm font-bold"

/** Only same-site paths — never bounce a fresh login to another origin. */
function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/kitchens"
}

type Mode = "login" | "signup"
/** Login and signup are tabs; resetting a password is its own short flow. */
type Flow = Mode | "reset"

/**
 * `?next=` is read in the browser so /login and /signup stay static pages.
 * Until the query is readable (the prerendered HTML) the form renders without
 * it — the only difference is the checkout banner and where success goes.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  return (
    <Suspense fallback={<AuthCard mode={mode} />}>
      <AuthFormWithQuery mode={mode} />
    </Suspense>
  )
}

function AuthFormWithQuery({ mode }: { mode: Mode }) {
  const next = useSearchParams().get("next") ?? undefined
  return <AuthCard mode={mode} next={next} />
}

function AuthCard({ mode: initialMode, next }: { mode: Mode; next?: string }) {
  const router = useRouter()
  const [flow, setFlow] = useState<Flow>(initialMode)
  const [step, setStep] = useState<"details" | "code">("details")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [wait, setWait] = useState(0)
  const [busy, startTransition] = useTransition()

  const destination = safeNext(next)
  const query = next ? `?next=${encodeURIComponent(destination)}` : ""
  const signup = flow === "signup"
  const reset = flow === "reset"

  // Resend cooldown, counted down on screen so "wait a bit" is a number.
  useEffect(() => {
    if (wait <= 0) return
    const tick = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(tick)
  }, [wait])

  // Switching tabs is a state change, not a navigation: the form stays
  // mounted, so the pill slides and typed values survive. The URL follows
  // along in place so a refresh or a shared link still opens the right tab.
  function go(nextFlow: Flow) {
    setFlow(nextFlow)
    setStep("details")
    setError("")
    if (nextFlow !== "reset")
      window.history.replaceState(null, "", `/${nextFlow}${query}`)
  }

  function done() {
    router.push(destination)
    router.refresh()
  }

  function sendCode() {
    startTransition(async () => {
      const result = await requestCode(email, reset ? "reset" : "signup")
      if (!result.ok) {
        if (result.retryAfter) setWait(result.retryAfter)
        return setError(result.error)
      }
      setError("")
      setStep("code")
      setWait(30)
    })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return

    if (flow === "login") {
      const parsed = loginSchema.safeParse({ identifier, password })
      if (!parsed.success) return setError(firstIssue(parsed.error))
      return startTransition(async () => {
        const result = await logIn(parsed.data.identifier, parsed.data.password)
        if (!result.ok) return setError(result.error)
        done()
      })
    }

    const parsed = (signup ? signupSchema : resetSchema).safeParse({
      name,
      email,
      password,
    })
    if (!parsed.success) return setError(firstIssue(parsed.error))
    sendCode()
  }

  function verify(code: string) {
    const parsed = codeSchema.safeParse(code)
    if (!parsed.success) return setError(firstIssue(parsed.error))
    startTransition(async () => {
      const result = await verifyAndSetPassword({
        email,
        code,
        password,
        name: signup ? name : undefined,
      })
      if (!result.ok) return setError(result.error)
      done()
    })
  }

  return (
    <div className="bg-bg rounded-panel-lg mx-auto grid max-w-[1000px] overflow-hidden md:grid-cols-2">
      <Screen
        mode="dark"
        className="p-xxl md:p-gap-wide gap-xxl relative flex md:min-h-[360px] flex-col justify-between overflow-hidden"
      >
        <div
          aria-hidden
          className="border-accent/20 pointer-events-none absolute right-[-120px] bottom-[-160px] size-[420px] rounded-full border-[1.5px]"
        />
        <div className="relative">
          <h1 className="text-panel-small md:text-panel text-cream text-balance">
            Hungry?
            <br />
            <span className="text-accent-text">Let&rsquo;s get you fed.</span>
          </h1>
          <p className="text-panel-body text-cream/66 mt-lg max-w-[30ch]">
            One account for ordering, saved landmarks and live rider tracking.
          </p>
        </div>
        <div className="rounded-step bg-surface relative hidden aspect-[16/10] overflow-hidden md:block">
          <Image
            src="/food/jollof.jpg"
            alt="A plate of jollof rice"
            fill
            sizes="(max-width: 768px) 100vw, 440px"
            className="object-cover"
          />
        </div>
      </Screen>

      <div className="p-xxl md:p-gap-wide">
        {reset ? (
          <div>
            <h2 className="text-h1 font-extrabold">Reset your password</h2>
            <p className="text-site-label text-text-secondary mt-xs">
              We&rsquo;ll email a code to the address on your account, then
              you choose a new password.
            </p>
          </div>
        ) : (
          <div className="bg-surface-raised rounded-pill relative flex p-xs">
            <span
              aria-hidden
              className={cn(
                "bg-bg rounded-pill absolute top-xs bottom-xs left-xs w-[calc(50%-4px)] shadow-[0_6px_14px_-8px_rgba(14,15,13,0.35)] transition-transform duration-(--duration-slow)",
                signup && "translate-x-full",
              )}
            />
            <button
              type="button"
              onClick={() => go("login")}
              aria-pressed={flow === "login"}
              className="text-site-button relative flex-1 py-md text-center"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => go("signup")}
              aria-pressed={signup}
              className="text-site-button relative flex-1 py-md text-center"
            >
              Sign up
            </button>
          </div>
        )}

        {next === "/checkout" && (
          <p className="bg-accent/15 text-accent-text rounded-chip text-site-label mt-lg px-lg py-md font-semibold">
            Log in or sign up to place your order. Your cart is saved.
          </p>
        )}

        {step === "code" ? (
          <div className="gap-md mt-xl flex flex-col">
            <p className="text-site-body">
              We emailed a 6-digit code to <strong>{email}</strong>.
            </p>
            <OtpInput error={Boolean(error)} onComplete={verify} />
            {error && (
              <p
                role="alert"
                className="text-danger-text text-site-label shake font-semibold"
              >
                {error}
              </p>
            )}
            <div className="text-site-label gap-sm flex flex-wrap justify-between font-semibold">
              <button
                type="button"
                onClick={() => setStep("details")}
                className="text-text-secondary"
              >
                ← Change email
              </button>
              <button
                type="button"
                disabled={wait > 0 || busy}
                onClick={sendCode}
                className="text-accent-text font-bold disabled:opacity-50"
              >
                {wait > 0 ? `Send again in ${wait}s` : "Send a new code"}
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={submit}
            noValidate
            className="gap-md mt-xl flex flex-col"
          >
            {signup && (
              <label className={cn(fieldLabel, "rise")}>
                Full name
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setError("")
                  }}
                  placeholder="Doosuur Terhemba"
                  autoComplete="name"
                  className={field}
                />
              </label>
            )}
            {flow === "login" ? (
              <label className={fieldLabel}>
                Email
                <input
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value)
                    setError("")
                  }}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="username"
                  className={field}
                />
              </label>
            ) : (
              <label className={fieldLabel}>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError("")
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={field}
                />
              </label>
            )}
            <label className={fieldLabel}>
              {reset ? "New password" : "Password"}
              <PasswordInput
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError("")
                }}
                placeholder={
                  flow === "login" ? "Your password" : "At least 8 characters"
                }
                autoComplete={
                  flow === "login" ? "current-password" : "new-password"
                }
                className={field}
              />
            </label>
            {error && (
              <p
                role="alert"
                className="text-danger-text text-site-label shake font-semibold"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="dark"
              size="site"
              full
              className="mt-xs"
              disabled={busy}
            >
              {busy
                ? "One moment…"
                : flow === "login"
                  ? "Log in"
                  : signup
                    ? "Email me a code"
                    : "Send reset code"}
            </Button>
          </form>
        )}

        <div className="text-site-label mt-lg gap-sm flex flex-wrap justify-between font-semibold">
          {reset ? (
            <button
              type="button"
              onClick={() => go("login")}
              className="text-accent-text font-bold"
            >
              ← Back to log in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => go(signup ? "login" : "signup")}
              className="text-accent-text font-bold"
            >
              {signup
                ? "Have an account? Log in"
                : "New here? Create an account"}
            </button>
          )}
          {flow === "login" && (
            <button
              type="button"
              className="text-text-secondary"
              onClick={() => go("reset")}
            >
              Forgot password?
            </button>
          )}
        </div>

        <Link
          href="/kitchens"
          className="text-text-secondary text-site-label gap-sm mt-xxl inline-flex items-center font-semibold"
        >
          Browse kitchens first
          {/* Drawn as a mask so the icon takes the link's own colour, in
              both themes, instead of the fixed grey of the file. */}
          <span
            aria-hidden
            className="size-[18px] shrink-0 bg-current mask-[url(/icons/serve.png)] mask-contain mask-center mask-no-repeat"
          />
        </Link>
        {/* Kitchens and stores sign in through the partner login, not here.
            Someone who runs one and lands on this page would otherwise sign in
            as a customer and find no business. */}
        <p className="text-text-secondary text-site-label mt-md">
          Own a kitchen or store? Log in:{" "}
          <Link
            href="/partners/kitchen/login"
            className="text-accent-text font-bold"
          >
            Kitchen
          </Link>{" "}
          &middot;{" "}
          <Link
            href="/partners/store/login"
            className="text-accent-text font-bold"
          >
            Store
          </Link>
        </p>
      </div>
    </div>
  )
}
