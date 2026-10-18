import { defineScene, expect, fixture } from "../support/test";

/**
 * «Pochta» sahnalari: menejerning bugungi pochtalari (sonli tablar) va kuryerning pochta qabul ekrani.
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
