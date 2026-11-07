import { describe, expect, it } from "vitest";
import { parse } from "acorn";
import html from "../../index.html?raw";
import viteConfig from "../../vite.config.ts?raw";
const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]+)"/)?.[1] ?? "";

describe("index.html viewport", () => {
  it("opts into viewport-fit=cover so env(safe-area-inset-*) is not always 0px on iOS (I1s0yuns)", () => {
    expect(viewport).toContain("viewport-fit=cover");
  });

  it("does not disable zoom (maximum-scale / user-scalable=no break accessibility)", () => {
    expect(viewport).not.toMatch(/maximum-scale|user-scalable\s*=\s*no/);
  });
});

/**
 * js9ndYwA — ilova kodi ishga tushmasa (eski brauzer, JS o'chiq, bundle yuklanmadi) oq ekran emas, zaxira matn.
 * Taymer YO'Q: sekin internetda (EDGE — 23–43 s) «Brauzeringiz eskirgan» soxta chiqardi.
 */
describe("index.html zaxira bloklari", () => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const legacy = doc.getElementById("legacy-fallback");
  const boot = doc.getElementById("boot-fallback");
  const noscript = doc.querySelector("body > noscript");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const probe = scripts.find((text) => text.includes("elchiModernJs ="));
  const guard = scripts.find((text) => text.includes("elchi-boot-failed"));
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, " ").trim();

  it("#legacy-fallback va #boot-fallback — #root dan keyin, o'z matni bilan", () => {
    expect(doc.getElementById("root")?.nextElementSibling).toBe(legacy);
    expect(legacy?.nextElementSibling).toBe(boot);
    expect(text(legacy)).toBe("Brauzeringiz eskirgan. Iltimos, Safari yoki Chrome'ni yangilang.");
    expect(text(boot)).toBe("Ilovani yuklab bo'lmadi. Internetga ulanishni tekshiring va qayta urinib ko'ring. Qayta urinish");
    // Qayta yuklash JS'siz ham ishlaydi; `onclick=` — CSP'da 'unsafe-hashes' kerak bo'lardi.
    expect(boot?.querySelector("a.elchi-fallback__action")?.getAttribute("href")).toBe("");
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("<noscript> — JavaScript yoqilmagan bo'lsa matn; zaxira bloklar u bilan birga chiqmaydi", () => {
    expect(noscript).not.toBeNull();
    expect(noscript?.textContent).toContain("Ilova ishlashi uchun JavaScript yoqilgan bo'lishi kerak.");
    expect(noscript?.innerHTML).toMatch(/#legacy-fallback,\s*#boot-fallback\s*\{\s*display:\s*none;/);
  });

  it("taymer yo'q: bloklar sukut yashirin, faqat <html> klassi bilan ko'rinadi", () => {
    expect(html).not.toMatch(/elchi-legacy-fallback|animation:|@keyframes/);
    expect(html).toMatch(/#legacy-fallback,\s*#boot-fallback\s*\{\s*display:\s*none;/);
    expect(html).toMatch(/\.elchi-legacy #legacy-fallback,\s*\.elchi-boot-failed #boot-fallback\s*\{\s*display:\s*flex;/);
    expect(`${probe}${guard}`).not.toMatch(/setTimeout|setInterval|requestAnimationFrame/);
  });

  it("Vite dev server kompilyatsiya xatosi oynasi zaxira blok ustida (teng z-index, keyin qo'shiladi)", () => {
    const fallbackZ = html.match(/\.elchi-fallback\s*\{[^}]*z-index:\s*(\d+)/)?.[1];
    const overlayZ = html.match(/vite-error-overlay\s*\{[^}]*z-index:\s*(\d+)/)?.[1];
    expect(fallbackZ).toBeDefined();
    expect(overlayZ).toBe(fallbackZ);
  });

  it("sintaksis sinovi — ES2020 (`build.target` es2020): ES2019 tahlilchisi o'qiy olmaydi", () => {
    expect(/target:\s*\[\s*"es2020"/.test(viteConfig)).toBe(true);
    expect(() => parse(probe ?? "", { ecmaVersion: 2020 })).not.toThrow();
    expect(() => parse(probe ?? "", { ecmaVersion: 2019 })).toThrow();
  });

  it("kuzatuvchi — ES5 (IE11 / eski Safari ham o'qiydi), sinovdan keyin va ilova skriptidan oldin", () => {
    expect(() => parse(guard ?? "", { ecmaVersion: 5 })).not.toThrow();
    expect(guard).toContain('window.elchiModernJs !== true');
    expect(guard).toContain('root.className += " elchi-legacy"');
    expect(guard).toContain('target.type === "module"');
    expect(guard).toContain('window.addEventListener("online"');
    const at = (part: string) => html.indexOf(part);
    expect(at(probe!)).toBeLessThan(at(guard!));
    expect(at(guard!)).toBeLessThan(at('<script type="module"'));
    // Kuzatuvchi — oxirgi ichki skript: undan keyin ichki skript xatosi «yuklanmadi» deb o'qilmasin.
    expect(scripts.at(-1)).toBe(guard);
  });

  it("uslubi v2 qiymatlarida: fon #f4f6fb, matn #101733, navy #1f2853; binafsha yo'q", () => {
    const style = doc.head.querySelector("style")?.textContent ?? "";
    expect(style).toContain("background: #f4f6fb");
    expect(style).toContain("color: #101733");
    expect(style).toContain("background: #1f2853");
    expect(style).not.toMatch(/#(576adb|7c3aed|6366f1|7c5cff|8b5cf6)/i);
  });
});

/** rzzxMItN — `/login` da logotip JS'ni kutmaydi; boshqa yo'llarda shell ko'rinmaydi. */
describe("index.html /login birinchi kadri", () => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const shell = doc.querySelector("#root > #login-shell");

  it("#root ichida (createRoot o'zi tozalaydi), matnsiz, ekran o'quvchidan yashirin", () => {
    expect(shell).not.toBeNull();
    expect(shell?.getAttribute("aria-hidden")).toBe("true");
    expect(shell?.textContent?.trim()).toBe("");
    expect(shell?.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("sukut yashirin; ko'rinishi — faqat mavzu skripti `/login` da qo'ygan klass bilan", () => {
    expect(html).toMatch(/#login-shell\s*\{\s*display:\s*none;/);
    expect(html).toMatch(/\.login-first-paint #login-shell\s*\{\s*display:\s*flex;/);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
    const script = scripts.find((text) => text.includes("theme-version")) ?? "";
    expect(script).toContain("/^\\/login\\/?$/i.test(location.pathname)");
    expect(script).toContain('classList.add("login-first-paint")');
  });

  it("qidiruvdan «/» ga sessiyasiz kelgan — birinchi skript `/login` ga almashtiradi (`<meta charset>` dan oldin, ASCII)", () => {
    const first = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
    expect(first).toContain('location.pathname === "/"');
    expect(first).toContain('sessionStorage.getItem("accessToken")');
    expect(first).toContain('localStorage.getItem("elchi_had_session")');
    expect(first).toContain('sessionStorage.setItem("elchi_root_restore", "1")');
    expect(first).toContain('history.replaceState(history.state, "", "/login")');
    // Mavzu skripti, `firstPaintPreload` va `src/i18n.ts` manzilni undan KEYIN o'qiydi; charset 1024 bayt ichida qoladi.
    const charset = html.indexOf('<meta charset="UTF-8" />');
    expect(html.indexOf(first)).toBeLessThan(charset);
    expect(charset).toBeLessThan(1024);
    expect(/^[\x20-\x7E\s]*$/.test(first)).toBe(true);
  });
});
