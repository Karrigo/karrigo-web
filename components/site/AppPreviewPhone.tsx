import { LogoLockup } from "@/components/site/Logo";
import { Screen } from "@/components/ui/Screen";
import { kitchens } from "@/lib/fixtures";

/**
 * The app-download panel's phone: a small, flat device showing the home feed
 * with an order on its way — the two things the app does that the web cannot
 * do as well. Furniture, like `PhoneFrame`: never part of the product UI.
 */
export function AppPreviewPhone() {
  return (
    <div
      aria-hidden
      className="bg-bezel rounded-device-sm aspect-[272/556] w-full max-w-[272px] p-sm shadow-[0_40px_60px_rgba(0,0,0,0.55),inset_0_0_0_1.5px_rgba(255,255,255,0.14)]"
    >
      <Screen
        mode="light"
        className="rounded-header relative flex h-full flex-col overflow-hidden"
      >
        <span className="bg-bezel rounded-pill absolute top-[9px] left-1/2 h-[20px] w-[76px] -translate-x-1/2" />

        <div className="px-lg flex items-center justify-between pt-[40px]">
          <LogoLockup className="[&_img]:h-[22px]" />
          <span className="text-micro text-text-secondary font-semibold">
            Wurukum
          </span>
        </div>

        <div className="mx-lg bg-surface-raised text-micro text-text-secondary mt-md rounded-otp px-md py-sm">
          Search egusi, jollof, suya…
        </div>

        <p className="px-lg text-micro text-accent-text pt-lg pb-xs font-bold">
          7 kitchens · closest first
        </p>

        <div className="px-lg gap-md flex flex-col">
          {kitchens.slice(0, 4).map((kitchen) => (
            <div key={kitchen.slug} className="gap-sm flex min-w-0 items-center">
              <Image
                src={kitchen.image}
                alt=""
                width={46}
                height={46}
                sizes="46px"
                className="rounded-otp size-[46px] shrink-0 object-cover"
              />
              <span className="min-w-0">
                <span className="text-label block truncate font-bold">
                  {kitchen.name}
                </span>
                <span className="text-micro text-text-secondary block">
                  {kitchen.cuisine} · {kitchen.etaMinutes[0]} min
                </span>
              </span>
            </div>
          ))}
        </div>

        <Screen
          mode="dark"
          className="mx-lg mt-md gap-sm rounded-field px-md py-sm flex items-center justify-between"
        >
          <span className="min-w-0">
            <span className="text-label text-cream block font-bold">
              Order 1042 on the way
            </span>
            <span className="text-micro text-cream/60 block">
              Arriving about 6:41 PM
            </span>
          </span>
          <span className="bg-accent route-pulse size-[8px] shrink-0 rounded-full" />
        </Screen>

        <div className="border-text/10 text-micro text-text-secondary mt-auto flex justify-between border-t px-xl pt-md pb-lg font-semibold">
          <span className="text-text">Home</span>
          <span>Orders</span>
          <span>Saved</span>
          <span>Account</span>
        </div>
      </Screen>
    </div>
  );
}
