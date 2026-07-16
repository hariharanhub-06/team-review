import type { MetadataRoute } from "next";

/** Served at /manifest.webmanifest; Next links it from the document head. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HH Team — Engineering Work Tracker",
    short_name: "HH Team",
    description:
      "HH Team work tracking and productivity management for engineering projects",
    // Members land on their own dashboard; the middleware now bounces admins
    // from /dashboard to /admin, so this start_url is right for both roles.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0b1120",
    theme_color: "#1e3a8a",
    categories: ["productivity", "business"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "My Dashboard",
        short_name: "Dashboard",
        url: "/dashboard",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Tasks",
        short_name: "Tasks",
        url: "/admin/tasks",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
