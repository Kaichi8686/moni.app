import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "moni",
    short_name: "moni",
    description: "アイデアを持っている人と、一緒に実現できる人をつなぎ、プロジェクトとして進める場所。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fafaf8",
    theme_color: "#ff5c35",
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
