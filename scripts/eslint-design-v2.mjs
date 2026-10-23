/**
 * DIZAYN v2, 5-bosqich — ESLint qo'riqchilari uchun MA'LUMOT.
 * O'qiydi: eslint.config.js (qoidalar) va src/test/lintRatchet.test.ts (ratchet ro'yxatlari faqat qisqaradi).
 * Qoidalar: `design-v2/raw-control` (core no-restricted-syntax) va `design-v2/ui-imports` (core no-restricted-imports).
 * Tiplar: `scripts/eslint-design-v2.d.mts` (shu fayl o'zgarsa, uni ham yangilang).
 */
const P = "src/shared/ui/primitives";

/** Dizayn tizimi qatlami — xom boshqaruv elementlari shu yerda yashaydi (primitivlar, v1 o'ramlari, 2-bosqich shell). */
export const DS_LAYER = ["src/shared/ui/**", "src/widgets/layout/**", "src/widgets/Sidebar/**", "src/widgets/header/**"];
export const TEST_FILES = ["src/**/*.test.{ts,tsx}", "src/**/__tests__/**", "src/test/**"];

export const RAW_CONTROL_SELECTORS = [
  {
    selector: "JSXOpeningElement[name.name='button']",
    message: `Dizayn v2: xom <button> yozilmaydi. Amal — Button / IconButton; karta, qator, chip, menyu bandi, kalit (role="switch"), ochib-yopish — Pressable (${P}). Asosli istisno: // eslint-disable-next-line design-v2/raw-control -- <sabab>`,
  },
  { selector: "JSXOpeningElement[name.name='select']", message: `Dizayn v2: xom <select> o'rniga Select (${P}; filtrda «Barchasi» + ×).` },
  { selector: "JSXOpeningElement[name.name='textarea']", message: `Dizayn v2: xom <textarea> o'rniga <Field><TextInput multiline /></Field> (${P}).` },
  {
    selector: "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value=/^(checkbox|radio|file|hidden)$/]))",
    message: `Dizayn v2: xom matn maydoni o'rniga <Field><TextInput mode="…" /></Field> yoki DateInput (${P}). Ruxsat: type="checkbox" | "radio" (.el-check / .el-radio), "file", "hidden" — satr ko'rinishida.`,
  },
  { selector: "JSXOpeningElement[name.name='dialog']", message: `Dizayn v2: <dialog> o'rniga Dialog / ConfirmDialog (${P}).` },
  { selector: "JSXAttribute[name.name='role'][value.value='button']", message: `Dizayn v2: role="button" o'rniga haqiqiy tugma — Button yoki Pressable (${P}).` },
  {
    selector: "JSXOpeningElement[name.name=/^(a|Link|NavLink)$/] > JSXAttribute[name.name='className'] > Literal[value=/(^|\\s)(bg-action|bg-success|bg-danger)(\\s|$)/]",
    message: `Dizayn v2: tugma ko'rinishidagi havola faqat buttonClasses({ variant }) bilan (${P}/Button).`,
  },
];

/** design-guard `ICON_LIBS` (scripts/design-guard.mjs) bilan bir ro'yxat — ESLint muharrirda darhol ko'rsatadi. */
const ICON_LIBS = [
  "@ant-design/icons", "@ant-design/icons/*", "@ant-design/icons-svg", "@ant-design/icons-svg/*",
  "react-icons", "react-icons/*", "@heroicons/react", "@heroicons/react/*", "@tabler/icons-react", "@tabler/icons",
  "@mui/icons-material", "@mui/icons-material/*", "@fortawesome/*", "@phosphor-icons/react", "phosphor-react",
  "react-feather", "@radix-ui/react-icons", "iconsax-react", "@iconify/react", "@remixicon/react",
  "react-bootstrap-icons", "@carbon/icons-react", "@primer/octicons-react", "ionicons", "boxicons",
];

export const UI_IMPORT_OPTIONS = {
  paths: [
    {
      name: "antd",
      allowImportNames: ["ConfigProvider", "theme", "QRCode"],
      message:
        "Dizayn v2: antd vizual komponenti o'rniga primitiv (src/shared/ui/primitives): Button/IconButton, Dialog/ConfirmDialog, Select, TextInput, DateInput/DateRange, DataTable + Pagination, Badge/StatusBadge, Card, Tabs/SegmentedControl, Spinner, EmptyState/ErrorState/Skeleton, StatCard; Alert → CODE-MAP `.el-alert`; Tooltip → title / aria-describedby; Switch → `.el-switch` + Pressable. Ruxsat: ConfigProvider, theme (provayder), QRCode.",
    },
  ],
  patterns: [
    { group: ["antd/*", "!antd/locale", "!antd/locale/*"], message: "Dizayn v2: antd chuqur importi taqiqlangan (faqat antd/locale/* — provayder uchun)." },
    { group: ICON_LIBS, message: "Dizayn v2: ikonka faqat lucide-react — kanonik nom design/icon-registry.json." },
  ],
};

/**
 * 5-bosqich ratchet — FAQAT QISQARADI (src/test/lintRatchet.test.ts). Kalit: fayl; qiymat: sabab.
 * Fayl tozalansa (xom element qolmasa) test uni ro'yxatdan olib tashlashni talab qiladi; ro'yxatni o'stirish —
 * testdagi `MAX_*` ni o'zgartirish (review'da ko'rinadi).
 */
export const RAW_CONTROL_RATCHET = {
  "src/pages/payments/components/SalaryPaymentPopup.tsx": "yetib bo'lmaydigan v1 — «Maosh to'lash» UNAVAILABLE_ACTIONS da (Moliya spec §9)",
  "src/shared/components/PrintModeSelect.tsx": "v1 o'rami (ichi v2, menyu bandlari) — shared/ui ga ko'chirilguncha",
  // Bosqich B integratsiyasi: iste'molchisiz v1 fayllar (UserInfoCards, button.tsx, Table, pagination) o'chirildi.
  // MO-1: `/market-operators` v2 ga ko'chirildi (oxirgi v1 route) — yozuv olindi.
};
/** Bosqich B: bo'sh — `ConfirmButton` (yagona yozuv) G2 da o'chirildi. Yangi yozuv faqat `MAX_UI` bilan. */
export const UI_IMPORT_RATCHET = {};

/**
 * BOSQICH A (tugadi): G2/G3 qurilayotganda ularning yo'llarida 5-bosqich qoidalari `warn` edi.
 * Bosqich B (G2 va G3 asosiy branchga qo'shildi): bo'sh — `design-v2/*` hamma joyda xato; lintRatchet.test.ts shuni
 * talab qiladi. Yangi yozuv qo'shilmaydi (qurilayotgan yo'l uchun ham — `Pressable` / primitiv yoki ratchet).
 */
export const STAGE_A_PENDING = [];
