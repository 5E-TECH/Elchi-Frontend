import { defineScene } from "../support/test";

/**
 * Primitivlar katalogi (`/ops/ui-kit`, faqat superadmin) — FAQAT «Yuklanish, bo'sh va xato holatlari» bo'limi
 * (`?section=states`), kunduzgi va tungi panel yonma-yon. Sabab (spec §3.3 balandlik qoidasi): to'liq katalog
 * (13 bo'lim) 12 000 px chegarasiga sig'maydi — telefonda shu bitta bo'limning o'zi ~11 000 px — va kesilgan
 * surat pastki bo'limlarni yashirgan bo'lardi. Qolgan primitivlar (tugma, forma, jadval, dialog …) sahifa
 * sahnalarida ko'rinadi. Maket yo'q (ichki sahifa) — asos `tizim-*` taxtalari (`StatesSection.tsx` izohi).
 */
defineScene({
  id: "ui-kit",
  route: "/ops/ui-kit?section=states",
  role: "superadmin",
  maket: ["tizim-main", "tizim-errors", "tizim-loading", "tizim-charts"],
  api: {},
  maxHeight: 12_000,
  allowBusy: "bo'lim yuklanish holatlarini ataylab ko'rsatadi (SkeletonTable / SkeletonLines / SkeletonChart namunalari)",
});
