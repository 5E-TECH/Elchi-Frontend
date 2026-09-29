import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const usePolling = process.env.VITE_USE_POLLING !== "false";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      ignored: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.git/**",
        "**/.vite/**",
        "**/coverage/**",
        "**/playwright-report/**",
        "**/test-results/**",
      ],
      usePolling,
      interval: 500,
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("react-router")) {
            return "vendor-router";
          }

          if (id.includes("@reduxjs") || id.includes("react-redux")) {
            return "vendor-state";
          }

          if (id.includes("@tanstack/react-query")) {
            return "vendor-query";
          }

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("scheduler")
          ) {
            return "vendor-react";
          }

          // ⚠️ antd uchun yagona `vendor-antd` chunk YO'Q (2UGfsfOl): u butun
          // kutubxonani (326 KB gzip) har sahifada eager qilardi. Vite antd
          // komponentlarini ularni ishlatadigan route chunklariga o'zi bo'ladi.

          // ⚠️ recharts/d3 uchun ham qo'lda chunk yo'q: antd qoidasi olingach bu
          // qoida `vendor-charts` (112 KB gzip) ni entry'ga eager tortardi.
          // Grafiklar faqat ularni ko'rsatadigan (lazy) widget chunklarida.

          // ⚠️ jsPDF / html2canvas uchun qo'lda chunk YO'Q (z4uyw52T): u Vite
          // preload-helper'ni o'sha chunkka tortib, jsPDF'ni har sahifada (hatto
          // /login da) yuklatardi. Ular faqat dinamik import orqali keladi.

          // ─── Qo'shimcha chunk ajratmalar ────────────────────────────────
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }

          if (id.includes("i18next") || id.includes("react-i18next")) {
            return "vendor-i18n";
          }

        },
      },
    },
  },
});
