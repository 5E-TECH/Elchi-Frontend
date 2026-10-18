import { defineScene, expect } from "../support/test";

/**
 * «Kirish» sahnasi (bosqich B): `/login` — mehmon, sessiyasiz, shell'siz mustaqil sahifa (kompyuterda chapda navy
 * panel, telefonda tepada navy tasma), forma bo'sh. API so'rovi yo'q: token bo'lmasa ilova profil so'ramaydi.
 */

defineScene({
  id: "login",
  route: "/login",
  role: null,
  maket: ["common-login"],
  api: {},
  act: async (page) => {
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 1, name: "Tizimga kirish" })).toBeVisible();
    // Bo'sh forma: telefon maydonida faqat «+998» prefiksi, parol bo'sh. «Sessiya tugadi» ekrani emas, xato yo'q
    // (`main` ichida: `UiHost` dagi `Toaster` ning doimiy bo'sh `role="alert"` jonli hududi `main` dan tashqarida).
    await expect(main.getByRole("textbox", { name: "Telefon raqam" })).toHaveValue("");
    await expect(main.locator('input[name="password"]')).toHaveValue("");
    await expect(main.getByRole("alert")).toHaveCount(0);
  },
});
