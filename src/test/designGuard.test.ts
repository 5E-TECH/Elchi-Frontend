import { describe, expect, it } from "vitest";
import {
  BASELINE_FILE,
  buildBaseline,
  COLOUR_RULES,
  compareToBaseline,
  CSS_NAMED_COLOURS,
  formatBadIgnores,
  formatRegressions,
  isGuardedFile,
  isInV2Scope,
  loadBaseline,
  maskComments,
  OUTPUT_FORMAT_FILES,
  parseUnifiedDiff,
  RULES,
  scanSource,
  scanTree,
  resolveImportPath,
  serializeBaseline,
  V1_MODULES,
  V2_SCOPE_PENDING,
  type Baseline,
  type TreeScan,
} from "../../scripts/design-guard.mjs";

/**
 * DIZAYN v2 QO'RIQCHISI (ratchet) — docs/DESIGN_SYSTEM.md §12.3.
 *
 * Har PR'da (CI `npm test`) `src/**\/*.{ts,tsx}` skanerlanadi va har fayl × qoida soni
 * `design/guard-baseline.json` bilan solishtiriladi: son OSHSA — test yiqiladi va qaysi qatorni
 * qaysi v2 tokeni/formatlovchisi bilan almashtirish kerakligini ko'rsatadi. Eski kod qayta
 * yozilishga majbur emas, lekin yangi buzilish qo'shib bo'lmaydi.
 *
 * Qoidalar dvigateli: `scripts/design-guard.mjs` (CLI: `npm run design:guard`).
 */

const tree = scanTree();
const baseline = loadBaseline();

describe("design guard — Dizayn v2 ratchet", () => {
  it("scans the source tree (fast, non-empty)", () => {
    expect(tree.files.length).toBeGreaterThan(300);
    expect(tree.ms).toBeLessThan(5000);
  });

  it(`${BASELINE_FILE} mavjud`, () => {
    expect(
      baseline,
      `${BASELINE_FILE} topilmadi — npm run design:guard -- --update`,
    ).not.toBeNull();
  });

  it("hech bir fayl baseline'dan oshmaydi (yangi fayl = 0)", () => {
    const cmp = compareToBaseline(tree, baseline);
    if (cmp.stale.length) {
      // Ogohlantirish, xato emas: fayl o'chirilgan/ko'chirilgan. `--update` yozuvni olib tashlaydi.
      console.warn(
        `[design-guard] baseline'da mavjud bo'lmagan fayllar (npm run design:guard -- --update): ${cmp.stale.join(", ")}`,
      );
    }
    if (cmp.regressions.length) throw new Error(formatRegressions(cmp));
  });

  it("har design-guard-ignore markerida sabab bor", () => {
    const bad = formatBadIgnores(tree);
    expect(bad, `Sababsiz marker (format: // design-guard-ignore: <sabab>):\n${bad}`).toBe("");
  });
});

/* ───────────────────── Qoidalarning o'zi (dvigatel testi) ───────────────────── */

const counts = (src: string, file = "src/pages/demo/Demo.tsx") => scanSource(file, src).counts;

