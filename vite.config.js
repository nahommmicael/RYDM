// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      // devOptions: { enabled: true }, // optional im Dev
      workbox: {
        // nur „kleine“ Web-Assets in den Precache:
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        // große Medien explizit ignorieren:
        globIgnores: ["**/*.{mp3,m4a,wav,flac,mp4,webm,avif,jpg,jpeg}"],
        // (optional) falls doch mal was Großes mit muss, Limit erhöhen:
        // maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,

        // iTunes & Album-Art NUR online (keine SW-Caches):
        runtimeCaching: [
          { urlPattern: /\/api\/itunes\//, handler: "NetworkOnly" },
          { urlPattern: /^https:\/\/itunes\.apple\.com\//, handler: "NetworkOnly" },
          { urlPattern: /^https:\/\/is\d+\.mzstatic\.com\//, handler: "NetworkOnly" },
        ],

        navigateFallback: "/index.html",
      },
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "RYDM",
        short_name: "RYDM",
        start_url: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
          { src: "/masked-icon.svg", purpose: "any", type: "image/svg+xml" },
        ],
      },
    }),
  ],
});