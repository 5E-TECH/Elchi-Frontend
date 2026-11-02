import { describe, expect, it } from "vitest";
import html from "../../index.html?raw";
const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]+)"/)?.[1] ?? "";

describe("index.html viewport", () => {
  it("opts into viewport-fit=cover so env(safe-area-inset-*) is not always 0px on iOS (I1s0yuns)", () => {
    expect(viewport).toContain("viewport-fit=cover");
  });

  it("does not disable zoom (maximum-scale / user-scalable=no break accessibility)", () => {
    expect(viewport).not.toMatch(/maximum-scale|user-scalable\s*=\s*no/);
  });
});

/** js9ndYwA — ilova kodi ishga tushmasa (eski brauzer, JS o'chiq) oq ekran emas, zaxira matn. */
describe("index.html zaxira bloki", () => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const fallback = doc.getElementById("legacy-fallback");
  const noscript = doc.querySelector("body > noscript");

  it("#legacy-fallback — #root dan keyin, «Brauzeringiz eskirgan» matni bilan", () => {
    expect(fallback).not.toBeNull();
    expect(doc.getElementById("root")?.nextElementSibling).toBe(fallback);
    expect(fallback?.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Brauzeringiz eskirgan. Iltimos, Safari yoki Chrome'ni yangilang.",
    );
  });

  it("<noscript> — JavaScript yoqilmagan bo'lsa matn; zaxira blok u bilan birga chiqmaydi", () => {
    expect(noscript).not.toBeNull();
    expect(noscript?.textContent).toContain("Ilova ishlashi uchun JavaScript yoqilgan bo'lishi kerak.");
    expect(noscript?.innerHTML).toMatch(/#legacy-fallback\s*\{\s*display:\s*none;/);
  });

  it("zaxira blok oddiy yuklanishda ko'rinmaydi — 8 s yashirin (React chizilgach main.tsx uni o'chiradi)", () => {
    expect(html).toMatch(/#legacy-fallback\s*\{\s*visibility:\s*hidden;\s*animation:\s*elchi-legacy-fallback 0s linear 8s forwards;/);
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
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
    expect(script).toContain("/^\\/login\\/?$/i.test(location.pathname)");
    expect(script).toContain('classList.add("login-first-paint")');
  });
});
