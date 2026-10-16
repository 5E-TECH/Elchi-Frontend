// dizayn-v2: tizim-errors
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ButtonIcon, buttonClasses, type ButtonVariant, type IconSlot } from "../primitives";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  XATO SAHIFASI RAMKASI — taxta `tizim-errors` 01 «Sahifa xatolari» (404 · 403 · 500 · ilova xatosi)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Kartaning o'zi — `EmptyState` / `ErrorState` (`size="page"`, `framed`): doirada ikonka 56, «Xato kodi …»
 *  ustki yozuvi, 24 px sarlavha (telefonda 20), bir jumla, 2 ta teng tugma (asosiy — muammoni hal qiladigan
 *  qadam, ikkinchisi — chiqish yo'li). Bu ramka faqat joylashuvni beradi:
 *
 *    - shell ichida (`*` → `NotFound`): kontent maydonining o'rtasida, yon menyu va yuqori panel joyida qoladi;
 *    - `standalone` — shell'siz route'lar (`/403`, `/404`, `/500`, `/runtime-error`; kirishdan oldin ham
 *      ochiladi): butun ekran `bg-bg`, karta o'rtada.
 */

/** Shell kontent maydoni balandligi: 100dvh − topbar 64 − chekkalar (≥ 1024: 24 + 48; < 1024: 16 + 88) − pastki menyu. */
const IN_SHELL =
  "flex min-h-[calc(100dvh-136px)] items-center justify-center max-lg:min-h-[calc(100dvh-168px)] " +
  "max-md:min-h-[calc(100dvh-168px-var(--shell-bottomnav-h,0px))]";

const STANDALONE = "flex min-h-dvh items-center justify-center bg-bg p-8 font-sans text-text max-md:p-4";

export type ErrorPageFrameProps = {
  /** Shell'siz route — butun ekran. */
  standalone?: boolean;
  children: ReactNode;
};

export const ErrorPageFrame = ({ standalone = false, children }: ErrorPageFrameProps) => {
  const card = <div className="w-full max-w-[660px] min-w-0">{children}</div>;
  return standalone ? (
    <main className={STANDALONE}>{card}</main>
  ) : (
    <div className={IN_SHELL}>{card}</div>
  );
};

/** Havola-tugma («Bosh sahifaga qaytish», maket `<a class="el-btn">`): `Link` + `buttonClasses`, ikonka 18. */
export const ErrorPageLink = ({
  to,
  icon,
  variant = "primary",
  children,
}: {
  to: string;
  icon: IconSlot;
  variant?: ButtonVariant;
  children: ReactNode;
}) => (
  <Link to={to} className={buttonClasses({ variant })}>
    <ButtonIcon icon={icon} px={18} />
    {children}
  </Link>
);
