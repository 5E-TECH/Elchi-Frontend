import { expect, test } from "@playwright/test";
import { mockOrderDetailApi, openOrderDetail, ORDER_96 } from "./support/orderDetail";

/**
 * MARKETGA QAYTARISH — detal sahifa, 1440px. Soxta backend (backend kodidagi
 * xatti-harakat bilan bir xil: initiate-return holatni o'zgartirmaydi, `note`
 * hodisa yozadi; mark-returned-to-market → returned_to_market).
 */
const SUPERADMIN = { id: "1", role: "superadmin", name: "Bosh admin", status: "active" };
const MANAGER = {
  id: "501",
  role: "manager",
  name: "Filial menejeri",
  status: "active",
  branch_id: "12",
  branch: { id: "12", name: "Urganch filiali", type: "REGIONAL" },
};

const createdEvent = {
  id: "ev-1",
  order_id: "96",
  action: "waiting",
  from_status: "on the road",
  to_status: "waiting",
  old_value: { status: "on the road" },
  new_value: { status: "waiting" },
  changed_by: "93",
  changed_by_role: "courier",
  actor: { name: "Xorazm Courier", role: "courier" },
  created_at: "2026-10-09T05:00:00.000Z",
};

const afterIndex = (requests: string[], marker: string) => requests.slice(requests.lastIndexOf(marker) + 1);

