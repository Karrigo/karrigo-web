import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/app-links";
import { SITE_THEME_SCRIPT } from "@/lib/site-theme";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  // latin-ext carries U+20A6, the naira sign. Without it every price on the
  // site falls back to a system font mid-word.
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const DESCRIPTION =
  "Order from kitchens and stores near you in Makurdi. Pay by card, transfer or cash, and follow your rider to your gate.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "./" },
  title: "Karrigo — Food, groceries, delivered.",
  description: DESCRIPTION,
  applicationName: "Karrigo",
  openGraph: {
    type: "website",
    siteName: "Karrigo",
    locale: "en_NG",
    title: "Karrigo — Food, groceries, delivered.",
    description: DESCRIPTION,
    images: [{ url: "/brand/karrigo-icon.png", alt: "Karrigo" }],
  },
  twitter: { card: "summary", title: "Karrigo — Food, groceries, delivered.", description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#0E0F0D",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      // The inline script below may switch this to "dark" before React hydrates.
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SITE_THEME_SCRIPT }} />
      </head>
      <body className="font-sans min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Karrigo",
              url: SITE_URL,
              logo: `${SITE_URL}/brand/karrigo-icon.png`,
              areaServed: { "@type": "City", name: "Makurdi", containedInPlace: "Benue State, Nigeria" },
            }).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