describe("design guard rules", () => {
  it("colour: hex / rgb() / hsl() — className, arbitrary value, style, JS", () => {
    expect(counts(`<div className="bg-[#fff] text-[#1f2853aa]" />`).colour).toBe(2);
    expect(counts(`<div className="shadow-[0_0_24px_rgba(43,80,216,.3)]" />`).colour).toBe(1);
    expect(
      counts(`<div style={{ color: "rgba(0,0,0,.5)", background: "hsl(220 10% 50%)" }} />`).colour,
    ).toBe(2);
    expect(counts(`const COLORS = ["#2b50d8", "#eb6834"];`).colour).toBe(2);
    expect(counts(`<div className="bg-surface text-text-muted" />`).colour).toBeUndefined();
    expect(
      counts(`// eski brend #576adb edi\nconst x = 1; /* rgba(0,0,0,1) */`).colour,
    ).toBeUndefined();
    expect(counts(`const a = "#fff";`, "src/shared/config/themeTokens.ts").colour).toBeUndefined();
    // Langar havolasi rang emas.
    expect(counts(`<a href="#add">x</a>`).colour).toBeUndefined();
  });

  it("palette: Tailwind default colour families with a shade", () => {
    const src = `<div className="bg-blue-500 hover:text-gray-400 border-t-red-200/50 from-indigo-600 dark:bg-slate-900" />`;
    expect(counts(src).palette).toBe(5);
    expect(
      counts(`<div className="bg-surface text-action-fg border-border bg-success-soft" />`).palette,
    ).toBeUndefined();
    const hint = scanSource("src/x.tsx", `<p className="text-gray-400" />`).violations[0].hint;
    expect(hint).toContain("text-text-muted");
    expect(scanSource("src/x.tsx", `<p className="bg-red-50" />`).violations[0].hint).toContain(
      "bg-danger-soft",
    );
  });

  it("palette: bg-white / text-white / black (v2: bg-surface, text-on-solid, bg-overlay)", () => {
    expect(
      counts(`<i className="bg-white text-white/70 border-black/10 bg-black/65" />`).palette,
    ).toBe(4);
    expect(
      counts(`<i className="whitespace-nowrap bg-surface text-on-solid" />`).palette,
    ).toBeUndefined();
    const res = scanSource("src/x.tsx", `<i className="bg-white text-white" />`);
    expect(res.violations[0].hint).toContain("bg-surface");
    expect(res.violations[1].hint).toContain("text-on-solid");
  });

  it("dark-pair: dark: colour variants (tokens adapt to the theme)", () => {
    expect(
      counts(
        `<i className="dark:bg-slate-800 dark:text-white/80 hover:dark:border-main dark:hover:text-text dark:!bg-surface" />`,
      )["dark-pair"],
    ).toBe(5);
    expect(
      counts(
        `<i className="dark:text-sm dark:border-0 dark:border-x dark:shadow-none dark:hidden" />`,
      )["dark-pair"],
    ).toBeUndefined();
    expect(
      scanSource("src/x.tsx", `<i className="dark:bg-raised" />`).violations[0].hint,
    ).toContain("o'zi moslashadi");
  });

  it("legacy: old token names in utilities and --color-* variables", () => {
    const src = `<div className="bg-main text-maindark border-border-soft text-primary bg-purple-soft bg-primarydark/40" />`;
    expect(counts(src).legacy).toBe(6);
    expect(
      counts(
        `<p style={{ color: "var(--color-main)" }} className="text-[color:var(--color-text-muted-dark)]" />`,
      ).legacy,
    ).toBe(2);
    expect(
      counts(
        `<div className="bg-card-surface text-dashboard-text-soft from-table-header-start bg-background-deep" />`,
      ).legacy,
    ).toBe(4);
    expect(
      counts(
        `<i className="bg-background border-glass-border bg-table-row-alt from-warning-start text-warning-text bg-surface-dark" />`,
      ).legacy,
    ).toBe(6);
    expect(
      counts(`<Button type="primary" className="main-content bg-action text-on-solid" />`).legacy,
    ).toBeUndefined();
    // v2 tokenlari eski nom emas.
    expect(
      counts(`<i className="bg-warning-soft text-warning-fg border-warning bg-bg text-text" />`)
        .legacy,
    ).toBeUndefined();
    // `purple-500` — palitra qoidasi, legacy emas (ikki marta sanalmaydi).
    expect(counts(`<b className="text-purple-500" />`)).toEqual({ palette: 1 });
    expect(scanSource("src/x.tsx", `<b className="bg-main" />`).violations[0].hint).toContain(
      "bg-action",
    );
  });

  it("money: Intl.NumberFormat, number toLocaleString, hard-coded currency", () => {
    expect(counts(`const s = new Intl.NumberFormat("uz-UZ").format(x);`).money).toBe(1);
    expect(counts(`const s = Number(v ?? 0).toLocaleString("uz-UZ");`).money).toBe(1);
    expect(counts("const s = `${fmt(v)} so'm`;").money).toBe(1);
    expect(counts(`<span>so'm</span>`).money).toBe(1);
    expect(counts(`const a = "сум"; const b = " UZS";`).money).toBe(2);
    expect(counts(`const d = new Date(ms).toLocaleString("uz-UZ");`).money).toBeUndefined();
    expect(counts(`const d = createdAt.toLocaleString(locale, {`).money).toBeUndefined();
    expect(counts(`const label = "Сумма заказа"; // 100 so'm`).money).toBeUndefined();
    expect(
      counts(
        `export const L = { uz: "so'm", ru: "сум", en: "UZS" };`,
        "src/shared/lib/formatMoney.ts",
      ).money,
    ).toBeUndefined();
    expect(scanSource("src/x.ts", `n.toLocaleString("uz-UZ")`).violations[0].hint).toContain(
      "formatMoneyLocalized",
    );
  });

  it("icons: only lucide-react", () => {
    expect(counts(`import { EditOutlined } from "@ant-design/icons";`).icons).toBe(1);
    expect(
      counts(`import {\n  EditOutlined,\n  PlusOutlined,\n} from "@ant-design/icons";`).icons,
    ).toBe(1);
    expect(counts(`import { FaBeer } from 'react-icons/fa';`).icons).toBe(1);
    expect(counts(`import X from "@ant-design/icons-svg/es/asn/EditOutlined";`).icons).toBe(1);
    expect(counts(`const Icon = lazy(() => import("@ant-design/icons"));`).icons).toBe(1);
    expect(counts(`import { Pencil, Plus } from "lucide-react";`).icons).toBeUndefined();
  });

  it("tiny-text: font-size below 12px", () => {
    expect(
      counts(
        `<p className="text-[10px] sm:text-[11px] text-[12px] text-xs text-[0.6rem] text-[0.75rem]" />`,
      )["tiny-text"],
    ).toBe(3);
    expect(counts(`<p style={{ fontSize: 10 }} />`)["tiny-text"]).toBe(1);
    expect(counts(`const o = { style: { fontSize: "11px" } };`)["tiny-text"]).toBe(1);
    expect(counts(`<text fontSize={9}>x</text>`)["tiny-text"]).toBe(1);
    expect(counts("const css = `font-size: 10px;`;")["tiny-text"]).toBe(1);
    expect(
      counts(`<p style={{ fontSize: 12 }} className="text-[13px]" />`)["tiny-text"],
    ).toBeUndefined();
  });

  it("v1-class: index.css v1 classes, not unrelated el-* names", () => {
    expect(
      counts(`<div className="el-card p-4"><b className="el-segmented-button-active el-muted-text" /></div>`)[
        "v1-class"
      ],
    ).toBe(3);
    expect(counts(`<div className="el-glass-control el-card-soft el-surface-page" />`)["v1-class"]).toBe(3);
    expect(counts(`<div className="model-card el-cardigan" data-el="card" />`)["v1-class"]).toBeUndefined();
  });

  it("weight: font-black / font-extrabold / fontWeight 800+", () => {
    expect(counts(`<b className="font-black sm:font-extrabold font-bold" />`).weight).toBe(2);
    expect(counts(`<text fontWeight={800} />`).weight).toBe(1);
    expect(counts(`const s = { fontWeight: "900" };`).weight).toBe(1);
    expect(counts(`const s = { fontWeight: 700 };`).weight).toBeUndefined();
  });

  it("gradient: Tailwind gradient utilities and CSS gradient functions", () => {
    expect(
      counts(`<div className="bg-linear-to-r bg-gradient-to-br bg-radial bg-conic-180" />`).gradient,
    ).toBe(4);
    expect(counts(`<div className="bg-[linear-gradient(135deg,var(--x),var(--y))]" />`).gradient).toBe(1);
    expect(counts("const css = `background: radial-gradient(circle, red, blue);`;").gradient).toBe(1);
    // SVG <linearGradient> — grafik maydoni, CSS gradient emas.
    expect(counts(`<linearGradient id="g" />`).gradient).toBeUndefined();
  });

  it("v1-helper: TYPO / TEXT / TONE / toneAccent / formatPercent / v1 components", () => {
    expect(counts(`<h1 className={TYPO.pageTitle}>{formatPercent(rate)}</h1>`)["v1-helper"]).toBe(2);
    expect(counts(`<p style={{ color: toneAccent("danger"), background: toneSoftBg("info") }} />`)["v1-helper"]).toBe(2);
    expect(counts(`const c = TONE[tone].accent; const t = TEXT.muted;`)["v1-helper"]).toBe(2);
    expect(counts(`import HeaderName from "../../shared/components/headerName";`)["v1-helper"]).toBe(1);
    expect(counts(`import { MetricCard } from "@/shared/ui/MetricCard";`)["v1-helper"]).toBe(1);
    expect(counts(`const n = node.TEXT_NODE; formatPercentLocalized(3);`)["v1-helper"]).toBeUndefined();
    expect(
      scanSource("src/shared/config/designSystem.ts", `export const toneAccent = (t) => TONE[t].accent;`).counts[
        "v1-helper"
      ],
    ).toBeUndefined();
  });

  describe("v1-helper: 1-bosqich o'rnini bosgan v1 modullari importi (yo'l aniq hal qilinadi)", () => {
    const v1 = (src: string, file = "src/pages/demo/Demo.tsx") => scanSource(file, src).counts["v1-helper"];
    const hintOf = (src: string, file = "src/pages/demo/Demo.tsx") =>
      scanSource(file, src).violations.map((v) => v.hint);

    it("resolveImportPath: nisbiy, @/, src/, /src/ shakllari; paket — null", () => {
      expect(resolveImportPath("../../shared/components/button", "src/pages/demo/Demo.tsx")).toBe(
        "src/shared/components/button",
      );
      expect(resolveImportPath("./button.tsx", "src/shared/components/popupUpdate.tsx")).toBe(
        "src/shared/components/button",
      );
      expect(resolveImportPath("@/shared/lib/formatDate", "src/x.ts")).toBe("src/shared/lib/formatDate");
      expect(resolveImportPath("src/shared/ui/StatusBadge/index", "src/x.ts")).toBe("src/shared/ui/StatusBadge");
      expect(resolveImportPath("/src/shared/config/statusColorMap.ts", "src/x.ts")).toBe(
        "src/shared/config/statusColorMap",
      );
      expect(resolveImportPath("antd", "src/x.ts")).toBeNull();
      expect(resolveImportPath("@ant-design/icons", "src/x.ts")).toBeNull();
    });

    it("v1 Button (shared/components/button) → Button", () => {
      expect(v1(`import Button from "../../shared/components/button";`)).toBe(1);
      expect(v1(`import Button from "@/shared/components/button";`)).toBe(1);
      expect(v1(`import Button from "src/shared/components/button.tsx";`)).toBe(1);
      expect(v1(`import Button from "./button";`, "src/shared/components/popupUpdate.tsx")).toBe(1);
      expect(v1(`import Button from "../../components/button";`, "src/shared/ui/FormPopup/FormPopup.tsx")).toBe(1);
      expect(v1(`export { default as Button } from "../../shared/components/button";`)).toBe(1);
      expect(v1(`const B = lazy(() => import("../../shared/components/button"));`)).toBe(1);
      expect(hintOf(`import Button from "../../shared/components/button";`)[0]).toContain("src/shared/ui/primitives");
    });

    it("v1 StatusBadge va pages/orders/list/OrderStatusBadge → StatusBadge / entities/order", () => {
      expect(v1(`import { StatusBadge } from "../../shared/ui/StatusBadge";`)).toBe(1);
      expect(v1(`import OrderStatusBadge from "../orders/list/OrderStatusBadge";`, "src/pages/dispatch/index.tsx")).toBe(1);
      expect(
        v1(
          `import OrderStatusBadge from "../../../OrderStatusBadge";`,
          "src/pages/orders/list/courier/list/ordertable/AllOrdersTable.tsx",
        ),
      ).toBe(1);
      expect(v1(`import OrderStatusBadge from "./OrderStatusBadge";`, "src/pages/orders/list/OrdersTable.tsx")).toBe(1);
      expect(hintOf(`import { StatusBadge } from "@/shared/ui/StatusBadge";`)[0]).toContain("src/entities/order");
      expect(hintOf(`import X from "@/pages/orders/list/OrderStatusBadge";`)[0]).toContain("src/entities/order");
    });

    it("statusColorMap → statusRegistry + tone.ts; formatDate → formatDateTimeLocalized", () => {
      expect(v1(`import { getStatusColor } from "../config/statusColorMap";`, "src/shared/ui/StatusBadge.tsx")).toBe(1);
      expect(hintOf(`import { getStatusColor } from "@/shared/config/statusColorMap";`)[0]).toMatch(
        /ORDER_STATUS_REGISTRY.*tone\.ts/,
      );
      expect(v1(`import { formatDate } from "../../../shared/lib/formatDate";`, "src/widgets/a/ui/A.tsx")).toBe(1);
      expect(hintOf(`import { formatDate } from "@/shared/lib/formatDate";`)[0]).toContain("formatDateTimeLocalized");
      // Ko'p qatorli import: yo'l `from` qatorida.
      expect(v1(`import {\n  formatDate,\n} from "../../shared/lib/formatDate";`)).toBe(1);
    });

    it("v2 nomdoshlar, boshqa joydagi bir xil nomli fayllar, oddiy satr va izohlar — tutilmaydi", () => {
      expect(v1(`import { Button } from "../../shared/ui/primitives/Button";`)).toBeUndefined();
      expect(v1(`import { Button, StatusBadge } from "../../shared/ui/primitives";`)).toBeUndefined();
      expect(v1(`import { StatusBadge } from "../../shared/ui/primitives/StatusBadge";`)).toBeUndefined();
      expect(v1(`import { OrderStatusBadge } from "../../entities/order";`)).toBeUndefined();
      expect(v1(`import { OrderStatusBadge } from "../../entities/order/ui/OrderStatusBadge";`)).toBeUndefined();
      expect(v1(`import { ORDER_STATUS_REGISTRY } from "@/entities/order/model/statusRegistry";`)).toBeUndefined();
      expect(v1(`import { formatDateTimeLocalized } from "../../shared/lib/formatDateTime";`)).toBeUndefined();
      expect(v1(`import { formatDate } from "../../shared/lib/formatDateRange";`)).toBeUndefined();
      expect(v1(`import { Button } from "antd";`)).toBeUndefined();
      // `src/pages/demo/button` — boshqa modul (nisbiy yo'l fayl joyidan hal qilinadi).
      expect(v1(`import Button from "./button";`)).toBeUndefined();
      expect(v1(`import Button from "../shared/components/button";`)).toBeUndefined();
      expect(v1(`const path = "../../shared/components/button";`)).toBeUndefined();
      expect(v1(`// import Button from "../../shared/components/button";`)).toBeUndefined();
    });

    it("har v1 modul uchun hint v2 o'rnini bosuvchisini nomlaydi", () => {
      expect(Object.keys(V1_MODULES).sort()).toEqual([
        "src/pages/orders/list/OrderStatusBadge",
        "src/shared/components/button",
        "src/shared/config/statusColorMap",
        "src/shared/lib/formatDate",
        "src/shared/ui/StatusBadge",
      ]);
      for (const hint of Object.values(V1_MODULES)) expect(hint).toMatch(/→/);
    });
  });

  describe("named-colour: nomli CSS rangi (white, red …) — faqat tokenlar", () => {
    const named = (src: string, file?: string) => counts(src, file)["named-colour"];

    it("JSX / HTML rang atributlari", () => {
      expect(named(`<path d="M0 0" fill="none" stroke="white" strokeLinecap="round" />`)).toBe(1);
      expect(named(`<Tag color="red">x</Tag>`)).toBe(1);
      expect(named(`<stop stopColor={"navy"} floodColor='Gold' />`)).toBe(2);
      expect(named(`<Progress strokeColor="green" trailColor="lightgray" />`)).toBe(2);
      expect(named(`const svg = '<svg><stop offset="0" stop-color="white" /></svg>';`)).toBe(1);
    });

    it("style / konfig obyekti kalitlari", () => {
      expect(named(`<div style={{ color: "green", backgroundColor: 'white' }} />`)).toBe(2);
      expect(named(`const s = { border: "1px solid black", boxShadow: "0 0 0 1px red" };`)).toBe(2);
      expect(named(`const TAG = { recorded: { labelKey: "poRecorded", color: "orange" } };`)).toBe(1);
      expect(named(`const s = { fill: "Tomato", outlineColor: "silver" };`)).toBe(2);
    });

    it("satr / template ichidagi CSS va Tailwind ixtiyoriy qiymati", () => {
      expect(named("const css = `body { color: black; background: white; }`;")).toBe(2);
      expect(named(`const html = '<td style="border-bottom: 1px solid silver">';`)).toBe(1);
      // `fill-[color:navy]` ikki naqshga (Tailwind qiymati + CSS xossasi) mos — bir joy bir marta sanaladi.
      expect(named(`<i className="bg-[white] text-[red] fill-[color:navy] [color:teal]" />`)).toBe(4);
      expect(named(`<p style="color: red" color="red" />`)).toBe(2);
    });

    it("ifoda tarmoqlari va qo'shtirnoqli kalit: ternar / ?? / \"color\":", () => {
      expect(named(`<svg stroke={dark ? "white" : "black"} fill={c ?? 'navy'} />`)).toBe(3);
      expect(named(`<Tag color={ok ? "green" : "red"}>x</Tag>`)).toBe(2);
      expect(named(`<path stroke={"white"} />`)).toBe(1); // ATTR + ATTR_EXPR — bir joy bir marta
      expect(named(`const s = { color: ok ? "green" : "red", tone: "red" };`)).toBe(2);
      expect(named(`const j = { "color": "red", 'fill': 'Navy' };`)).toBe(2);
      // rang kaliti emas yoki qo'shtirnoqsiz/so'z ichida — sanalmaydi
      expect(named(`<p title={ok ? "red" : "blue"} data-tone={t ? "green" : "x"} />`)).toBeUndefined();
      expect(named(`const s = { label: ok ? "red" : "blue", color: ok ? tone : fallback };`)).toBeUndefined();
      expect(named(`type P = { color?: "primary" | "danger" };`)).toBeUndefined();
    });

    it("rang emas: transparent / currentColor / inherit / none, so'z ichida, oddiy satr, tip, izoh", () => {
      expect(
        named(
          `<svg fill="currentColor" stroke="none" color="inherit" style={{ background: "transparent" }} />`,
        ),
      ).toBeUndefined();
      expect(
        named(`<i className="text-on-solid fill-current" title="red" data-tone="green" />`),
      ).toBeUndefined();
      expect(named(`const s = { color: "redish", fill: "whitesmoke2", border: "1px solid tan-ish" };`)).toBeUndefined();
      expect(named(`const label = "white"; const tones = ["red", "green"];`)).toBeUndefined();
      expect(named(`type P = { color: string; fill?: Red; background: White };`)).toBeUndefined();
      expect(named(`// stroke="white" edi\nconst x = 1; /* color: red; */`)).toBeUndefined();
      expect(named(`<p className="text-[color:var(--color-text-muted)] border-border" />`)).toBeUndefined();
    });

    it("istisno: themeTokens.ts va OUTPUT_FORMAT_FILES; hint tokenni nomlaydi", () => {
      expect(named(`const a = { color: "white" };`, "src/shared/config/themeTokens.ts")).toBeUndefined();
      expect(named("const css = `color: black;`;", "src/pages/mails/detail/lib/printMode.ts")).toBeUndefined();
      const v = scanSource("src/x.tsx", `<path stroke="white" />`).violations[0];
      expect([v.rule, v.match, v.col]).toEqual(["named-colour", "white", 15]);
      expect(v.hint).toMatch(/fill-current/);
      expect(v.hint).toMatch(/tone/);
    });

    it("148 ta CSS nomi; transparent / currentColor / inherit / none — yo'q", () => {
      expect(CSS_NAMED_COLOURS).toHaveLength(148);
      expect(new Set(CSS_NAMED_COLOURS).size).toBe(148);
      for (const word of ["transparent", "currentcolor", "currentColor", "inherit", "none", "initial"])
        expect(CSS_NAMED_COLOURS).not.toContain(word);
      for (const word of ["white", "black", "red", "rebeccapurple", "lightgoldenrodyellow"])
        expect(CSS_NAMED_COLOURS).toContain(word);
    });
  });

  it("palette: palitra CSS o'zgaruvchisi (var(--color-blue-500)) va dinamik oila (bg-${c}-500)", () => {
    expect(
      counts(
        `<p style={{ color: "var(--color-blue-500)" }} className="bg-(--color-gray-400) text-[color:var(--color-red-600)]" />`,
      ).palette,
    ).toBe(3);
    expect(counts("const c = `bg-${tone}-500 text-${t}-700`;").palette).toBe(2);
    expect(
      counts(
        "<p style={{ color: \"var(--color-text-muted)\" }} className={`bg-(--color-surface) bg-${tone}-soft`} />",
      ).palette,
    ).toBeUndefined();
    // `--color-purple-500` — palitra (legacy emas, ikki marta sanalmaydi).
    expect(counts(`const v = "var(--color-purple-500)";`)).toEqual({ palette: 1 });
    expect(scanSource("src/x.tsx", `const v = "var(--color-gray-400)";`).violations[0].hint).toContain(
      "var(--color-text-muted)",
    );
    expect(scanSource("src/x.tsx", "const c = `bg-${c}-100`;").violations[0].hint).toContain("TONE_SOFT");
  });
});

