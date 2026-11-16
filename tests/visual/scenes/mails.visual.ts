import { defineScene, expect, fixture } from "../support/test";

/**
 * «Pochta» sahnalari: menejerning bugungi pochtalari (sonli tablar), kuryerning pochta qabul ekrani va superadmin
 * «Manzilni tanlang» oynasi (filial / HQ kuryeri, ega qarori 2026-11-15).
 * Ma'lumot sintetik (`tests/visual/fixtures/<sahna>/`), vaqtlar muzlatilgan soatdan oldin.
 */

defineScene({
  id: "mails-today",
  route: "/mails/today",
  role: "manager",
  branchType: "HYBRID",
  maket: ["manager-mails-today"],
  api: {
    // Menejer: `post?status=sent&branch_id=11` — filialga jo'natilgan 3 ta pochta.
    "GET post": fixture("mails-today/posts-sent.json"),
    // Zaxira (`orders?status=on the road`) — API pochta bergani uchun ishlatilmaydi, lekin so'raladi.
    "GET orders": { statusCode: 200, data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 }, total: 0 },
    // Tab sonlari: «Rad etilgan 1», «Qaytarish 4».
    "GET post/rejected": fixture("mails-today/posts-rejected.json"),
    "GET post/return-requests/list": fixture("mails-today/return-requests.json"),
  },
});

defineScene({
  id: "mail-detail",
  route: "/mails/78",
  role: "courier",
  branchType: "REGIONAL",
  maket: ["courier-mails-detail-receive"],
  api: {
    // Kuryer qabul rejimi: pochta `sent`, 4 ta «Yo'lda» buyurtma; pastda yopishgan qabul paneli.
    "GET post/orders/78": fixture("mail-detail/post-78.json"),
  },
  // Maketdagidek qisman tanlov (skanerlanganlar): 2 / 4 → «Pochtani qabul qilish — 2 ta» faol.
  act: async (page) => {
    for (const id of ["10252", "10247"]) {
      const row = page.getByRole("checkbox", { name: `№${id} ni tanlash` });
      await row.check();
      await expect(row).toBeChecked();
    }
    await expect(page.getByRole("button", { name: /Pochtani qabul qilish — 2 ta/ }).first()).toBeEnabled();
  },
});

defineScene({
  id: "mail-send-dialog",
  route: "/mails/74",
  role: "superadmin",
  // Ega qarori 2026-11-15: «Manzilni tanlang» — filial HAM, HQ kuryeri HAM. Maket yo'q — eng yaqinlari.
  maket: ["superadmin-mails-detail-send-dialog", "registrator-dispatch-courier-select-dialog"],
  api: {
    // Jo'natilmagan (`new`) HQ pochtasi, 4 ta «Qabul qilingan» buyurtma, viloyat — Samarqand (6).
    "GET post/orders/74": fixture("mail-send-dialog/post-74.json"),
    // «Pochtani jo'natish» bosilganda (sahifa ochilganda emas) — ikkala ro'yxat parallel.
    "GET branches/dispatch-destinations": fixture("mail-send-dialog/dispatch-destinations.json"),
    "GET branches/posts/:id/courier-destinations": fixture("mail-send-dialog/courier-destinations.json"),
  },
  // Oyna (telefonda pastki varaqa) — faqat ko'rinadigan oyna suratga olinadi.
  capture: "viewport",
  act: async (page) => {
    await page.getByRole("button", { name: "Barchasini tanlash" }).click();
    await page.getByRole("button", { name: /Pochtani jo'natish — 4 ta/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Manzilni tanlang" });
    await expect(dialog).toBeVisible();
    // Kuryer tabi: tashqi yetkazuvchi belgisi bilan kuryer tanlangan, to'xtatilgan akkaunt — o'chiq karta.
    await dialog.getByRole("radio", { name: /HQ kuryeriga · 3/ }).click();
    await dialog.getByRole("radio", { name: /FastPost kuryeri/ }).check();
    await expect(dialog.getByRole("button", { name: "Kuryerga berish — 4 ta" })).toBeEnabled();
  },
});
