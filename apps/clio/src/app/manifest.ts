import type { MetadataRoute } from "next";

/** So Clio can be added to a phone's home screen and open like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clio",
    short_name: "Clio",
    description: "Chinese at your level.",
    start_url: "/",
    display: "standalone",
    background_color: "#eeebe4",
    theme_color: "#eeebe4",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
