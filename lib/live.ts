"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

import { liveSocketAuth } from "@/app/live-actions";

/**
 * karrigo-be's `/tracking` socket. Events are only a nudge to re-read: the
 * page always fetches the real state from the API, so a missed or out-of-order
 * event can never leave it wrong. Polling stays on as the fallback.
 *
 * `onChange` also runs on every (re)connect and whenever the tab regains
 * focus, since anything could have happened while it was away.
 */
export function useLiveUpdates({
  scope,
  events,
  onChange,
  orderId,
  enabled = true,
}: {
  scope: "customer" | "kitchen" | "store";
  events: string[];
  onChange: () => void;
  /** Customers subscribe to one order; kitchens join their room by token. */
  orderId?: string;
  enabled?: boolean;
}) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  const eventKey = events.join(",");

  useEffect(() => {
    if (!enabled) return;
    let socket: Socket | null = null;
    let stopped = false;
    const refresh = () => latest.current();

    liveSocketAuth(scope).then((auth) => {
      if (!auth || stopped) return;
      socket = io(`${auth.origin}/tracking`, {
        transports: ["websocket"],
        // Re-read the cookie each attempt, so a token renewed since the last
        // connection is the one sent.
        auth: (cb) => {
          liveSocketAuth(scope).then((next) => cb({ token: next?.token ?? auth.token }));
        },
      });
      socket.on("connect", () => {
        if (orderId) socket?.emit("subscribe:order", { orderId });
        refresh();
      });
      for (const event of eventKey.split(",")) socket.on(event, refresh);
    });

    const onFocus = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onFocus);
      socket?.disconnect();
    };
  }, [scope, eventKey, orderId, enabled]);
}
