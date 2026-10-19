import type { Page } from "@playwright/test";
import type { ApiRequest } from "../support/mockApi";
import { profileFor, type Theme } from "../support/session";
import { FIXED_NOW } from "../support/stabilize";
import { defineScene, expect, fixture, test } from "../support/test";

/**
 * «Bosh sahifa» sahnalari: superadmin (`/`), market (`/` + qo'shimcha xarajat tasdiqlari), menejer
 * (`/branch-dashboard`). Ma'lumot sintetik (`tests/visual/fixtures/dashboard/`, `regions/`), raqamlar maketdan.
 *
 * Davr: superadmin va market sahnasi «Bu oy» ni tanlaydi (01.10–15.10, oldingi teng davr 16.09–30.09) — «Bugun»
 * da «Moliyaviy tahlil» grafigi bitta nuqta bo'lib qolardi (backend kunlik nuqta beradi), market maketi esa
 * o'zi «Bu oy» da. Menejer sahnasi — sukut «Bugun» (maket `manager-branch-dashboard-main`).
 */

type Pair<T> = { current: T; previous: T };
/** Muzlatilgan soatning Toshkent kuni (`2026-10-15`). */
const TODAY = FIXED_NOW.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
/** Oldingi davr so'rovi (`end_day` bugundan oldin) — `previous`, qolgani (bo'sh parametr = bugun, «Bu oy») — `current`. */
const byPeriod =
  <T extends Record<string, unknown>>(pair: Pair<T>) =>
  ({ query }: ApiRequest) => {
    const end = query.get("end_day");
    return end && end < TODAY ? pair.previous : pair.current;
  };

/** Davrni «Bu oy» ga o'tkazadi (`SegmentedControl` — `radio`). */
const pickThisMonth = async (page: Page) => {
  const month = page.getByRole("radio", { name: "Bu oy" });
  await month.click();
  await expect(month).toHaveAttribute("aria-checked", "true");
};

const superadmin = fixture<{
  dashboard: Pair<Record<string, unknown>>;
  kpi: Pair<Record<string, unknown>>;
  revenue: Pair<Record<string, unknown>>;
}>("dashboard/superadmin.json");
const regionStats = fixture("regions/stats-all.json");

defineScene({
  id: "dashboard",
  route: "/",
  role: "superadmin",
  maket: ["superadmin-dashboard-main", "tizim-charts"],
  api: {
    "GET analytics/dashboard": byPeriod(superadmin.dashboard),
    "GET analytics/kpi": byPeriod(superadmin.kpi),
    "GET analytics/revenue": byPeriod(superadmin.revenue),
    "GET region/stats/all": regionStats,
  },
  act: pickThisMonth,
});

const market = fixture<{ dashboard: Pair<Record<string, unknown>>; approvals: Record<string, unknown> }>(
  "dashboard/market.json",
);

/** Market profili + `add_order` (sarlavhadagi «Buyurtma yaratish» va tezkor amal) — mavzu loyihadan. */
const marketProfile = () => {
  // Marshrut ishlovchisi test davomida chaqiriladi (`test.info()` ishlaydi); test tugagach kelgan kech so'rov uchun zaxira.
  let theme: Theme = "light";
  try {
    theme = (test.info().project.use as { theme?: Theme }).theme ?? "light";
  } catch {
    /* test tugagan — javob suratga ta'sir qilmaydi */
  }
  const base = profileFor("market", theme);
  return { ...base, data: { ...base.data, add_order: true } };
};

defineScene({
  id: "market-home",
  route: "/",
  role: "market",
  maket: ["market-dashboard-home", "market-dashboard-extra-cost-approvals"],
  api: {
    "GET auth/my-profile": marketProfile,
    "GET analytics/dashboard": byPeriod(market.dashboard),
    // 2 ta kutilayotgan so'rov: sotishdagi va bekor qilishdagi qo'shimcha xarajat.
    "GET orders/extra-cost-approvals": market.approvals,
  },
  act: pickThisMonth,
});

defineScene({
  id: "branch-dashboard",
  route: "/branch-dashboard",
  role: "manager",
  branchType: "HYBRID",
  maket: ["manager-branch-dashboard-main"],
  api: {
    // Filial `11` (sessiya profili) — o'z filiali «Top filiallar» da 6-qator (top 5 dan tashqarida).
    "GET analytics/dashboard": fixture("dashboard/branch.json"),
  },
});
