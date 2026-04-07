import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "moni",
    short_name: "moni",
    description: "子ども・保護者・投資家をつなぐ起業支援アプリ",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6ff",
    theme_color: "#6366f1",
    categories: ["education", "social"],
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
