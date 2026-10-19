// dizayn-v2: superadmin-scan-camera, courier-scan-camera, courier-scan-starting, courier-scan-permission-denied, courier-scan-active, courier-scan-success-flash, courier-scan-invalid, courier-scan-too-fast, courier-scan-manual-entry, courier-scan-not-found
import { memo, useCallback, useMemo, type ReactNode } from "react";
import { ArrowLeft, ChevronRight, History, House, ScanLine, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import type { RootState } from "../../app/config/store";
import { formatDateTimeLocalized } from "../../shared/lib/formatDateTime";
import type { ScanSource, ScanTarget } from "../../shared/lib/scanner";
import { useKeyboardScanner } from "../../shared/lib/useKeyboardScanner";
import { CameraLastScan } from "../../shared/ui/camera";
// Bu sahifa o'zi alohida (lazy) bo'lak — kamera to'g'ridan-to'g'ri, `loadScannerCamera` siz.
import { ScannerCamera } from "../../shared/ui/camera/ScannerCamera";
import { EmptyState, Spinner, buttonClasses } from "../../shared/ui/primitives";
import { useIsPhone } from "../../shared/ui/primitives/date/useIsPhone";
import { useScanHistory } from "./model/scanHistory";
import { scanHistoryTitle } from "./model/scanHistoryText";
import { useUniversalScan } from "./model/useUniversalScan";
import { useIsBelowLg } from "./model/useViewport";
import { ScanOutcomeCard, ScanRecentCard, ScanUsbCard, scanDetailRoute } from "./ui/ScanSideCards";

/** Skanerdan chiqish («Orqaga», telefonda «Skanerni yopish») — maketdagi `@dashboard-main`. */
const HOME_ROUTE = "/";

/** USB skan deb hisoblanadigan eng qisqa qiymat (undan qisqasi — maydonga qo'lda yozilgan matn). */
const MIN_KEYBOARD_SCAN_LENGTH = 4;

/**
 * UNIVERSAL SKANER — `/scan` (dizayn v2, Trello v1eLN2tV 1-bosqich). Maketlar: `superadmin-scan-camera`
 * (superadmin, admin, menejer, registrator — bitta fragment) va `courier-scan-*` holatlari.
 *
 * Pastki menyuning markaziy «Skaner» tugmasi va yuqori paneldagi «Skanerlash» sahifada skan maqsadi bo'lmasa
 * shu yerga olib keladi (maqsad bo'lsa kamera o'sha sahifa ustida ochiladi — `ScannerHost`). Bu yerda faqat
 * «Ma'lumot» rejimi: bitta kod → natija sahifasi `/scan/:token` (rejim segmenti — 3-bosqich, hozir chizilmaydi).
 *
 * Ko'rinish:
 *   - telefon (< 768) — `ScannerCamera presentation="page"`: to'liq ekran, tepada «Skanerni yopish» + sarlavha,
 *     pastda «Oxirgi: …» qatori va [Qo'lda kiritish] [Chiroq];
 *   - planshet / desktop — sarlavha («Orqaga», «Skaner ovozi»), kamera bloki va yon kartalar: «Natija»
 *     (ochilmagan oxirgi skan), «USB skaner ham tayyor» + qo'lda kiritish, «Oxirgi skanerlar · Shu qurilmada»
 *     (planshetda kamera ostida ikki ustun).
 *
 * Kirish yo'llari bitta handler'da (`useUniversalScan`): kamera (`ScannerCamera` ichida 700 / 1800 ms),
 * USB (HID, kursor qayerda bo'lishidan qat'i nazar — `captureEditableTargets`), qo'lda kiritish (token yoki
 * `/scan/<token>` havolasi; buyurtma raqami bo'yicha qidiruv API'si yo'q).
 *
 * Market roli skanerlamaydi (`roles.json` `persona.scan: false`): URL bilan ochilsa — bo'sh holat.
 */
const ScanPage = () => {
  const role = useSelector((state: RootState) => state.role.role);
  if (role === "market") return <ScanMarketBlocked />;
  return <UniversalScanner />;
};

const ScanMarketBlocked = () => {
  const { t } = useTranslation("scan");
  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <EmptyState
        size="page"
        icon={ScanLine}
        title={t("scanner.marketBlocked.title")}
        titleAs="h1"
        description={t("scanner.marketBlocked.text")}
        action={
          <Link to={HOME_ROUTE} className={buttonClasses({ variant: "primary" })}>
            <House size={18} aria-hidden="true" className="shrink-0" />
            {t("scanner.marketBlocked.action")}
          </Link>
        }
      />
    </div>
  );
};