describe("design guard --diff", () => {
  it("parses added/removed line numbers per file (renames keep the old path)", () => {
    const diff = [
      "diff --git a/src/a.tsx b/src/a.tsx",
      "--- a/src/a.tsx",
      "+++ b/src/a.tsx",
      "@@ -3 +3,2 @@",
      "-old",
      "+new",
      "+new2",
      "@@ -10,2 +11,0 @@",
      "diff --git a/src/old.tsx b/src/new.tsx",
      "--- a/src/old.tsx",
      "+++ b/src/new.tsx",
      "@@ -1,0 +2 @@",
      "diff --git a/src/gone.tsx b/src/gone.tsx",
      "--- a/src/gone.tsx",
      "+++ /dev/null",
      "@@ -1,2 +0,0 @@",
    ].join("\n");
    const [a, renamed, gone] = parseUnifiedDiff(diff);
    expect([a.oldPath, a.newPath, [...a.added], [...a.removed]]).toEqual([
      "src/a.tsx",
      "src/a.tsx",
      [3, 4],
      [3, 10, 11],
    ]);
    expect([renamed.oldPath, renamed.newPath, [...renamed.added], [...renamed.removed]]).toEqual([
      "src/old.tsx",
      "src/new.tsx",
      [2],
      [],
    ]);
    expect([gone.newPath, [...gone.removed]]).toEqual([null, [1, 2]]);
  });
});

