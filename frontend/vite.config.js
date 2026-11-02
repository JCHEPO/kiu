import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Agrega og:image y og:url al index.html cuando se conoce la URL pública del sitio (VITE_SITE_URL,
// p.ej. https://kiu.vercel.app). WhatsApp y Facebook necesitan la imagen con URL absoluta.
const ogAbsoluteUrls = (siteUrl) => ({
  name: "og-absolute-urls",
  transformIndexHtml() {
    if (!siteUrl) return [];
    const base = siteUrl.replace(/\/+$/, "");
    return [
      { tag: "meta", attrs: { property: "og:url", content: `${base}/` }, injectTo: "head" },
      { tag: "meta", attrs: { property: "og:image", content: `${base}/og-image.jpg` }, injectTo: "head" },
      { tag: "meta", attrs: { property: "og:image:width", content: "1200" }, injectTo: "head" },
      { tag: "meta", attrs: { property: "og:image:height", content: "630" }, injectTo: "head" }
    ];
  }
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), ogAbsoluteUrls(env.VITE_SITE_URL)],
    server: {
      allowedHosts: true
    }
  };
});
