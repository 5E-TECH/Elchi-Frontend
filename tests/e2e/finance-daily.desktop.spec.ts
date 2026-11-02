import { expect, test } from "@playwright/test";
import {
  BALANCE_DAILY_PATH,
  HISTORY_DAILY_PATH,
  balanceDaily,
  failDaily,
  historyDaily,
  isoDay,
  openAsManager,
  openFinancePage,
} from "./support/financeDaily";

/**
 * qzjTMWPb (1440): «Pul oqimi», «Kassa holati», «Kassa oqimi», «Balans dinamikasi», «Daftar qoldig'i», «Kunlik kirim va
 * chiqim», «kechaga nisbatan», sparkline va kassa tafsilotidagi «Davr boshida» — `history/daily` +
 * `financial-balance/daily`. 403 / xatoda sahifa ishlaydi, yolg'on 0 yo'q.
 */
test("superadmin /payments: «Pul oqimi» server jamidan, «Kassa holati» all-info'dan", async ({ page }) => {
  const { leaked } = await openFinancePage(page);

  const flow = page.getByRole("region", { name: "Pul oqimi" });
  const data = historyDaily();
  await expect(flow).toContainText("Asosiy kassa");
  await expect(flow).toContainText("Jami kirim");
  await expect(flow).toContainText(String(data.totals.income).replace(/\B(?=(\d{3})+$)/g, " "));
  await expect(flow.getByRole("img", { name: /Asosiy kassa pul oqimi/ })).toBeVisible();

  await flow.getByRole("radio", { name: "Jadval" }).click();
  await expect(flow.getByRole("table", { name: "Pul oqimi" })).toBeVisible();

  const state = page.getByRole("region", { name: "Kassa holati" });
  await expect(state).toContainText("21 027 000");
  await expect(state).toContainText("Ijobiy");
  expect(leaked).toEqual([]);
});

test("superadmin /payments: filtrlar grafik so'roviga ham ketadi", async ({ page }) => {
  const { requests } = await openFinancePage(page);
  const daily = () => requests.filter((url) => url.includes(HISTORY_DAILY_PATH));

  await expect(page.getByRole("region", { name: "Pul oqimi" })).toBeVisible();
  await expect.poll(() => daily().length).toBeGreaterThan(0);
  expect(new URL(daily()[0]).searchParams.get("from_date")).toBe(isoDay(-13));
  expect(new URL(daily()[0]).searchParams.get("to_date")).toBe(isoDay(0));

  await page.getByRole("tab", { name: "Kirim" }).click();
  await expect
    .poll(() => daily().some((url) => new URL(url).searchParams.get("operation_type") === "income"))
    .toBe(true);
});

