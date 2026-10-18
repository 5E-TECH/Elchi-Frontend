import type { ApiRequest } from "../support/mockApi";
import { defineScene, expect, fixture } from "../support/test";

/**
 * «Tizim» sahnalari (bosqich B): integratsiyalar konsoli — «Hamkorlar» (superadmin) va sozlamalar — «Ko'rinish»
 * (HQ registratori). Ma'lumot sintetik (`tests/visual/fixtures/integrations/`), raqamlar maketdan: 24 soatda
 * 2 615 ta hodisa, 6 ta yetmadi, 48 ta navbatda; hamkorlar 5 · tashqi tizimlar 6 · marketplace 2. Vaqtlar
 * muzlatilgan soatdan oldin (maketdagi «Bugun, 14:31» → «Bugun, 09:31»).
 */

const metrics24 = fixture("integrations/metrics-24h.json");
const metrics48 = fixture("integrations/metrics-48h.json");

defineScene({
  id: "integrations",
  route: "/integrations/connections",
  role: "superadmin",
  maket: ["superadmin-integrations-partners-console"],
  api: {
    "GET admin/partners": fixture("integrations/partners.json"),
    "GET integrations": fixture("integrations/integrations.json"),
    // «kechaga nisbatan» (D1) — 48 soatlik oyna: kecha = 48 soat − 24 soat.
    "GET integrations/metrics": ({ query }: ApiRequest) => (query.get("hours") === "48" ? metrics48 : metrics24),
  },
  // Birinchi hamkor (BeePost — webhook manzili yo'q) tanlanadi, «Umumiy holat» paneli ochiq.
  act: async (page) => {
    await expect(page.getByRole("tab", { name: /Hamkorlar/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("BeePost").first()).toBeVisible();
  },
});

defineScene({
  id: "settings",
  route: "/settings",
  role: "registrator",
  branchType: "HQ",
  maket: ["common-settings-appearance"],
  // Sozlamalar profildan (`auth/my-profile` → `settings.appearance`) — sessiya bilan bir xil.
  api: {},
  act: async (page) => {
    await expect(page.getByText("Saqlandi")).toBeVisible();
  },
});
