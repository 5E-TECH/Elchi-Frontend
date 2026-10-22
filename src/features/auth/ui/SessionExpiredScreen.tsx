// dizayn-v2: common-session-expired
import { memo, useId } from "react";
import { Clock, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import MarkWhite from "../../../shared/assets/brand/elchi-mark-white.png";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { Button } from "../../../shared/ui/primitives";

/**
 * «Sessiya tugadi» ekrani — `/login` da, sessiya tugagani sababli chiqarilganda (maket `common-session-expired`).
 *
 * Butun ekran `bg-bg`: tepada navy belgi + «Elchi CRM», markazda karta (Lock, sarlavha, izoh, «Sessiya tugagan
 * vaqt» qatori, «Qayta kirish»). «Qayta kirish» — o'sha sahifada kirish formasini ochadi (qayta yuklashsiz).
 * Pastdagi «© 2026 Elchi Pochta» chizilmaydi (ega qarori 2026-10-16 — footer olib tashlangan).
 */
type SessionExpiredScreenProps = {
  /** Sessiya tugagan vaqt (ms). Yo'q bo'lsa — vaqt qatori chizilmaydi. */
  expiredAt: number | null;
  /**
   * Sessiya boshqa qurilmadan yopilgan (profil «Sessiyalar» → «Chiqarish»; server 401 «Session revoked») — izoh
   * sababni aytadi (maket yo'q — o'sha kartaning matni almashadi, tuzilma bir xil).
   */
  revoked?: boolean;
  onContinue: () => void;
};

const SessionExpiredScreen = ({ expiredAt, revoked = false, onContinue }: SessionExpiredScreenProps) => {
  const { t } = useTranslation("auth");
  const titleId = useId();
  const textId = useId();

  return (
    <div className="flex min-h-dvh w-full flex-col bg-bg text-text">
      <header className="flex items-center gap-3 px-8 py-5 max-lg:px-6 max-md:px-4">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-nav">
          <img src={MarkWhite} alt={t("brand.logoAlt")} width={24} height={22} className="block h-[22px] w-6" />
        </span>
        <span className="text-sm font-semibold text-text">{t("brand.name")}</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pt-6 pb-12">
        <section
          aria-labelledby={titleId}
          aria-describedby={textId}
          className="flex w-full max-w-[440px] min-w-0 flex-col items-center gap-6 rounded-[14px] border border-border bg-surface px-8 pt-10 pb-8 text-center max-md:px-5"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning-fg"
          >
            <Lock aria-hidden="true" focusable="false" size={24} />
          </span>

          <div className="flex flex-col items-center gap-2">
            <h1 id={titleId} className="text-2xl font-bold tracking-[-.01em] text-text max-md:text-xl">
              {t("sessionExpiredScreen.title")}
            </h1>
            <p id={textId} className="max-w-[300px] text-sm text-text-muted">
              {t(revoked ? "sessionExpiredScreen.revokedText" : "sessionExpiredScreen.text")}
            </p>
          </div>

          {expiredAt ? (
            <div className="flex w-full items-center justify-between gap-3 rounded-xl bg-sunken px-4 py-3 text-left">
              <span className="inline-flex min-w-0 items-center gap-2 text-[13px] text-text-muted">
                <Clock aria-hidden="true" focusable="false" size={16} className="shrink-0" />
                {t("sessionExpiredScreen.expiredAtLabel")}
              </span>
              <span className="shrink-0 text-[13px] font-semibold text-text">{formatDateTimeLocalized(expiredAt)}</span>
            </div>
          ) : null}

          <Button size="lg" fullWidth onClick={onContinue}>
            {t("sessionExpiredScreen.relogin")}
          </Button>
        </section>
      </main>
    </div>
  );
};

export default memo(SessionExpiredScreen);
