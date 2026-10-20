import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup, configure } from "@testing-library/react";
import { toastStore } from "../shared/lib/notify";
import { getConfirmSnapshot, removeConfirm } from "../shared/ui/primitives/dialog/confirmStore";
import { i18nReady } from "../i18n";

// O'zbekcha tarjimalarning yadrodan tashqari qismi alohida chunk (rzzxMItN, `src/i18n.ts`) — test fayli (va undagi
// modul darajasidagi `i18n.t` sxemalari) yuklanishidan oldin tayyor bo'lsin, xuddi ilova chizilishidan oldingidek.
await i18nReady;

// `<Toaster />` xabar matnini ekran o'quvchi uchun yashirin jonli hududda (`[data-toast-announcer]`) takrorlaydi.
// `*ByText` so'rovlari ko'rinadigan matnni qidiradi — aks holda har xabar ikki marta topiladi.
// E'lonning o'zi `Toaster.test.tsx` da selektor orqali tekshiriladi.
configure({ defaultIgnore: "script, style, [data-toast-announcer], [data-toast-announcer] *" });

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
window.scrollTo = vi.fn();
Object.defineProperty(window, "CSS", {
  configurable: true,
  value: {
    ...(window.CSS ?? {}),
    supports: vi.fn(() => false),
  },
});

const getComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = ((element: Element, pseudoElement?: string | null) =>
  getComputedStyle(element, pseudoElement ? null : pseudoElement)) as typeof window.getComputedStyle;

window.matchMedia = window.matchMedia || ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// Unit testlar haqiqiy tarmoqqa chiqmaydi (`.env.test` → `127.0.0.1:9`). Mock qilinmagan so'rov testni yiqitadi: aks holda
// uning xatosi tasodifiy vaqtda keyingi testga «Internet aloqasi yo'q» xabarini tashlardi (deploy PR #311, ikki
// «Qayta urinish»). Faqat jsdom muhitida (`XMLHttpRequest` bor).
const realRequests: string[] = [];
if (typeof XMLHttpRequest !== "undefined") {
  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: unknown[]) {
    realRequests.push(`${String(args[0])} ${String(args[1])}`);
    return (nativeOpen as (...rest: unknown[]) => void).apply(this, args);
  } as typeof XMLHttpRequest.prototype.open;
}

afterEach(() => {
  cleanup();
  // `notify()` va `confirm()` do'konlari modul darajasida — testlar bir-biriga xabar/oyna qoldirmasin.
  // Faqat bekor qilish (`cancelAllConfirms`) yetmaydi: `ConfirmHost` allaqachon o'chirilgan, `onExited`
  // kelmaydi va yopilgan so'rov navbat boshida qolib, keyingi testdagi `confirm()` ni to'sib qo'yadi.
  for (const request of getConfirmSnapshot().requests) removeConfirm(request.id);
  toastStore.reset();
  vi.clearAllMocks();
  if (realRequests.length > 0) {
    const list = realRequests.splice(0).join(", ");
    throw new Error(`Unit testda haqiqiy tarmoq so'rovi: ${list} — so'rovni mock qiling (masalan vi.spyOn(api, "get"))`);
  }
});