describe("design-guard-ignore", () => {
  it("skips exactly one line (previous-line marker)", () => {
    const res = scanSource(
      "src/x.ts",
      `// design-guard-ignore: QR kod oq-qora bo'lishi shart\nconst a = "#000000";\nconst b = "#ffffff";`,
    );
    expect(res.counts.colour).toBe(1);
    expect(res.violations[0].line).toBe(3);
    expect(res.ignored).toBe(1);
  });

  it("works on the same line and as a JSX comment", () => {
    expect(
      counts(`const a = "#000"; // design-guard-ignore: chop etish uchun qora`).colour,
    ).toBeUndefined();
    expect(
      counts(
        `<>\n  {/* design-guard-ignore: brend logotipi */}\n  <i className="bg-[#1f2853]" />\n</>`,
      ).colour,
    ).toBeUndefined();
  });

  it("requires a non-empty reason (otherwise nothing is skipped and the marker is reported)", () => {
    const noColon = scanSource("src/x.ts", `// design-guard-ignore\nconst a = "#fff";`);
    expect(noColon.counts.colour).toBe(1);
    expect(noColon.badIgnores).toHaveLength(1);
    const empty = scanSource("src/x.ts", `const a = "#fff"; // design-guard-ignore:   `);
    expect(empty.counts.colour).toBe(1);
    expect(empty.badIgnores).toHaveLength(1);
  });

  it("is not a marker inside a string literal", () => {
    expect(counts(`const s = "design-guard-ignore: x"; const c = "#fff";`).colour).toBe(1);
  });
});

