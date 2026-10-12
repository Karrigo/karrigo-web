import Link from "next/link";
import Image from "next/image";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { AddressForm } from "@/components/site/AddressForm";
import { HeroTabs } from "@/components/site/HeroTabs";
import { StoreCard } from "@/components/site/StoreCard";
import { StoreButtons } from "@/components/site/StoreButtons";
import { KitchenCard } from "@/components/site/KitchenCard";
import { KitchenRail } from "@/components/site/KitchenRail";
import { HeroPhones } from "@/components/site/HeroPhones";
import { StepsGrid } from "@/components/site/StepsGrid";
import { FaqList } from "@/components/site/FaqList";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { UsersPanel } from "@/components/site/UsersPanel";
import { AreasPanel } from "@/components/site/AreasPanel";
import { AppPreviewPhone } from "@/components/site/AppPreviewPhone";
import { Eyebrow } from "@/components/site/Eyebrow";
import { Screen } from "@/components/ui/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { kitchens, stores, heroStats } from "@/lib/fixtures";
import { getPublicStats } from "@/lib/shop/public-stats";

export default async function HomePage() {
  const shownKitchens = kitchens.slice(0, 4);
  const shownStores = stores.slice(0, 4);
  const publicStats = await getPublicStats();

  return (
    // grow so the ground colour fills the viewport on short pages — the body
    // behind it is the app's white, not the site's.
    <div className="bg-surface grow">
      <SiteNav mode="dark" />
      <ScrollReveal />

      {/* Hero — an inset dark panel, not an edge-to-edge screen, so it reads
          as a card sitting on the page rather than framing it. */}
      <section className="px-screen-x">
        <Screen
          mode="dark"
          className="rounded-panel-lg relative mx-auto mt-lg max-w-[1240px] overflow-hidden"
        >
          <div
            aria-hidden
            className="border-accent/22 pointer-events-none absolute top-[-170px] left-[-110px] size-[520px] rounded-full border-[1.5px]"
          />
          <div
            aria-hidden
            className="border-accent/13 pointer-events-none absolute top-[-90px] left-[-30px] size-[380px] rounded-full border-[1.5px]"
          />
          <div
            aria-hidden
            className="border-accent-warm/20 pointer-events-none absolute right-[-120px] bottom-[-200px] size-[560px] rounded-full border-[1.5px]"
          />
          <div
            aria-hidden
            className="border-text/8 pointer-events-none absolute right-[-40px] bottom-[-120px] size-[400px] rounded-full border-[1.5px]"
          />

          <div className="gap-xxl relative grid items-center px-xl pt-xxl md:px-pad-hero-x md:pt-pad-hero xl:grid-cols-2">
            <div className="min-w-0">
              <h1 className="text-hero-small md:text-hero xl:text-[70px] xl:leading-[68px] xl:tracking-[-0.045em] text-cream rise text-balance">
                Food, groceries, <span className="text-accent-text">at your doorstep.</span>
              </h1>

              <p className="text-lede-small md:text-lede text-cream/66 rise rise-1 mt-xl max-w-[34ch] text-pretty">
                Order from the kitchens and stores near you. A Karrigo rider
                brings it over, wherever your landmark is.
              </p>

              <AddressForm className="rise rise-2 mt-xxl max-w-[440px] xl:max-w-[520px]" />

              <HeroTabs className="rise rise-3 mt-lg" />

              <dl className="rise rise-4 gap-sm mt-xxl flex flex-wrap pb-xxl">
                {heroStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-text/7 border-text/10 rounded-chip border px-lg py-md"
                  >
                    <dt className="text-stat text-accent-text">{stat.value}</dt>
                    <dd className="text-stat-label text-cream/55 mt-[5px]">
                      {stat.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* The devices only work beside the copy. Stacked under it they
                are a shrunken afterthought, so below the two-column width
                they go entirely rather than getting smaller. */}
            <div className="hidden min-w-0 justify-center self-end pb-xxl xl:flex">
              <HeroPhones />
            </div>
          </div>
        </Screen>
      </section>

      {/* Real kitchens, scrolling past — the marketing page's
          own appetiser. */}
      <div className="pt-xxl md:pt-gap-wide">
        <KitchenRail />
      </div>

      <section className="px-screen-x mx-auto w-full max-w-[1240px] pt-section-sm md:pt-section">
        <div className="gap-lg mb-xxl flex flex-wrap items-end justify-between">
          <div>
            <Eyebrow className="rise">Open right now</Eyebrow>
            <h2 className="text-section-small md:text-section rise rise-1 mt-md">
              Open near you
            </h2>
          </div>
          <ButtonLink
            href="/kitchens"
            variant="dark"
            size="site"
            className="rise rise-1"
          >
            See what&rsquo;s near me
          </ButtonLink>
        </div>

        <div className="text-site-title rise rise-1 mb-lg">Kitchens open now</div>
        <div data-aos="rise" className="gap-xl grid sm:grid-cols-2 lg:grid-cols-4">
          {shownKitchens.map((kitchen) => (
            <KitchenCard key={kitchen.slug} kitchen={kitchen} />
          ))}
        </div>

        <div className="text-site-title rise rise-2 mt-xxl mb-lg">Stores open now</div>
        <div data-aos="rise" className="gap-xl grid sm:grid-cols-2 lg:grid-cols-4">
          {shownStores.map((store) => (
            <StoreCard key={store.slug} store={store} />
          ))}
        </div>
      </section>

      {/* Four steps — one card reads as current at a time, on a loop. */}
      <section data-aos="rise" className="px-screen-x mx-auto w-full max-w-[1240px] pt-section-sm md:pt-section">
        <h2 className="text-section-small md:text-section mb-xxl max-w-[16ch] text-balance">
          Four steps, no app needed
        </h2>
        <StepsGrid />
      </section>

      {/* Growth — users and downloads, counting up from zero. */}
      <section data-aos="rise" className="px-screen-x pt-section-sm md:pt-section">
        <UsersPanel users={publicStats?.users} downloads={publicStats?.downloads} />
      </section>

      {/* Coverage — the question people arrive with, answered in one number. */}
      <section data-aos="rise" className="px-screen-x pt-section-sm md:pt-section">
        <AreasPanel />
      </section>

      {/* Riders and restaurants — two offer cards, side by side, so neither
          audience reads as an afterthought to the other. */}
      <section
        data-aos="rise"
        id="riders"
        className="px-screen-x mx-auto w-full max-w-[1240px] pt-section-sm md:pt-section"
      >
        <div className="gap-xl grid sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-accent text-on-accent rounded-panel-md p-xxl md:p-pad-card flex flex-col">
            {/* The slot is white on both cards, whatever the card is. Left to
                the surrounding palette it would go near-black on the dark one,
                and the photograph would sit on it with no margin. */}
            <div
              data-theme="light"
              className="bg-bg rounded-slot relative h-[200px] overflow-hidden md:h-[248px]"
            >
              <Image
                src="/images/v4-bike.jpg"
                alt="A delivery scooter carrying a box"
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-contain"
              />
            </div>
            <h2 className="text-card-title-small md:text-card-title mt-xxl">
              Earn on your own hours
            </h2>
            <p className="text-site-body text-on-accent/72 mt-md text-pretty">
              If you know your area&rsquo;s roads, you already have the hard
              part. Paid per trip, every Friday, and you keep 100% of your tips.
            </p>
            <div className="mt-auto pt-xxl">
              <ButtonLink href="/partners/rider" variant="dark" size="site">
                Apply to ride
              </ButtonLink>
            </div>
          </div>

          <Screen
            mode="dark"
            className="rounded-panel-md p-xxl md:p-pad-card flex flex-col"
          >
            <div
              data-theme="light"
              className="bg-bg rounded-slot relative h-[200px] overflow-hidden md:h-[248px]"
            >
              <Image
                src="/images/v4-pay.jpg"
                alt="Paying on a phone"
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-contain"
              />
            </div>
            <h2 className="text-card-title-small md:text-card-title text-cream mt-xxl">
              Put your kitchen on Karrigo
            </h2>
            <p className="text-site-body text-cream/66 mt-md text-pretty">
              You cook. We handle orders, riders and money. 15% commission,
              nothing else — and we photograph your menu for free.
            </p>
            <div className="mt-auto pt-xxl">
              <ButtonLink href="/partners/kitchen" variant="accent" size="site">
                List your kitchen
              </ButtonLink>
            </div>
          </Screen>

          <div className="bg-cream text-on-accent rounded-panel-md p-xxl md:p-pad-card flex flex-col">
            <div
              data-theme="light"
              className="bg-bg rounded-slot relative h-[200px] overflow-hidden md:h-[248px]"
            >
              <Image
                src="/images/v5-store.jpg"
                alt="A storefront icon"
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-contain"
              />
            </div>
            <h2 className="text-card-title-small md:text-card-title mt-xxl">
              Sell your groceries on Karrigo
            </h2>
            <div className="text-site-body text-on-accent/74 mt-md flex flex-col gap-sm">
              <span>
                New customers nearby, without opening another branch.
              </span>
              <span>We list your products for you from your price list.</span>
              <span>
                <strong className="font-bold">10% commission</strong> on what
                you sell. No sign-up fee. Weekly payouts to your bank.
              </span>
            </div>
            <div className="mt-auto pt-xxl">
              <ButtonLink href="/partners/store" variant="dark" size="site">
                Register your store
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — heading beside the list, not above it. */}
      <section data-aos="rise" className="px-screen-x mx-auto max-w-[1240px] pt-section-sm md:pt-section">
        <div className="gap-xxl grid items-start md:grid-cols-2 md:gap-gap-wide">
          <div>
            <h2 className="text-section-small md:text-section text-balance">
              Things people ask us
            </h2>
            <p className="text-site-body text-text-secondary mt-lg max-w-[32ch]">
              Anything else, call us — you reach a real person, not a
              form.
            </p>
            <Link
              href="/help"
              className="text-site-button text-accent-text mt-lg inline-block"
            >
              Visit help &rarr;
            </Link>
          </div>

          <FaqList />
        </div>
      </section>

      {/* App CTA — copy beside a phone showing the feed and a live order. */}
      <section data-aos="rise" className="px-screen-x pt-section-sm md:pt-section">
        <Screen
          mode="dark"
          className="rounded-panel-lg gap-xxl md:gap-gap-wide p-xxl md:p-pad-panel mx-auto grid max-w-[1240px] items-center md:grid-cols-2"
        >
          <div className="min-w-0">
            <Eyebrow tone="onDark">Download the app</Eyebrow>
            <h2 className="text-panel-small md:text-panel text-cream mt-lg text-balance">
              Karrigo, now in your pocket
            </h2>
            <p className="text-panel-body text-cream/65 mt-lg max-w-[38ch] text-pretty">
              Order faster, save your landmarks, and get push notifications the
              moment your rider leaves the kitchen.
            </p>
            <StoreButtons className="mt-xl" />
          </div>
          <div className="flex min-w-0 justify-center">
            <AppPreviewPhone />
          </div>
        </Screen>
      </section>

      {/* Closing CTA — the last word, in the fill colour, before the footer. */}
      <section data-aos="rise" className="px-screen-x pt-section-sm pb-xxl md:pt-section md:pb-pad-page-end">
        <div className="rounded-panel-lg bg-accent text-on-accent relative mx-auto max-w-[1240px] overflow-hidden p-xxl text-center md:p-[68px]">
          <div
            aria-hidden
            className="bg-accent-warm/22 pointer-events-none absolute top-[-60px] left-[-60px] size-[220px] rounded-full"
          />
          <div
            aria-hidden
            className="bg-on-accent/8 pointer-events-none absolute right-[-70px] bottom-[-70px] size-[250px] rounded-full"
          />
          <h2 className="text-cta-small md:text-cta relative text-balance">
            Hungry right now?
          </h2>
          <p className="text-panel-body text-on-accent/72 relative mx-auto mt-lg max-w-[44ch]">
            Order in the browser — every order comes with a link you can send on
            WhatsApp, so whoever is waiting at home can follow the rider too.
          </p>
          <div className="gap-sm relative mt-xxl flex flex-wrap justify-center">
            <ButtonLink href="/signup" variant="onAccent" size="site">
              Order now
            </ButtonLink>
            <ButtonLink href="/kitchens" variant="accentMuted" size="site">
              See all kitchens
            </ButtonLink>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
