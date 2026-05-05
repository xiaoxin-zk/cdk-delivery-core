"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

export function Turnstile({
  enabled,
  siteKey,
  onToken
}: {
  enabled: boolean;
  siteKey?: string;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !siteKey || !ref.current) return;
    const scriptId = "cf-turnstile-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    let widgetId: string | undefined;
    const timer = window.setInterval(() => {
      if (window.turnstile && ref.current && !widgetId) {
        widgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: onToken,
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken("")
        });
        window.clearInterval(timer);
      }
    }, 250);

    return () => {
      window.clearInterval(timer);
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [enabled, onToken, siteKey]);

  if (!enabled) return null;
  if (!siteKey) return <p className="text-sm text-ember">已开启 Turnstile，但 Site Key 或 Secret Key 未配置完整。</p>;
  return <div ref={ref} />;
}
