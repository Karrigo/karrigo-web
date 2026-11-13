"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { PasswordInput } from "@/components/ui/PasswordInput";
import { cn } from "@/lib/cn";
import { signIn, type SignInState } from "@/app/(admin)/admin/actions";

import { Wordmark } from "./Wordmark";

const field = cn(
  "h-[52px] rounded-pill px-[18px] text-[15px] font-medium outline-none",
  "bg-ops-surface text-text border",
  "focus-visible:border-accent-text",
);

export function SignInForm({ signedOut }: { signedOut: boolean }) {
  const [state, action] = useActionState<SignInState, FormData>(signIn, {
    error: null,
  });
  // Controlled so a wrong password does not also wipe the email — the mistake
  // is almost always the password, and retyping both is a small insult at the
  // start of a shift.
  const [email, setEmail] = useState("");

  return (
    <form
      action={action}
      className="relative flex w-[min(400px,100%)] flex-col gap-3.5"
    >
      <div className="mb-3.5">
        <Wordmark size={40} />
      </div>

      <h1 className="text-text text-[34px]/[1.05] font-extrabold tracking-[-0.045em]">
        Sign in to run the day
      </h1>

      {signedOut && (
        <p className="bg-warning-bg text-warning rounded-[14px] px-lg py-3 text-[13px]/[1.45] font-medium">
          You&rsquo;re signed out. Sign in again to carry on.
        </p>
      )}

      <label className="mt-2 flex flex-col gap-[7px]">
        <span className="text-text/72 text-[12.5px] font-semibold">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={cn(field, state.error ? "border-danger/60" : "border-text/12")}
        />
      </label>

      <label className="flex flex-col gap-[7px]">
        <span className="text-text/72 text-[12.5px] font-semibold">Password</span>
        <PasswordInput
          name="password"
          toggleClassName="text-text/60"
          autoComplete="current-password"
          className={cn(field, state.error ? "border-danger/60" : "border-text/12")}
        />
      </label>

      {state.error && (
        <p role="alert" className="text-danger text-[13px] font-medium">
          {state.error}
        </p>
      )}

      <Submit />

      <p className="text-text/50 mt-1.5 text-[12.5px]/[1.5] font-light">
        Admin accounts are set up by the Karrigo team. Lost access? Ask a super
        admin.
      </p>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-accent text-on-accent mt-1.5 h-[52px] rounded-pill text-[15px] font-extrabold disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}