test.describe("Marketga qaytarish — 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 90_000 });

  test("⭐ superadmin: \"Marketga qaytarish\" → sabab → initiate-return; GET qayta o'qiladi; badge; tarixda hodisa", async ({ page }) => {
    const order: Record<string, unknown> = { ...ORDER_96, status: "waiting", return_requested: false, return_reason: null };
    const events: Record<string, unknown>[] = [createdEvent];
    const { leaked, writes, requests } = await mockOrderDetailApi(page, order, {
      profile: SUPERADMIN,
      tracking: () => events,
      onWrite: (method, path) => {
        if (method !== "POST" || path !== "orders/96/initiate-return") return undefined;
        // Backend: return_requested/return_reason yoziladi, holat o'zgarmaydi, `note` hodisa.
        order.return_requested = true;
        order.return_reason = "Mijoz rad etdi";
        events.push({
          ...createdEvent,
          id: "ev-2",
          action: "note",
          from_status: "waiting",
          old_value: { status: "waiting" },
          new_value: { status: "waiting" },
          changed_by: "1",
          changed_by_role: "superadmin",
          actor: { name: "Bosh admin", role: "superadmin" },
          note: "Return initiated: Mijoz rad etdi",
          description: "Return initiated: Mijoz rad etdi",
          created_at: "2026-10-09T08:00:00.000Z",
        });
        return { statusCode: 200, message: "Order return initiated", data: { ...order } };
      },
    });
    await openOrderDetail(page);
    await expect(page.getByTestId("return-requested-badge")).toHaveCount(0);
    await expect(page.getByTestId("tracking-event")).toHaveCount(1);

    await page.getByTestId("initiate-return-button").click();
    // Sababsiz yuborilmaydi.
    await page.getByTestId("initiate-return-submit").click();
    await expect(page.getByTestId("initiate-return-modal")).toContainText("Qaytarish sababini yozing");
    expect(writes).toEqual([]);

    await page.getByTestId("return-reason-input").fill("Mijoz rad etdi");
    const request = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/orders/96/initiate-return"));
    await page.getByTestId("initiate-return-submit").click();
    expect((await request).postDataJSON()).toEqual({ reason: "Mijoz rad etdi" });

    // Sarlavha: amber badge (sabab tooltipda), qaytarish tugmasi yo'qoldi.
    await expect(page.getByTestId("initiate-return-modal")).toHaveCount(0);
    const badge = page.getByTestId("return-requested-badge");
    await expect(badge).toHaveText("Qaytarish so'ralgan");
    await expect(badge).toHaveAttribute("aria-label", "Qaytarish so'ralgan. Sabab: Mijoz rad etdi");
    await badge.hover();
    await expect(page.locator(".ant-tooltip")).toContainText("Sabab: Mijoz rad etdi");
    await expect(page.getByTestId("initiate-return-button")).toHaveCount(0);

    // POST dan keyin buyurtma (GET orders/96) va tarix QAYTA so'raldi.
    const after = afterIndex(requests, "POST orders/96/initiate-return");
    expect(after).toContain("GET orders/96");
    expect(after).toContain("GET orders/96/tracking");

    // Tarixda qaytarish hodisasi — sahifani yangilamasdan.
    await expect(page.getByTestId("tracking-event")).toHaveCount(2);
    const returnEvent = page.getByTestId("tracking-event").filter({ hasText: "Qaytarish so'raldi" });
    await expect(returnEvent).toContainText("Bosh admin buyurtmani marketga qaytarishni boshladi. Sabab: Mijoz rad etdi");
    expect(writes).toEqual(["POST orders/96/initiate-return"]);
    expect(leaked).toEqual([]);
  });

  test("⭐ filial menejeri: \"Marketga topshirildi\" → market QR → MHA → status returned_to_market; tarixda hodisa", async ({ page }) => {
    const order: Record<string, unknown> = {
      ...ORDER_96,
      status: "waiting",
      return_requested: true,
      return_reason: "Mijoz rad etdi",
      holder_type: "BRANCH",
      holder_branch_id: "12",
      holder_courier_id: null,
      courier_id: null,
    };
    const events: Record<string, unknown>[] = [createdEvent];
    const { leaked, writes, requests } = await mockOrderDetailApi(page, order, {
      profile: MANAGER,
      tracking: () => events,
      onWrite: (method, path) => {
        if (method === "POST" && path === "scan/market-cancelled") {
          return { type: "market_cancelled_handover", data: { authorized: true, authorization_token: "MHA-e2e_Tok" } };
        }
        if (method === "POST" && path === "orders/96/mark-returned-to-market") {
          Object.assign(order, { status: "returned_to_market", return_requested: false, holder_type: "MARKET", holder_branch_id: null });
          events.push({
            ...createdEvent,
            id: "ev-3",
            action: "returned_to_market",
            from_status: "waiting",
            to_status: "returned_to_market",
            old_value: { status: "waiting" },
            new_value: { status: "returned_to_market" },
            changed_by: "501",
            changed_by_role: "manager",
            actor: { name: "Filial menejeri", role: "manager" },
            note: "Xodim 501 market egasiga topshirdi",
            created_at: "2026-10-09T09:00:00.000Z",
          });
          return { statusCode: 200, message: "ok", data: { ...order } };
        }
        return undefined;
      },
    });
    await openOrderDetail(page);
    await expect(page.getByTestId("return-requested-badge")).toBeVisible();
    // Boshlash — HQ amali, menejerda yo'q.
    await expect(page.getByTestId("initiate-return-button")).toHaveCount(0);

    await page.getByTestId("mark-returned-button").click();
    await expect(page.getByTestId("mark-returned-submit")).toBeDisabled();
    await page.getByTestId("mark-returned-qr-input").fill("MCR-AbC_xYz");
    const scan = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/scan/market-cancelled"));
    const mark = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/orders/96/mark-returned-to-market"));
    await page.getByTestId("mark-returned-submit").click();
    expect((await scan).postDataJSON()).toEqual({ qr_token: "MCR-AbC_xYz" });
    expect((await mark).postDataJSON()).toEqual({ authorization_token: "MHA-e2e_Tok" });

    // Status returned_to_market — sarlavhada tarjima bilan; badge va tugma yo'qoldi.
    await expect(page.getByTestId("mark-returned-modal")).toHaveCount(0);
    await expect(page.getByText("Marketga qaytarilgan", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("return-requested-badge")).toHaveCount(0);
    await expect(page.getByTestId("mark-returned-button")).toHaveCount(0);

    const after = afterIndex(requests, "POST orders/96/mark-returned-to-market");
    expect(after).toContain("GET orders/96");
    expect(after).toContain("GET orders/96/tracking");
    const handoverEvent = page.getByTestId("tracking-event").filter({ hasText: "Marketga qaytarildi" });
    await expect(handoverEvent).toContainText("Filial menejeri buyurtmani Kimdur Kimdurga QR tasdiq bilan topshirdi");
    expect(writes).toEqual(["POST scan/market-cancelled", "POST orders/96/mark-returned-to-market"]);
    expect(leaked).toEqual([]);
  });

  for (const role of ["market", "courier"]) {
    test(`${role} — qaytarish tugmalari UMUMAN yo'q (UI backend 403 dan oldin bloklaydi)`, async ({ page }) => {
      const profile = { id: role === "market" ? "m7" : "93", role, name: `E2E ${role}`, status: "active" };
      // Ikkala tugma uchun ham "eng qulay" holatlar: waiting va return_requested.
      for (const returnRequested of [false, true]) {
        const { leaked } = await mockOrderDetailApi(
          page,
          { ...ORDER_96, status: "waiting", return_requested: returnRequested, return_reason: returnRequested ? "Sabab" : null },
          { profile },
        );
        await openOrderDetail(page);
        await expect(page.getByTestId("initiate-return-button")).toHaveCount(0);
        await expect(page.getByTestId("mark-returned-button")).toHaveCount(0);
        expect(leaked).toEqual([]);
        await page.context().unrouteAll({ behavior: "ignoreErrors" });
      }
    });
  }
});
