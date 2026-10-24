// dizayn-v2: common-login, common-login-error, common-session-expired
import { memo, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../app/config/store";
import LogoWhite from "../../shared/assets/brand/elchi-logo-white.png";
import { clearLoginNotice, peekLoginNoticeDetails, type LoginNoticeDetails } from "../../auth/loginNotice";
import LoginForm from "./ui/LoginForm";
import SessionExpiredScreen from "./ui/SessionExpiredScreen";

/**
 * `/login` — dizayn v2 (maketlar `common-login`, `common-login-error`, `common-session-expired`).
 *
 * - ≥ 1024: chapda navy panel (42 %, ko'pi bilan 620 px) — oq logotip, pastda «Elchi CRM» + shior; o'ngda
 *   `surface` ustida forma (≤ 400 px, markazda).
 * - < 1024: panel o'rnida `<main>` tepasida navy tasma (logotip, «Elchi CRM», shior), ostida forma.
 * - Sessiya tugagani sababli chiqarilgan bo'lsa (`loginNotice` → `sessionExpired`) — avval «Sessiya tugadi»
 *   ekrani (boshqa qurilmadan yopilgan bo'lsa — `revoked`, sababi bilan; parol almashgani uchun — `revokedReason`);
 *   «Qayta kirish» o'sha sahifada formani ochadi. Xabar bir martalik: initializer'da o'qiladi, effektda
 *   o'chiriladi (StrictMode ikki marta o'qisa ham bir xil).
 * - Mavzu — ilova mavzusi (tokenlar). «© 2026 Elchi Pochta» chizilmaydi (ega qarori 2026-10-16).
 */
const readSessionExpiredNotice = (): LoginNoticeDetails | null => {
  const details = peekLoginNoticeDetails();
  return details?.notice === "sessionExpired" ? details : null;
};

const Login = () => {
  const { t } = useTranslation("auth");
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);
  const isAppInitializing = useSelector((state: RootState) => state.user.isAppInitializing);
  const [expiredNotice] = useState(readSessionExpiredNotice);
  const [showExpired, setShowExpired] = useState(() => expiredNotice !== null);

  useEffect(() => {
    if (expiredNotice) clearLoginNotice();
  }, [expiredNotice]);

  if (!isAppInitializing && isAuthenticated) {
    return <Navigate replace to="/" />;
  }

  if (showExpired) {
    return (
      <SessionExpiredScreen
        expiredAt={expiredNotice?.at ?? null}
        revoked={expiredNotice?.revoked === true}
        revokedReason={expiredNotice?.revokedReason}
        onContinue={() => setShowExpired(false)}
      />
    );
  }

  return (
    <div className="flex min-h-dvh w-full bg-surface text-text">
      <aside aria-label={t("brand.name")} className="relative hidden max-w-[620px] flex-[0_0_42%] bg-nav lg:block">
        <div className="absolute inset-0 flex flex-col gap-8 px-14 py-12">
          <img src={LogoWhite} alt={t("brand.logoAlt")} width={145} height={48} className="block h-12 w-[145px]" />
          <div className="mt-auto flex max-w-[440px] flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-[.05em] text-nav-text">{t("brand.name")}</span>
            <p className="text-2xl font-bold tracking-[-.01em] text-nav-text">{t("brand.tagline")}</p>
            <p className="max-w-[340px] text-sm text-nav-text">{t("brand.description")}</p>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-surface">
        <div className="hidden flex-[2_1_auto] flex-col items-center justify-center gap-3 bg-nav px-4 pt-10 pb-8 text-center max-lg:flex">
          <img src={LogoWhite} alt={t("brand.logoAlt")} width={145} height={48} className="block h-12 w-[145px]" />
          <span className="text-xs font-semibold uppercase tracking-[.05em] text-nav-text">{t("brand.name")}</span>
          <p className="max-w-[320px] text-sm text-nav-text">{t("brand.tagline")}</p>
        </div>

        <div className="flex flex-[1_1_auto] items-center justify-center px-4 py-8">
          <LoginForm autoFocus={expiredNotice !== null} />
        </div>
      </main>
    </div>
  );
};

export default memo(Login);
