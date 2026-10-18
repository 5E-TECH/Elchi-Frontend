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
  "src/pages/scan/index.tsx": "kamera ishi — /scan butunlay kamera ekrani, alohida ish (ega qarori 2026-10-16)",
  "src/shared/components/ScannerCameraModal.tsx": "kamera ishi — alohida (ega qarori 2026-10-16)",
  "src/pages/market-operators/index.tsx": "yopiq route (routes.tsx: guard doim false, maket yo'q) — ko'chirilmaydi (G2 spec §3.4)",
  "src/pages/payments/components/SalaryPaymentPopup.tsx": "yetib bo'lmaydigan v1 — «Maosh to'lash» UNAVAILABLE_ACTIONS da (Moliya spec §9)",
  "src/widgets/user-detail/ui/UserDetailWidget.tsx": "v1 — faqat /profile (G1: muzlatilgan); iste'molchisi yo'qolsa o'chiriladi",
  "src/entities/user/ui/UserInfoCards.tsx": "v1 — faqat UserDetailWidget ichida",
  "src/features/courier-transfer-branch/ui/TransferCourierButton.tsx": "v1 tugma v2 sahifalarda (UserDetailView, BranchEmployeesSection) — G1 qoldig'i, followups",
  "src/shared/components/button.tsx": "v1 Button primitivi — oxirgi iste'molchi (external_orders/create, G2) bilan o'chadi",
  "src/shared/components/Table/Table.tsx": "v1 Table primitivi — iste'molchilari G2/G3 + CustomerOrdersTable",
  "src/shared/components/pagination/index.tsx": "v1 pagination primitivi — G2 dan keyin o'chadi",
  "src/shared/components/PrintModeSelect.tsx": "v1 o'rami (ichi v2, menyu bandlari) — shared/ui ga ko'chirilguncha",
};
export const UI_IMPORT_RATCHET = {
  "src/shared/ui/ConfirmButton/ConfirmButton.tsx": "v1 o'rami (antd Button) — yagona iste'molchi DeleteNotificationButton G2 da o'chadi",
};

/**
 * BOSQICH A: G2/G3 worktree'larda quriladi — bu yo'llarda 5-bosqich qoidalari `warn` (`npm run lint` = `--quiet` ularni
 * ko'rsatmaydi; kuzatish — `npm run lint:report`). Egalik: G2 spec §6, G3 spec §7.
 * Bosqich B (G2 va G3 asosiy branchga qo'shilgach): `[]` — lintRatchet.test.ts shuni talab qiladi.
 */
export const STAGE_A_PENDING = [
  // G2
  "src/pages/integrations/**", "src/pages/partners/**", "src/pages/new_orders/external_orders/**", "src/entities/integrations/**",
  "src/pages/notifications/**", "src/pages/notification-send/**", "src/widgets/notification-table/**",
  "src/features/notification-create/**", "src/features/notification-edit/**", "src/features/notification-delete/**",
  "src/features/notification-dispatch/**", "src/features/notification-connect/**", "src/entities/notification/**",
  "src/pages/activity-logs/**", "src/widgets/activity-log/**", "src/entities/activity-log/**", "src/pages/ops/**",
  "src/pages/finance-operators/**", "src/pages/integrations-ops/**", "src/pages/investors-ops/**", "src/pages/logistics-ops/**",
  "src/pages/branch-ops/**", "src/pages/identity-ops/**", "src/pages/system-ops/**", "src/pages/logs/**",
  "src/pages/profile/**", "src/pages/settings/**", "src/widgets/notification-inbox/**", "src/features/notification-inbox/**",
  "src/features/push-notifications/**", "src/entities/notification-inbox/**",
  // G3
  "src/features/auth/**", "src/auth/**", "src/pages/scan/detail.tsx", "src/pages/scan/ui/**", "src/pages/scan/model/**",
  "src/pages/dispatch/**", "src/pages/courier-bulk/**", "src/shared/components/ScannerActionButton.tsx",
];
