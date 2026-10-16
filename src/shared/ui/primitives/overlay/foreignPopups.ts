/**
 * O'TISH DAVRI: oyna ichidagi antd suzuvchi panellari (`DatePicker`, `Dropdown`, `Select`, `Cascader`).
 *
 * Ular `body` ga portal qilinadi va bizning qatlam stekimizda (`layerStack`) yo'q. Esc ni o'zlari
 * yopadi, lekin hammasi ham hodisani to'xtatmaydi: `DatePicker` (`@rc-component/picker`) hech narsa
 * qilmaydi, `Dropdown` esa Esc ni `window` da tinglaydi (`@rc-component/portal`). Natijada oyna
 * fokus qamog'i (`document` da) ro'yxat bilan BIRGA oynani ham yopardi va `Dropdown` ga Esc umuman
 * yetib bormasdi.
 *
 * Shuning uchun Esc bosilgan PAYTDAGI holat (capture fazasida, antd o'zini yopishidan oldin) olinadi:
 * ochiq antd panel bo'lsa — bu Esc unikidir, oyna unga tegmaydi. Sahifalar 4-bosqichda v2 `Select` /
 * `DateRange` ga o'tgach bu modul kerak bo'lmaydi.
 */
const FOREIGN_POPUP_SELECTOR = [".ant-select-dropdown", ".ant-picker-dropdown", ".ant-dropdown", ".ant-cascader-dropdown"].join(",");

/** Yopiq (`…-hidden`) yoki yopilish harakatidagi (`…-leave`) panel hisoblanmaydi. */
const isClosing = (element: Element) =>
  Array.from(element.classList).some((name) => name.endsWith("-hidden") || name.endsWith("-leave"));

/**
 * Hozir ekranda ochiq antd suzuvchi paneli bormi. `inert` ichidagisi (oyna ochilishidan OLDIN sahifada
 * ochiq qolgan, endi orqa fonda) hisoblanmaydi — aks holda Esc oynani hech qachon yopa olmasdi.
 */
export const hasOpenForeignPopup = (): boolean => {
  if (typeof document === "undefined") return false;
  return Array.from(document.querySelectorAll(FOREIGN_POPUP_SELECTOR)).some((element) => {
    if (isClosing(element) || element.closest("[inert]")) return false;
    const visible = (element as HTMLElement).checkVisibility?.();
    return visible ?? true;
  });
};
