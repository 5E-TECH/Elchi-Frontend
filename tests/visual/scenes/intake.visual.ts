import { defineScene, expect, fixture } from "../support/test";

/**
 * «Qabul va yaratish» sahnalari: market yangi buyurtmalari (menejer, HYBRID — tanlov paneli) va bekor
 * qilinganlarni marketga topshirish (superadmin — «Market QR kerak», USB skaner tayyor).
 * Ma'lumot sintetik (`tests/visual/fixtures/<sahna>/`), raqamlar maketdan; vaqtlar muzlatilgan soatdan oldin.
 *
 * Market id raqam: `/new-orders/:marketId` sahifasi `Number(marketId)` bilan so'raydi (spec'dagi `m7` — o'rinbosar).
 */

defineScene({
  id: "market-new-orders",
  route: "/new-orders/7",
  role: "manager",
  branchType: "HYBRID",
  maket: ["manager-new-orders-market-detail"],
  api: {
    "GET orders/markets/7/new": fixture("market-new-orders/orders.json"),
  },
  // Sukut — hech narsa tanlanmagan (QMvu5Ajx): «Barchasini tanlash», so'ng maketdagidek bittasi (№10320)
  // tanlovdan chiqariladi → «5 ta buyurtma tanlandi».
  act: async (page) => {
    const row = page.getByRole("checkbox", { name: "№10320 ni tanlash" });
    await expect(row).not.toBeChecked();
    await page.getByRole("button", { name: "Barchasini tanlash" }).first().click();
    await expect(row).toBeChecked();
    await row.uncheck();
    await expect(row).not.toBeChecked();
    await expect(page.getByRole("button", { name: /Qabul qilish — 5 ta/ }).first()).toBeVisible();
  },
});

defineScene({
  id: "cancelled-handover",
  route: "/new-orders/cancelled/31",
  role: "superadmin",
  maket: ["superadmin-neworders-cancelled-handover"],
  api: {
    "GET orders/markets/31/cancelled": fixture("cancelled-handover/orders.json"),
    "GET orders/markets/cancelled": fixture("cancelled-handover/markets.json"),
  },
  // Market QR hali skanerlanmagan: jo'natish yopiq, USB skaner kutmoqda.
  act: async (page) => {
    await expect(page.getByText("Market QR kerak")).toBeVisible();
    await expect(page.getByRole("button", { name: /Marketga jo'natish/ }).first()).toBeDisabled();
  },
});