for (const status of [403, 500]) {
  test(`superadmin /payments: ${status} — sahifa ishlaydi, yolg'on 0 yo'q`, async ({ page }) => {
    await failDaily(page, HISTORY_DAILY_PATH, status);
    await openFinancePage(page);

    await expect(page.getByRole("heading", { level: 1, name: "To'lovlar" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Kassa holati" })).toContainText("21 027 000");
    const flow = page.getByRole("region", { name: "Pul oqimi" });
    if (status === 403) await expect(flow).toHaveCount(0);
    else await expect(flow.getByRole("button", { name: "Qayta urinish" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Jami kirim")).toHaveCount(0);
  });
}

test("menejer /payments: «Kassa oqimi» va «kechaga nisbatan»", async ({ page }) => {
  await openAsManager(page, "/payments");

  await expect(page.getByRole("region", { name: "Kassa oqimi" })).toContainText("Kirim · 14 kun");
  await expect(page.getByRole("link", { name: /Kassadagi summa/ })).toContainText("kechaga nisbatan · asosiy kassa");
  await expect(page.getByRole("img", { name: /Kassadagi summa, oxirgi/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Pul oqimi" })).toHaveCount(0);
});

test("menejer /payments/main-cashbox: «Balans dinamikasi» 14 kun, delta kechaga nisbatan", async ({ page }) => {
  await openAsManager(page, "/payments/main-cashbox");

  const trend = page.getByRole("region", { name: "Balans dinamikasi" });
  await expect(trend).toContainText("oxirgi 14 kun");
  await expect(trend.getByRole("img", { name: /Kassa balansi, kun oxirida/ })).toBeVisible();
  await expect(page.getByText("kechaga nisbatan", { exact: true }).first()).toBeVisible();
});

test("/financial-balance: KPI delta va 14 kunlik chiziq; backfill kuni — delta yo'q", async ({ page }) => {
  const base = balanceDaily();
  const days = base.days.map((day) =>
    day.date === isoDay(-1) && day.snapshot
      ? { ...day, snapshot: { ...day.snapshot, source: "backfill", in_transit: null, current_situation: null } }
      : day,
  );
  await openFinancePage(page, { route: "/financial-balance", balance: { ...base, days } });

  const kpis = page.getByRole("region", { name: "Balans ko'rsatkichlari" });
  await expect(kpis).toBeVisible();
  // Kassa va marketlar qarzi — delta bor; yo'ldagi pul va umumiy balans (kecha backfill) — yo'q.
  await expect(kpis.getByText("kechaga nisbatan")).toHaveCount(2);
  await expect(page.getByRole("img", { name: /^Kassa, oxirgi 14 kun/ })).toBeVisible();
});

test("/financial-balance: 403 — KPI joyida, delta va chiziq yo'q", async ({ page }) => {
  await failDaily(page, BALANCE_DAILY_PATH, 403);
  await openFinancePage(page, { route: "/financial-balance" });

  const kpis = page.getByRole("region", { name: "Balans ko'rsatkichlari" });
  await expect(kpis).toContainText("24,6");
  await expect(kpis.getByText("kechaga nisbatan")).toHaveCount(0);
  await expect(page.locator("[data-sparkline]")).toHaveCount(0);
});

test("/financial-balance Tarix va Tahlil: «Daftar qoldig'i» va «Kunlik kirim va chiqim»", async ({ page }) => {
  await openFinancePage(page, { route: "/financial-balance?tab=history" });

  const ledger = page.getByRole("region", { name: "Daftar qoldig'i" });
  await expect(ledger).toContainText("Davr boshida");
  await expect(ledger).toContainText("7 507 000 so'm");
  await expect(ledger).toContainText("Eng yuqori");
  await expect(ledger.getByRole("img", { name: /^Daftar qoldig'i, / })).toBeVisible();

  await page.getByRole("tab", { name: "Tahlil" }).click();
  const daily = page.getByRole("region", { name: "Kunlik kirim va chiqim" });
  await expect(daily).toBeVisible();
  await expect(daily.getByRole("radio", { name: "Jadval" })).toBeVisible();
});

test("kassa tafsiloti: «Davr boshida» serverdan, yuklangan qatordan emas", async ({ page }) => {
  const history = [
    {
      id: "2",
      cashbox_id: "70",
      amount: 200_000,
      operation_type: "income",
      source_type: "sell",
      balance_after: 900_000,
      createdAt: `${isoDay(0)}T04:00:00.000Z`,
    },
    {
      id: "1",
      cashbox_id: "70",
      amount: 100_000,
      operation_type: "income",
      source_type: "sell",
      balance_after: 700_000,
      createdAt: `${isoDay(0)}T03:00:00.000Z`,
    },
  ];
  const { requests } = await openFinancePage(page, {
    route: "/payments/cash-detail/263?type=courier",
    history: historyDaily(1, { opening_balance: 123_000, closing_balance: 900_000 }),
    extra: {
      "finance/cashbox/user/263": {
        cashbox: { id: "70", cashbox_type: "couriers", user_id: "263", balance: 900_000 },
        history,
        cashboxHistory: history,
        user: { id: "263", name: "Bekzod Normurodov", phone_number: "+998901234567", role: "courier", status: "active" },
      },
    },
  });

  const movement = page.getByRole("region", { name: "Balans harakati" });
  await expect(movement).toContainText("123 000 so'm");
  const daily = requests.filter((url) => url.includes(HISTORY_DAILY_PATH)).map((url) => new URL(url).searchParams);
  expect(daily[0].get("cashbox_type")).toBe("couriers");
  expect(daily[0].get("user_id")).toBe("263");
});

test("menejer, kuryer tafsiloti: «kechaga nisbatan» va 7 kunlik chiziq (doira — shu kuryer)", async ({ page }) => {
  const { requests } = await openAsManager(page, "/payments/cash-detail/263?type=courier", {
    history: historyDaily(7),
    extra: {
      "finance/cashbox/user/263": {
        cashbox: { id: "70", cashbox_type: "couriers", user_id: "263", balance: 900_000 },
        history: [],
        cashboxHistory: [],
        user: { id: "263", name: "Bekzod Normurodov", phone_number: "+998901234567", role: "courier", status: "active" },
      },
    },
  });

  await expect(page.getByText("kechaga nisbatan · topshirilmagan pul")).toBeVisible();
  await expect(page.getByText("Kun oxiridagi qoldiq · 7 kun")).toBeVisible();
  const daily = requests.filter((url) => url.includes(HISTORY_DAILY_PATH)).map((url) => new URL(url).searchParams);
  expect(daily[0].get("user_id")).toBe("263");
  expect(daily[0].get("from_date")).toBe(isoDay(-6));
});
