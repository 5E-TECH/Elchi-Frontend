import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import designViews from "../../../../design/kit/views.json";
import routeMap from "../../../../design/kit/route-map.json";

/**
 * CS-C: kod market narxini hamma joyda «Uyga / Markazga standart narx» deb ko'rsatadi (maket
 * `superadmin-users-detail` / `-edit-dialog`, ega S1). Shu route'dagi boshqa ba'zi maketlar marketni hali
 * «Uyga / Markazga tarif» deb chizadi (bir kunlik sinxron f86a2e73 ichida ham) — bunday maket SCREENS.md da
 * jim «v2» bo'lib qolmasin: `partialViews` da farqi yozilgan bo'lishi shart.
 *
 * Market belgisi — maketda «Asosiy tarif» (faqat market kartasi / bo'limida). Hisobga olinadi: route'ning
 * sahifa maketlari (UserDetailView) va UpdateUserModal oynalari; boshqa oynalar (Telegram guruhi, kuryer
 * o'tkazish) o'z faylida chiziladi — fondagi sahifa ular uchun maket emas.
 */
type View = { role: string; viewId: string; fragment: string; kind: string };
type Route = { path: string; views?: Record<string, string[]> };

const VIEWS = (designViews as unknown as { views: View[] }).views;
const MAP = routeMap as unknown as {
  routes: Route[];
  partialViews: Record<string, string>;
  viewFiles: Record<string, string>;
};
const UPDATE_MODAL = "src/features/user/update-user/ui/UpdateUserModal.tsx";
const fragmentHtml = (fragment: string) =>
  readFileSync(resolve(__dirname, "../../../../design/fragments", `${fragment}.html`), "utf8");

const route = MAP.routes.find((r) => r.path === "/all-users/:id");
const userDetailViews = Object.entries(route?.views ?? {}).flatMap(([role, ids]) =>
  ids.map((viewId) => {
    const view = VIEWS.find((v) => v.role === role && v.viewId === viewId);
    if (!view) throw new Error(`views.json da yo'q: ${role}-${viewId}`);
    return { key: `${role}-${viewId}`, ...view };
  }),
);
const drawnByUserDetail = userDetailViews.filter(
  (v) => v.kind === "page" || MAP.viewFiles[v.key] === UPDATE_MODAL,
);
const oldMarketLabel = drawnByUserDetail.filter((v) => {
  const html = fragmentHtml(v.fragment);
  return html.includes("Asosiy tarif") && /(Uyga|Markazga) tarif/.test(html);
});

describe("CS-C — market narx yorlig'i: maketlar ziddiyati route-map da yozilgan", () => {
  it("route va maketlar topildi (test bo'sh o'tmaydi)", () => {
    expect(drawnByUserDetail.length).toBeGreaterThanOrEqual(10);
    expect(oldMarketLabel.map((v) => v.key).sort()).toEqual(
      expect.arrayContaining([
        "admin-users-detail-telegram",
        "manager-users-edit-dialog",
        "superadmin-users-detail-telegram",
        "superadmin-users-edit-market-ai",
        "superadmin-users-edit-market-ai-phone",
      ]),
    );
  });

  it.each(oldMarketLabel.map((v) => [v.key]))(
    "%s: marketni «Uyga / Markazga tarif» deb chizadi — partialViews da CS-C farqi bor",
    (key) => {
      const note = MAP.partialViews[key];
      expect(note, `${key} partialViews da yo'q — SCREENS.md da jim «v2»`).toBeTruthy();
      expect(note).toContain("CS-C");
      expect(note).toContain("standart narx");
    },
  );

  it("market tarif kartasi yo'q maket (menejer — Ro'yxatchi profili) qisman deb belgilanmaydi", () => {
    expect(oldMarketLabel.map((v) => v.key)).not.toContain("manager-users-detail");
    expect(MAP.partialViews["manager-users-detail"]).toBeUndefined();
  });
});
