import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Última Mesa",
    short_name: "Última Mesa",
    description: "Mesas de último momento en los mejores restaurantes.",
    start_url: "/",
    display: "standalone",
    background_color: "#ece6da",
    theme_color: "#ece6da",
    lang: "es-AR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
