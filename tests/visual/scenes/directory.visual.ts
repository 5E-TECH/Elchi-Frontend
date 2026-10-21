import { defineScene, fixture } from "../support/test";

/**
 * «Ma'lumotnoma» sahnalari: foydalanuvchilar ro'yxati (superadmin) va hududlar xaritasi + jadval (admin).
 * Ma'lumot sintetik (`tests/visual/fixtures/users/`, `regions/`); hududlar raqamlari maketdan (312 ta buyurtma,
 * 14 viloyat) — bosh sahifa sahnasi ham shu faylni ishlatadi.
 */

defineScene({
  id: "users",
  route: "/all-users",
  role: "superadmin",
  maket: ["superadmin-users-list", "superadmin-users-list-roles"],
  api: {
    // Ro'yxat (`page=1&limit=10`) va KPI (`page=1&limit=1`, `meta.totalUsers/totalMarket/totalEmployees`) — 10 ta,
    // rollar aralash (market, kuryer, menejer, ro'yxatchi, admin; FY-1 — logist, market operatori, investor),
    // ikkitasi nofaol. Telefonda tablar o'rnida «Rol: Hammasi» tanlovi (`superadmin-users-list-role-select`).
    "GET users": fixture("users/users.json"),
  },
});

defineScene({
  id: "regions",
  route: "/regions",
  role: "admin",
  maket: ["admin-regions-map"],
  api: {
    "GET region/stats/all": fixture("regions/stats-all.json"),
  },
});