const UniversalScanner = () => {
  const { t, i18n } = useTranslation("scan");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const isBelowLg = useIsBelowLg();
  const userId = useSelector((state: RootState) => state.user.user?.id ?? null);
  const { entries } = useScanHistory(userId);
  const { handleScan, opening, outcome } = useUniversalScan();

  const submit = useCallback(
    (raw: string, source: ScanSource) => {
      void handleScan(raw, source);
    },
    [handleScan],
  );

  useKeyboardScanner({
    enabled: true,
    captureEditableTargets: true,
    onScan: (raw) => {
      // Qo'lda kiritish maydonida odam yozib Enter bosganda buferda 1–3 belgi qoladi — bu skan emas,
      // forma o'zi yuboradi. Haqiqiy yorliq kodlari uzunroq (ichki token 24 belgi, `BTB-…`, `POST-…`).
      if (raw.trim().length < MIN_KEYBOARD_SCAN_LENGTH) return false;
      submit(raw, "keyboard");
      return true;
    },
  });

  const target = useMemo<ScanTarget>(
    () => ({
      id: "universal-scan",
      title: t("scanner.title"),
      context: t("scanner.context"),
      onScan: submit,
    }),
    [submit, t],
  );

  const latest = entries[0];
  let lastScan: ReactNode;
  if (opening) {
    lastScan = (
      <CameraLastScan
        icon={<Spinner />}
        tone="success"
        title={t("scanner.opening")}
        subtitle={opening.title ?? t("scanner.searching")}
      />
    );
  } else if (latest) {
    const who = latest.kind === "order" ? latest.name : latest.place;
    lastScan = (
      <Link to={scanDetailRoute(latest.token)} className="block rounded-[14px]">
        <CameraLastScan
          icon={<History aria-hidden="true" size={18} />}
          title={t("scanner.lastTitle", { title: scanHistoryTitle(t, latest, language) })}
          subtitle={[who, formatDateTimeLocalized(latest.at, { language })].filter(Boolean).join(" · ")}
          action={<ChevronRight aria-hidden="true" size={18} className="mr-1.5 shrink-0 opacity-70" />}
        />
      </Link>
    );
  } else {
    lastScan = (
      <CameraLastScan
        icon={<ScanLine aria-hidden="true" size={18} />}
        title={t("scanner.phoneEmptyTitle")}
        subtitle={t("scanner.phoneEmptyText")}
      />
    );
  }

  const camera = (
    <ScannerCamera
      target={target}
      presentation="page"
      onClose={() => navigate(HOME_ROUTE)}
      lastScan={lastScan}
      phoneSecondary="torch"
      manual={{
        label: t("scanner.manualDialogLabel"),
        hint: t("scanner.manualDialogHint"),
        submitLabel: t("scanner.manualSubmit"),
      }}
    />
  );

  if (isPhone) return camera;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link to={HOME_ROUTE} className={buttonClasses({ variant: "secondary" })}>
            <ArrowLeft size={18} aria-hidden="true" className="shrink-0" />
            {t("scanner.back")}
          </Link>
          <div className="flex min-w-0 flex-col">
            <h1 className="text-2xl/8 font-bold tracking-[-.01em] text-text">{t("scanner.title")}</h1>
            <p className="text-sm text-text-muted">{t("scanner.subtitle")}</p>
          </div>
        </div>
        <Link to="/settings" state={{ tab: "scanner" }} className={buttonClasses({ variant: "ghost" })}>
          <Volume2 size={18} aria-hidden="true" className="shrink-0" />
          {t("scanner.sound")}
        </Link>
      </header>
      <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-6 max-lg:grid-cols-1">
        <section
          aria-label={t("scanner.cameraLabel")}
          className="h-[clamp(420px,calc(100dvh-190px),780px)] min-w-0 max-lg:h-[min(640px,62dvh)]"
        >
          {camera}
        </section>
        <aside
          aria-label={t("scanner.sideLabel")}
          className="flex min-w-0 flex-col gap-4 max-lg:grid max-lg:grid-cols-2 max-lg:items-start"
        >
          {outcome ? (
            <div className="max-lg:col-span-2">
              <ScanOutcomeCard outcome={outcome} />
            </div>
          ) : null}
          <ScanUsbCard onSubmit={(code) => submit(code, "manual")} showTips={!isBelowLg && !outcome} />
          <ScanRecentCard entries={entries} limit={isBelowLg ? 2 : 4} />
        </aside>
      </div>
    </div>
  );
};

export default memo(ScanPage);
