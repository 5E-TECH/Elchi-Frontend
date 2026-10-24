import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fillInlineScriptHashes, inlineScriptHashes } from "./scripts/csp-headers.mjs";

const usePolling = process.env.VITE_USE_POLLING !== "false";

/**
 * Birinchi chizish uchun kerak bo'ladigan lazy chunklar entry bilan PARALLEL yuklansin (rzzxMItN): aks holda ular
 * entry yuklanib bajarilgandan KEYIN so'raladi — sekin mobil tarmoqda +0,5 s.
 *   - `/login` — kirish sahifasi chunklari (`src/features/auth`);
 *   - boshqa yo'llar — o'zbekcha tarjimalarning qolgan qismi (`src/locales/uzRest.ts`; `src/i18n.ts` chizishdan oldin
 *     kutadi, `/login` da esa kutmaydi).
 * Fayl nomlari xeshli — build oxirida bundle'dan olinadi; entry'ning o'zi yuklaydigan chunklar takrorlanmaydi.
 * Skript `<meta charset>` dan keyin, stylesheet'lardan OLDIN turadi: ichki skript oldingi CSS yuklanishini kutardi.
 */
const firstPaintPreload = (): Plugin => {
  let base = "/";
  return {
    name: "elchi-first-paint-preload",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(html, { bundle }) {
        if (!bundle) return html;
        const chunks = Object.values(bundle).flatMap((item) => (item.type === "chunk" ? [item] : []));
        const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
        const graph = (fileName: string, seen = new Set<string>()) => {
          if (seen.has(fileName)) return seen;
          seen.add(fileName);
          byName.get(fileName)?.imports.forEach((name) => graph(name, seen));
          return seen;
        };
        const entry = chunks.find((chunk) => chunk.isEntry);
        const chunkOf = (source: string) => chunks.find((chunk) => chunk.facadeModuleId?.endsWith(source));
        const login = chunkOf("/src/features/auth/index.tsx");
        const locales = chunkOf("/src/locales/uzRest.ts");
        if (!entry || !login || !locales) {
          throw new Error("elchi-first-paint-preload: entry, login yoki uzRest chunki topilmadi");
        }
        const eager = graph(entry.fileName);
        const extra = (chunk: { fileName: string }) =>
          [...graph(chunk.fileName)].filter((name) => !eager.has(name)).map((name) => `${base}${name}`);
        const files = JSON.stringify({ login: extra(login), app: extra(locales) });
        const script =
          `<script>(()=>{const f=${files};for(const href of /^\\/login\\/?$/i.test(location.pathname)?f.login:f.app){` +
          `const l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="";l.href=href;document.head.appendChild(l)}})()</script>`;
        const charset = /<meta charset="UTF-8" \/>/;
        if (!charset.test(html)) throw new Error("elchi-first-paint-preload: index.html da <meta charset> topilmadi");
        return html.replace(charset, (tag) => `${tag}\n    ${script}`);
      },
    },
  };
};

/**
 * CSP xeshlari (KwodkKWY): `public/_headers` → `dist/_headers` nusxasidagi `{{INLINE_SCRIPT_HASHES}}` o'rniga
 * yakuniy `dist/index.html` ichki skriptlarining `'sha256-…'` xeshlari yoziladi (preload skripti har build'da
 * o'zgaradi). Hisoblanmasa build yiqiladi (`scripts/csp-headers.mjs`).
 */
const cspInlineScriptHashes = (): Plugin => {
  let outDir = "dist";
  return {
    name: "elchi-csp-inline-script-hashes",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      const headersPath = resolve(outDir, "_headers");
      const htmlPath = resolve(outDir, "index.html");
      if (!existsSync(headersPath) || !existsSync(htmlPath)) {
        throw new Error("elchi-csp-inline-script-hashes: dist/_headers yoki dist/index.html topilmadi");
      }
      const hashes = inlineScriptHashes(readFileSync(htmlPath, "utf8"));
      writeFileSync(headersPath, fillInlineScriptHashes(readFileSync(headersPath, "utf8"), hashes));
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), firstPaintPreload(), cspInlineScriptHashes()],
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
    /**
     * Brauzer bazasi (js9ndYwA) — `package.json` → `browserslist` bilan bir xil: Chrome / Edge / Firefox 90+,
     * Safari / iOS 15.4+. JS sintaksisi shu bazaga tushiriladi (`??=`, private maydon, `static {}` — ES2020);
     * `src/test/browserTarget.test.ts` ikkalasini solishtiradi.
     * ⚠️ CSS: Tailwind v4 to'liq ko'rinish uchun Safari 16.4+ (`color-mix`, `@property`) talab qiladi; 15.4–16.3 da
     * Tailwind'ning `@supports` zaxiralari ishlaydi, `color-mix` li tokenlar (index.css) esa chizilmasligi mumkin.
     * `@vitejs/plugin-legacy` qo'shilmadi: 15.4 dan eski iOS (iPhone 6S / 7 / SE1 — iOS 15.8 gacha bo'lsa ham) bu bazadan
     * tashqarida; ularda `index.html` dagi zaxira blok «Brauzeringiz eskirgan» chiqadi.
     */
    target: ["es2020", "safari15", "chrome90"],
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Har til (ru / en) — bitta chunk: til almashganda 30 ta mayda so'rov emas.
          // uz bundle ichida qoladi (i18n.ts — eager).
          const locale = /\/src\/locales\/(en|ru)\//.exec(id)?.[1];
          if (locale) {
            return `locale-${locale}`;
          }

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