describe("design guard engine", () => {
  it("masks only comments (strings, templates, regex literals stay)", () => {
    const src = [
      `const url = "https://elchi.uz"; // izoh #fff`,
      'const t = `${a ? "x" : "y"} // matn, izoh emas`;',
      "const re = /[\"'`]/g; // izoh",
      `const c = "#fff";`,
      `<p>Don't {/* izoh */} so'm</p>`,
    ].join("\n");
    const masked = maskComments(src).split("\n");
    expect(masked).toHaveLength(5);
    expect(masked[0]).toContain(`"https://elchi.uz";`);
    expect(masked[0]).not.toContain("izoh");
    expect(masked[1]).toContain("// matn, izoh emas");
    expect(masked[2]).not.toContain("izoh");
    expect(masked[3]).toContain(`"#fff"`);
    expect(masked[4]).not.toContain("izoh");
    expect(masked[4]).toContain("so'm");
  });

  it("guards src/**/*.{ts,tsx} except tests, locales and src/test", () => {
    expect(isGuardedFile("src/pages/orders/index.tsx")).toBe(true);
    expect(isGuardedFile("src/shared/lib/formatMoney.ts")).toBe(true);
    expect(isGuardedFile("src/pages/orders/index.test.tsx")).toBe(false);
    expect(isGuardedFile("src/test/setup.ts")).toBe(false);
    expect(isGuardedFile("src/locales/uz/common.ts")).toBe(false);
    expect(isGuardedFile("src/features/push-notifications/test/pushEnv.ts")).toBe(false);
    expect(isGuardedFile("src/vite-env.d.ts")).toBe(false);
  });

  const scanOf = (files: Record<string, string>): TreeScan => ({
    root: "/virtual",
    ms: 0,
    files: Object.entries(files).map(([file, text]) => scanSource(file, text)),
  });
  const base = (files: Baseline["files"]): Baseline => ({
    $comment: "",
    version: 1,
    rules: {} as Baseline["rules"],
    increases: [],
    files,
  });

  it("ratchet: increase fails, decrease passes, new file starts at 0, stale is only reported", () => {
    const scan = scanOf({
      "src/a.tsx": `<p className="bg-main text-main" />`,
      "src/b.tsx": `<p className="bg-blue-500" />`,
      "src/c.tsx": `<p className="bg-surface" />`,
    });
    const cmp = compareToBaseline(
      scan,
      base({ "src/a.tsx": { legacy: 3 }, "src/gone.tsx": { colour: 1 } }),
    );
    expect(cmp.regressions.map((r) => [r.file, r.rule, r.count, r.baseline, r.newFile])).toEqual([
      ["src/b.tsx", "palette", 1, 0, true],
    ]);
    expect(cmp.improvements).toEqual([
      { file: "src/a.tsx", rule: "legacy", count: 2, baseline: 3 },
    ]);
    expect(cmp.stale).toEqual(["src/gone.tsx"]);
    expect(cmp.totals["dark-pair"]).toEqual({ current: 0, baseline: 0 });
    const message = formatRegressions(cmp);
    expect(message).toContain("src/b.tsx");
    expect(message).toContain("bg-blue-500");
    expect(message).toContain("bg-action");
  });

  it("// dizayn-v2: file ignores its baseline (allowed 0) and is not written to the baseline", () => {
    const v2 = `// dizayn-v2: admin-orders\n<p className="bg-main" />`;
    const scan = scanOf({ "src/pages/orders/index.tsx": v2 });
    expect(scan.files[0].v2).toBe(true);
    const cmp = compareToBaseline(scan, base({ "src/pages/orders/index.tsx": { legacy: 5 } }));
    expect(cmp.regressions.map((r) => [r.rule, r.count, r.baseline, r.v2File])).toEqual([
      ["legacy", 1, 0, true],
    ]);
    expect(formatRegressions(cmp)).toContain("dizayn-v2");
    const clean = scanOf({ "src/pages/orders/index.tsx": `// dizayn-v2: admin-orders\n<p />` });
    expect(
      buildBaseline(clean, base({ "src/pages/orders/index.tsx": { legacy: 5 } })).files,
    ).toEqual({});
    expect(scanSource("src/x.tsx", `const a = 1; // dizayn-v2: x`).v2).toBe(false);
  });

  it("--update refuses to raise counts without a reason and records the reason", () => {
    const scan = scanOf({ "src/a.tsx": `<p className="bg-main text-main" />` });
    const previous = base({ "src/a.tsx": { legacy: 1 } });
    expect(() => buildBaseline(scan, previous)).toThrow(/--allow-increase/);
    const next = buildBaseline(scan, previous, {
      allowIncrease: "ShipmentCard bo'lindi",
      date: "2026-10-15",
    });
    expect(next.files).toEqual({ "src/a.tsx": { legacy: 2 } });
    expect(next.increases).toEqual([
      {
        date: "2026-10-15",
        reason: "ShipmentCard bo'lindi",
        changes: { "src/a.tsx": { legacy: [1, 2] } },
      },
    ]);
    // Kamayish va eskirgan yozuvni o'chirish sababsiz ruxsat.
    const lowered = buildBaseline(
      scanOf({ "src/a.tsx": `<p />` }),
      base({ "src/a.tsx": { legacy: 4 }, "src/old.tsx": { money: 1 } }),
    );
    expect(lowered.files).toEqual({});
    expect(JSON.parse(serializeBaseline(next))).toEqual(next);
  });

  describe("V2_SCOPES: migratsiya qilingan papkadagi har fayl rang qoidalarida 0", () => {
    // Haqiqiy scope ichidagi belgisiz yordamchi va haqiqiy V2_SCOPE_PENDING fayli.
    const scopedFile = "src/pages/orders/list/orderFilterModel.ts";
    const pendingFile = "src/pages/payments/components/SalaryPaymentPopup.tsx";
    const dirty = `const cls = "text-gray-400"; const s = n.toLocaleString("uz-UZ");`;

    it("isInV2Scope / scanSource().scoped: scope, pending, v2, boshqa", () => {
      expect(isInV2Scope("src/pages/orders/list/x.ts")).toBe(true);
      expect(isInV2Scope("src/shared/ui/primitives/Button.tsx")).toBe(true);
      expect(isInV2Scope("src/pages/ordersX/x.ts")).toBe(false); // papka chegarasi
      expect(isInV2Scope("src/pages/orders")).toBe(false);
      expect(isInV2Scope("src/shared/ui/BackButton.tsx")).toBe(false); // shared/ui butunligicha emas
      expect(scanSource(scopedFile, "export {};").scoped).toBe(true);
      expect(scanSource(pendingFile, "export {};").scoped).toBe(false);
      expect(pendingFile in V2_SCOPE_PENDING).toBe(true);
      expect(scanSource("src/pages/demo/Demo.tsx", "export {};").scoped).toBe(false);
      expect(scanSource("src/pages/demo/Demo.tsx", "// dizayn-v2: demo\nexport {};").scoped).toBe(true);
    });

    it("compareToBaseline: scope fayli — rang ruxsati 0, money ruxsati saqlanadi", () => {
      const cmp = compareToBaseline(
        scanOf({ [scopedFile]: dirty }),
        base({ [scopedFile]: { palette: 3, money: 1 } }),
      );
      expect(cmp.regressions.map((r) => [r.rule, r.count, r.baseline, r.scopeFile, r.v2File])).toEqual([
        ["palette", 1, 0, true, false],
      ]);
      expect(formatRegressions(cmp)).toContain("V2_SCOPES: rang qoidalarida ruxsat 0");
      expect(formatRegressions(cmp)).toContain("text-gray-400");
      // Scope'dan tashqaridagi xuddi shu fayl — baseline bo'yicha (regressiya yo'q).
      const outside = "src/pages/demo/orderFilterModel.ts";
      expect(
        compareToBaseline(scanOf({ [outside]: dirty }), base({ [outside]: { palette: 3, money: 1 } }))
          .regressions,
      ).toEqual([]);
    });

    it("buildBaseline: scope faylining rang soni yozilmaydi, --allow-increase ham qotirmaydi", () => {
      const scan = scanOf({ [scopedFile]: dirty });
      // Rang regressiyasi baseline bilan tuzalmaydi — sabab so'ralmaydi, lekin yozilmaydi ham.
      const next = buildBaseline(scan, base({ [scopedFile]: { palette: 3, money: 1 } }));
      expect(next.files).toEqual({ [scopedFile]: { money: 1 } });
      expect(next.increases).toEqual([]);
      const forced = buildBaseline(scan, base({}), { allowIncrease: "sinov", date: "2026-10-17" });
      expect(forced.files).toEqual({ [scopedFile]: { money: 1 } });
      expect(forced.increases).toEqual([
        { date: "2026-10-17", reason: "sinov", changes: { [scopedFile]: { money: [0, 1] } } },
      ]);
      // Qotirilgandan keyin ham rang regressiyasi qoladi.
      expect(compareToBaseline(scan, forced).regressions.map((r) => r.rule)).toEqual(["palette"]);
    });

    it("o'lik yozuv: scope / v2 faylining baseline'dagi rang soni, buzilish qolmasa — yaxshilanish (--update o'chiradi)", () => {
      const v2File = "src/pages/orders/index.tsx";
      const scan = scanOf({ [scopedFile]: "export const a = 1;", [v2File]: "// dizayn-v2: x\nexport {};" });
      const previous = base({ [scopedFile]: { "named-colour": 4, money: 1 }, [v2File]: { legacy: 2 } });
      const cmp = compareToBaseline(scan, previous);
      expect(cmp.regressions).toEqual([]);
      expect(cmp.improvements).toEqual([
        { file: scopedFile, rule: "money", count: 0, baseline: 1 },
        { file: scopedFile, rule: "named-colour", count: 0, baseline: 4 },
        { file: v2File, rule: "legacy", count: 0, baseline: 2 },
      ]);
      expect(buildBaseline(scan, previous).files).toEqual({});
    });

    it("V2_SCOPE_PENDING fayli baseline ruxsatini saqlaydi (rangda ham)", () => {
      const src = `<p className="bg-main text-gray-400" />`;
      const scan = scanOf({ [pendingFile]: src });
      const previous = base({ [pendingFile]: { palette: 1, legacy: 1 } });
      expect(compareToBaseline(scan, previous).regressions).toEqual([]);
      expect(buildBaseline(scan, previous).files).toEqual({ [pendingFile]: { palette: 1, legacy: 1 } });
    });

    it("haqiqiy fayl: scope yordamchisiga text-gray-400 qo'shilsa joriy baseline bilan yiqiladi", () => {
      const text = Object.values(
        import.meta.glob("../pages/orders/list/orderFilterModel.ts", {
          eager: true,
          query: "?raw",
          import: "default",
        }) as Record<string, string>,
      )[0];
      expect(text.length).toBeGreaterThan(100);
      expect(scanSource(scopedFile, text).v2).toBe(false); // belgisiz yordamchi
      const injected = scanSource(scopedFile, `${text}\nexport const injected = "text-gray-400";\n`);
      const cmp = compareToBaseline({ root: "/virtual", ms: 0, files: [injected] }, baseline);
      expect(cmp.regressions.map((r) => [r.file, r.rule, r.scopeFile])).toEqual([
        [scopedFile, "palette", true],
      ]);
    });

    it("bosqich B: G2/G3 papkalari scope'da; /scan kamera ekrani ham v2 (skaner 1-bosqich); eski antd rang nomi qaytmaydi", () => {
      for (const file of [
        "src/entities/integrations/payments.ts", // belgisiz yordamchi (ilgari `color: "red"` xaritasi)
        "src/pages/integrations/panels/ConnectionLog.tsx",
        "src/pages/notifications/ui/SmsSettingsTab.tsx", // ilgari antd Tag rang nomi
        "src/pages/settings/ui/SettingsPage.tsx",
        "src/features/auth/index.tsx",
        "src/auth/authService.ts", // G3 — FSD qatlamidan tashqari papka
        "src/pages/dispatch/index.tsx",
        "src/pages/courier-bulk/index.tsx",
        "src/pages/scan/detail.tsx",
      ]) {
        expect(isInV2Scope(file), file).toBe(true);
      }
      expect(isInV2Scope("src/authX/a.ts")).toBe(false); // papka chegarasi
      // Universal skaner (`/scan`) skaner 1-bosqichida v2 ga o'tdi (2026-10-19): pending emas, rangda 0.
      const camera = "src/pages/scan/index.tsx";
      expect(camera in V2_SCOPE_PENDING).toBe(false);
      expect(scanSource(camera, "export {};").scoped).toBe(true);
      // Haqiqiy payments.ts: toza; eski baseline'dagi named-colour ruxsati endi hisobga olinmaydi.
      const file = "src/entities/integrations/payments.ts";
      const text = Object.values(
        import.meta.glob("../entities/integrations/payments.ts", {
          eager: true,
          query: "?raw",
          import: "default",
        }) as Record<string, string>,
      )[0];
      expect(text).toContain("paymentOutcome");
      const clean = scanSource(file, text);
      expect(clean.scoped).toBe(true);
      expect(COLOUR_RULES.filter((id) => clean.counts[id])).toEqual([]);
      const injected = scanSource(file, `${text}\nexport const legacy = { labelKey: "x", color: "red" };\n`);
      const cmp = compareToBaseline(
        { root: "/virtual", ms: 0, files: [injected] },
        base({ [file]: { "named-colour": 10, money: 1 } }),
      );
      expect(cmp.regressions.map((r) => [r.file, r.rule, r.count, r.baseline, r.scopeFile])).toEqual([
        [file, "named-colour", 1, 0, true],
      ]);
    });

    it("OUTPUT_FORMAT_FILES: rang qoidalari qo'llanmaydi, boshqa qoidalar (money) qo'llanadi", () => {
      const printFile = "src/pages/mails/detail/lib/printMode.ts";
      expect(printFile in OUTPUT_FORMAT_FILES).toBe(true);
      const res = scanSource(
        printFile,
        "const css = `body { color: black; background: #fff; border: 1px solid rgba(0,0,0,.2) }`;\n" +
          'const cls = "bg-white text-gray-900 dark:bg-black bg-main bg-linear-to-r"; const s = `${x} so\'m`;',
      );
      expect(res.counts).toEqual({ money: 1 });
      // Haqiqiy faylga hex qo'shilsa ham rang hisobga kirmaydi.
      const real = Object.values(
        import.meta.glob("../pages/mails/detail/lib/printMode.ts", {
          eager: true,
          query: "?raw",
          import: "default",
        }) as Record<string, string>,
      )[0];
      expect(real.length).toBeGreaterThan(100);
      expect(scanSource(printFile, `${real}\nconst injected = "#123456";\n`).counts.colour).toBeUndefined();
      // Har chiqish fayli har rang qoidasidan istisno, rangsiz qoidalardan esa yo'q.
      for (const file of Object.keys(OUTPUT_FORMAT_FILES)) {
        for (const rule of RULES) {
          expect(rule.exempt.includes(file), `${rule.id} × ${file}`).toBe(COLOUR_RULES.includes(rule.id));
        }
      }
    });
  });
});
