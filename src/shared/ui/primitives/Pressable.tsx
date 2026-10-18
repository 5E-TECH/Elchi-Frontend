import type { ComponentPropsWithRef } from "react";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  BOSILADIGAN YUZA — uslubsiz <button> (dizayn v2, 5-bosqich; docs/DESIGN_SYSTEM.md §12.2)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Amal tugmasi EMAS (u — `Button` / `IconButton`). Karta, telefon qator-kartasi, chip (`aria-pressed`), chip «×»,
 *  menyu bandi (`role="menuitem"`), kalit (`role="switch"`, `.el-switch`), ochib-yopish sarlavhasi (`aria-expanded`),
 *  matn ko'rinishidagi «ochish» (`hover:underline`) uchun. Ko'rinishni chaqiruvchi beradi (design/CODE-MAP.md
 *  retsepti); Pressable o'zi klass qo'shmaydi — DOM aynan `<button type="button" …>`. `.el-btn` ko'rinishi
 *  (fon + radius + balandlik) bu yerda yasalmaydi.
 *  Fokus halqasi — global `:focus-visible` (index.css).
 *
 *  Xom `<button>` ilovada ESLint `design-v2/raw-control` bilan taqiqlangan (dizayn tizimi qatlamidan tashqarida).
 */
export type PressableProps = ComponentPropsWithRef<"button">;

export function Pressable({ type = "button", ...rest }: PressableProps) {
  return <button type={type} {...rest} />;
}
