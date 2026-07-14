"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";

/**
 * The `beforeinstallprompt` event, which is Chromium-only and not in lib.dom.
 * Firefox and iOS Safari never fire it — see InstallButton for how they install.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Registers the service worker. Render once, in the root layout. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Registering after load keeps the SW off the critical path.
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker registration failed", err);
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}

/**
 * Reload button. An installed PWA has no browser chrome, so there is no way to
 * refresh a stale screen — this is it. A full reload (rather than
 * router.refresh()) also re-runs client-side fetches and picks up a new build,
 * and is safe: the service worker never caches pages or /api responses.
 */
export function RefreshButton() {
  const [spinning, setSpinning] = useState(false);

  function refresh() {
    setSpinning(true);
    window.location.reload();
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={refresh}
      disabled={spinning}
      title="Refresh"
      aria-label="Refresh"
    >
      <span className={spinning ? "inline-block animate-spin" : undefined}>🔄</span>
    </Button>
  );
}

/**
 * "Install app" button. Only appears when the browser says the app is
 * installable and it is not already running as one, so it stays out of the way
 * for anyone who has installed it (or is on a browser that cannot).
 */
export function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      // Stop Chrome's own mini-infobar; we surface our own button instead.
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt) return null;

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    // The event is single-use: once prompted, it cannot be reused.
    setPrompt(null);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={install}
      title="Install HH Team as an app on this device"
    >
      ⬇️ Install app
    </Button>
  );
}
