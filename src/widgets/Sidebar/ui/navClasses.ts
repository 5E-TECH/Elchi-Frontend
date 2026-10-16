// dizayn-v2: shell
/**
 * Navy (`bg-nav`) ustidagi menyu qatorlari klasslari — maket `.el-nav-item` (design/kit/helmet.html).
 * Yon menyu (`Sidebar`, `SidebarItem`) va planshetdagi suriluvchi panel (`MobileMenu`) bir xil ishlatadi.
 * Holat klasslari alohida (bir xususiyatga ikki klass tushmasin — `cx` birlashtirmaydi).
 */

/** Navy fondagi bosiladigan qator (band, «Yashirish», «Chiqish») uchun umumiy klasslar — rangsiz. */
export const NAV_ROW =
  "flex min-w-0 items-center gap-3 rounded-[10px] text-sm no-underline " +
  "transition-[background-color,border-color,color,box-shadow,opacity] duration-150 motion-reduce:transition-none " +
  "focus-visible:outline-nav-text!";

/** Oddiy holat: `nav-text`, 500; hover'da faqat fon va oq matn. */
export const NAV_ROW_IDLE = "font-medium text-nav-text hover:bg-nav-hover hover:text-on-nav";

/** Faol holat (`aria-current="page"`): `nav-active` fon, oq matn, 600. */
export const NAV_ROW_ACTIVE = "bg-nav-active font-semibold text-on-nav";

/** Yig'ilgan menyudagi ikonka katagi (maket: 48 × 44). */
export const NAV_ROW_COLLAPSED =
  "relative mx-auto flex h-11 w-12 shrink-0 items-center justify-center";
