"use client";

import { Button } from "@/components/ui/Button";

export default function StoreConsoleError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="bg-bg rounded-panel-sm p-xxl text-center">
      <p className="text-site-title">We couldn&rsquo;t load this part of your store</p>
      <p className="text-site-body text-text-secondary mt-sm">
        Usually that is the connection. Nothing you saved has been lost.
      </p>
      <Button type="button" variant="accent" size="site" className="mt-xl" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
