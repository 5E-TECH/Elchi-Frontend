// dizayn-v2: (maket yo'q) tizim-feedback
import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import tokenStorage, { AUTH_SESSION_METADATA_EVENT } from "../../../auth/tokenStorage";
import { cx } from "../../../shared/lib/cx";
import { useShellBannerSlot } from "../../../shared/lib/shellBannerSlot";
import { Button } from "../../../shared/ui/primitives/Button";
import { useAppUpdateAvailable } from "../model/useAppUpdateAvailable";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  «YANGI VERSIYA» BANNERI — dizayn v2. Maket yo'q — eng yaqini: taxta `tizim-feedback` 04 «Sahifa bannerlari»
 *  (`.el-banner` + ton; «Internet aloqasi yo'q» bannerining tuzilishi: ikonka, qalin sarlavha + izoh, o'ngda
 *  ikkilamchi tugma)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Ochiq turgan ilovaga yangi versiya chiqsa (`model/useAppUpdateAvailable.ts`): «Ilovaning yangi versiyasi chiqdi.
 *  Ochiq formani saqlab, keyin yangilang.» + «Yangilash» (sahifa qayta yuklanadi). O'zi qayta YUKLAMAYDI — yarim
 *  to'ldirilgan forma (sotish, to'lov) yo'qolmasin; foydalanuvchi ishini tugatib bosadi. Yopish tugmasi yo'q
 *  (taxta: banner «holat o'zgarguncha» turadi).
 *
 *  Joyi va qatlam — sessiya banneri bilan bir xil (`auth/SessionExpiryCountdown.tsx`): shell slotiga portal,
 *  slot yo'q qobiqda (`/login`, `ScanLayout`, `/tg/scan`) — o'z joyida `sticky top-0`. Taxta: «bir vaqtda bitta
 *  banner — eng muhimi» — sessiya banneri ko'rinib turganda (tugashiga oz qoldi / tugadi) bu banner kutadi.
 *
 *  Ilovada bir marta (`app/lib/provider.tsx`) — ENTRY chunk'da: faqat entry'da bor primitivlar.
 */

/** Uzoq kutishda ham taymer to'lib ketmasin (`setTimeout` chegarasi ~24,8 kun) — ko'pi bilan soatda bir tekshiriladi. */
const MAX_TIMER_MS = 60 * 60_000;

/** Sessiya banneri hozir ko'rinib turibdimi (o'sha shart: `/login` dan tashqarida va `refreshTokenWarnAt` o'tgan). */
const useSessionBannerVisible = () => {
  const location = useLocation();
  const [metadata, setMetadata] = useState(() => tokenStorage.getSessionMetadata());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const onChange = () => {
      setMetadata(tokenStorage.getSessionMetadata());
      setNow(Date.now());
    };
    window.addEventListener(AUTH_SESSION_METADATA_EVENT, onChange);
    return () => window.removeEventListener(AUTH_SESSION_METADATA_EVENT, onChange);
  }, []);

  const { refreshTokenExpiresAt, refreshTokenWarnAt } = metadata;
  useEffect(() => {
    if (!refreshTokenWarnAt || refreshTokenWarnAt <= now) return undefined;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(refreshTokenWarnAt - now, MAX_TIMER_MS));
    return () => window.clearTimeout(timer);
  }, [refreshTokenWarnAt, now]);

  return (
    location.pathname !== "/login" &&
    Boolean(refreshTokenExpiresAt && refreshTokenWarnAt && now >= refreshTokenWarnAt)
  );
};

const UpdateBanner = () => {
  const { t } = useTranslation();
  const shellSlot = useShellBannerSlot();
  const sessionBannerVisible = useSessionBannerVisible();
  const [reloading, setReloading] = useState(false);

  if (sessionBannerVisible) return null;

  const reload = () => {
    setReloading(true);
    window.location.reload();
  };

  const banner = (
    <div
      data-update-banner=""
      role="status"
      // `*-soft` tungi mavzuda yarim shaffof — tagida `surface` (sticky holatda ostidan sahifa ko'rinmasin).
      className={cx("bg-surface", !shellSlot && "sticky top-0 z-[35]")}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-info-soft px-8 py-2.5 text-sm text-info-fg max-lg:px-4">
        <RefreshCw aria-hidden="true" focusable="false" size={20} className="shrink-0" />
        <p className="m-0 min-w-0 flex-[1_1_260px] text-text">
          <span className="font-semibold">{t("appUpdate.title")}</span>{" "}
          <span className="text-text-muted">{t("appUpdate.text")}</span>
        </p>
        <Button variant="secondary" size="sm" className="ml-auto" loading={reloading} onClick={reload}>
          {t("appUpdate.reload")}
        </Button>
      </div>
    </div>
  );

  return shellSlot ? createPortal(banner, shellSlot) : banner;
};

type AppUpdateBannerProps = {
  /** Test uchun (`useAppUpdateAvailable` bilan bir xil). */
  enabled?: boolean;
  check?: () => Promise<boolean>;
};

const AppUpdateBanner = ({ enabled, check }: AppUpdateBannerProps) => {
  const available = useAppUpdateAvailable({ enabled, check });
  return available ? <UpdateBanner /> : null;
};

export default memo(AppUpdateBanner);
