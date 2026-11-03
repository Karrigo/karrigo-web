import { ButtonLink } from "@/components/ui/Button";

/** The business already has this side, but this browser is signed in to the
 *  other one. Kitchen and store are separate sign-ins, so reaching it is a
 *  deliberate step: sign in to it. */
export function SignInToOtherSide({ side }: { side: "kitchen" | "store" }) {
  return (
    <div className="bg-bg rounded-panel-sm p-xl md:p-xxl gap-md flex flex-col items-start">
      <p className="text-site-body text-text-secondary max-w-[52ch]">
        Your business has a {side}, but you&rsquo;re signed in to your {side === "kitchen" ? "store" : "kitchen"}. Sign in
        to your {side} to manage it. You can stay signed in to both.
      </p>
      <ButtonLink href={`/partners/${side}/login`} variant="accent" size="site">
        Sign in to your {side}
      </ButtonLink>
    </div>
  );
}
