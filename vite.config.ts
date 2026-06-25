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

          if (id.includes("antd") || id.includes("@ant-design")) {
            return "vendor-antd";
          }

          if (id.includes("recharts") || id.includes("d3-")) {
            return "vendor-charts";
          }

          if (id.includes("jspdf")) {
            return "vendor-jspdf";
          }

          if (id.includes("html2canvas")) {
            return "vendor-html2canvas";
          }

          // ─── Qo'shimcha chunk ajratmalar ────────────────────────────────
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }

          if (id.includes("i18next") || id.includes("react-i18next")) {
            return "vendor-i18n";
          }

          if (id.includes("qrcode") || id.includes("jsqr")) {
            return "vendor-qrcode";
          }
        },
      },
    },
  },
});
