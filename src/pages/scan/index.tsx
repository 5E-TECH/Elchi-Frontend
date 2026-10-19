// dizayn-v2: superadmin-scan-camera, courier-scan-camera, courier-scan-starting, courier-scan-permission-denied, courier-scan-active, courier-scan-success-flash, courier-scan-invalid, courier-scan-too-fast, courier-scan-manual-entry, courier-scan-not-found, courier-scan-other-courier
import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  CircleCheck,
  History,
  House,
  ListChecks,
  PackageCheck,
  ScanLine,
  Store,
  Truck,
  Volume2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { RootState } from "../../app/config/store";
import { cx } from "../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../shared/lib/formatMoney";
import { playScanFeedback, scannerArrivalState, type ScanSource, type ScanTarget } from "../../shared/lib/scanner";
import { extractScannerToken } from "../../shared/lib/scanToken";
import { useKeyboardScanner } from "../../shared/lib/useKeyboardScanner";
import { CameraLastScan } from "../../shared/ui/camera";
// Bu sahifa o'zi alohida (lazy) bo'lak — kamera to'g'ridan-to'g'ri, `loadScannerCamera` siz.
import { ScannerCamera } from "../../shared/ui/camera/ScannerCamera";
import { Button, Dialog, EmptyState, Spinner, buttonClasses } from "../../shared/ui/primitives";
import { useIsPhone } from "../../shared/ui/primitives/date/useIsPhone";
import { extractTodayMarkets } from "../new_orders/model/todayMarkets";
import { fetchNewOrderMarkets, getScanResourceType, normalizeScanToken } from "./lib/scanResource";
import { requestedScanMode, useScanMode, useScanModes } from "./model/scanModes";
import { useScanHistory } from "./model/scanHistory";
import { scanHistoryTitle } from "./model/scanHistoryText";
import { useCourierTake } from "./model/useCourierTake";
import { useUniversalScan } from "./model/useUniversalScan";
import { useIsBelowLg } from "./model/useViewport";
import { ScanModeCard, ScanTakeCard, type ScanModeOption } from "./ui/ScanModeCards";
import { ScanOutcomeCard, ScanRecentCard, ScanUsbCard, scanDetailRoute } from "./ui/ScanSideCards";

/** Skanerdan chiqish («Orqaga», telefonda «Skanerni yopish») — maketdagi `@dashboard-main`. */
const HOME_ROUTE = "/";

/** «Kuryerga biriktirish» sahifasi va uning skan maqsadi (`pages/dispatch` — `useScanTarget({ id: "dispatch" })`). */
const DISPATCH_ROUTE = "/dispatch";
const DISPATCH_TARGET_ID = "dispatch";
/** Market yangi buyurtmalari sahifasining maqsadi: `new-orders:market:<id>` (`new_orderDetail`). */
const NEW_ORDERS_TARGET_PREFIX = "new-orders:market:";
/** Kuryer xulosasidan keyin — o'z buyurtmalari. */
const ORDERS_ROUTE = "/orders";

/** USB skan deb hisoblanadigan eng qisqa qiymat (undan qisqasi — maydonga qo'lda yozilgan matn). */
const MIN_KEYBOARD_SCAN_LENGTH = 4;

/**
 * UNIVERSAL SKANER — `/scan` (dizayn v2, Trello v1eLN2tV 1- va 3-bosqich). Maketlar: `superadmin-scan-camera`
 * (superadmin, admin, menejer, registrator — bitta fragment) va `courier-scan-*` holatlari.
 *
 * Pastki menyuning markaziy «Skaner» tugmasi va yuqori paneldagi «Skanerlash» sahifada skan maqsadi bo'lmasa
 * shu yerga olib keladi (maqsad bo'lsa kamera o'sha sahifa ustida ochiladi — `ScannerHost`).
 *
 * Rejimlar (3-bosqich, `model/scanModes.ts` — rol va filial imkoniyatiga qarab; tanlov qurilmada eslab qolinadi).
 * Segment telefonda kamera ichida (`ScanTarget.modes`), planshet/desktopda yon panelda («Skaner rejimi»):
 *   - «Ma'lumot» — bitta kod → natija sahifasi `/scan/:token` (kuryerdan boshqa hamma uchun sukut);
 *   - «Qabul qilish» — market varag'i (`GET orders/markets/new`, son va qidiruv bilan) → `/new-orders/<id>`,
 *     kamera o'sha sahifada OCHIQ davom etadi (`scannerArrivalState` → `ScannerHost`; qabul — F1 oqimi);
 *   - «Kuryerga biriktirish» (faqat backend `assign-to-courier` rollari: menejer, registrator) — tanlansa
 *     `/dispatch`, kamera ochiq; bu rejimda `/scan` da o'qilgan buyurtma kodi `/dispatch` ga olib o'tiladi va
 *     savatga o'sha sahifa handler'i bilan qo'shiladi;
 *   - kuryer «O'zimga olish» (kuryerda sukut) — ketma-ket `POST orders/scan-assign`, natija ro'yxati,
 *     «Tugatish» → kesh yangilanadi va xulosa (`model/useCourierTake.ts`).
 *
 * Ko'rinish:
 *   - telefon (< 768) — `ScannerCamera presentation="page"`: to'liq ekran, tepada «Skanerni yopish» + sarlavha,
 *     pastda rejim segmenti, «Oxirgi: …» qatori (yoki rejim amali / natija ro'yxati) va amallar;
 *   - planshet / desktop — sarlavha («Orqaga», «Skaner ovozi»), kamera bloki va yon kartalar: «Skaner rejimi»,
 *     «Natija» (ochilmagan oxirgi skan) yoki kuryer natijalari, «USB skaner ham tayyor» + qo'lda kiritish,
 *     «Oxirgi skanerlar · Shu qurilmada» (planshetda kamera ostida ikki ustun).
 *
 * Kirish yo'llari bitta handler'da (`submit`, rejim bo'yicha): kamera (`ScannerCamera` ichida 700 / 1800 ms),
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
  const location = useLocation();
  const queryClient = useQueryClient();
  const isPhone = useIsPhone();
  const isBelowLg = useIsBelowLg();
  const userId = useSelector((state: RootState) => state.user.user?.id ?? null);
  const { entries } = useScanHistory(userId);
  const modes = useScanModes();
  // Router state'dagi rejim (Sozlamalar «Kamerani sinash» — «Ma'lumot») faqat shu ochilish uchun.
  const [mode, setMode] = useScanMode(modes, userId, requestedScanMode(location.state));
  // «Qabul qilish»: market varag'ini ochish so'rovi (rejim tanlandi, «Marketni tanlang», market tanlanmay skan).
  const [switcherKey, setSwitcherKey] = useState(0);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const { handleScan: handleInfoScan, opening, outcome } = useUniversalScan();
  const take = useCourierTake({ enabled: mode === "take" && !summaryOpen && !finishing });
  const handleTakeScan = take.handleScan;
  const finishTakeFlow = take.finish;

  const openMarketPicker = useCallback(() => setSwitcherKey((key) => key + 1), []);

  /** «Kuryerga biriktirish» — `/dispatch`, kamera ochiq; `/scan` da o'qilgan kod savatga o'sha sahifa handler'i bilan. */
  const openDispatch = useCallback(
    (pendingScan?: { raw: string; source: ScanSource }) =>
      navigate(DISPATCH_ROUTE, { state: scannerArrivalState({ targetId: DISPATCH_TARGET_ID, pendingScan }) }),
    [navigate],
  );

  const submit = useCallback(
    (raw: string, source: ScanSource) => {
      if (mode === "take") {
        handleTakeScan(raw, source);
        return;
      }
      if (mode === "receive") {
        // Qabul market sahifasida (F1): market tanlanmaguncha kod hech qayerga ketmaydi.
        void playScanFeedback("error", t("scanner.receive.pickFirst"), source);
        openMarketPicker();
        return;
      }
      if (mode === "dispatch") {
        const extracted = extractScannerToken(raw, window.location.origin);
        const token = extracted ? normalizeScanToken(extracted) : null;
        if (!token || getScanResourceType(token) !== "order") {
          void playScanFeedback("error", t(token ? "scanner.dispatch.notOrder" : "scanner.invalid.title"), source);
          return;
        }
        openDispatch({ raw: token, source });
        return;
      }
      void handleInfoScan(raw, source);
    },
    [handleInfoScan, handleTakeScan, mode, openDispatch, openMarketPicker, t],
  );

  useKeyboardScanner({
    enabled: !summaryOpen,
    captureEditableTargets: true,
    onScan: (raw) => {
      // Qo'lda kiritish maydonida odam yozib Enter bosganda buferda 1–3 belgi qoladi — bu skan emas,
      // forma o'zi yuboradi. Haqiqiy yorliq kodlari uzunroq (ichki token 24 belgi, `BTB-…`, `POST-…`).
      if (raw.trim().length < MIN_KEYBOARD_SCAN_LENGTH) return false;
      submit(raw, "keyboard");
      return true;
    },
  });

  const handleModeChange = useCallback(
    (value: string) => {
      const next = modes.find((item) => item === value);
      if (!next || next === mode) return;
      setMode(next);
      if (next === "receive") openMarketPicker();
      if (next === "dispatch") openDispatch();
    },
    [mode, modes, openDispatch, openMarketPicker, setMode],
  );

  const finishTake = useCallback(async () => {
    setFinishing(true);
    try {
      await finishTakeFlow();
    } finally {
      setFinishing(false);
      setSummaryOpen(true);
    }
  }, [finishTakeFlow]);

  const loadMarkets = useCallback(async () => {
    const response = await fetchNewOrderMarkets(queryClient);
    return extractTodayMarkets(response).map((row) => ({
      value: row.market_id,
      label: row.name,
      meta: t("scanner.receive.pickMeta", {
        count: row.orders_count,
        value: formatNumberLocalized(row.orders_count, { language }),
      }),
    }));
  }, [language, queryClient, t]);

  const goToMarket = useCallback(
    (marketId: string) =>
      navigate(`/new-orders/${encodeURIComponent(marketId)}`, {
        state: scannerArrivalState({ targetId: `${NEW_ORDERS_TARGET_PREFIX}${marketId}` }),
      }),
    [navigate],
  );

  const modeOptions = useMemo<ScanModeOption[]>(
    () => modes.map((value) => ({ value, label: t(`scanner.modes.${value}`) })),
    [modes, t],
  );
  const showModes = modeOptions.length > 1;

  const target = useMemo<ScanTarget>(() => {
    const base = {
      id: "universal-scan",
      onScan: submit,
      modes: showModes ? modeOptions : undefined,
      mode,
      onModeChange: showModes ? handleModeChange : undefined,
    };
    if (mode === "receive") {
      return {
        ...base,
        title: t("scanner.receive.title"),
        context: t("scanner.receive.context"),
        hint: t("scanner.receive.hint"),
        icon: Store,
        switcher: {
          label: t("scanner.receive.pick"),
          value: "",
          title: t("scanner.receive.pick"),
          options: loadMarkets,
          onSelect: goToMarket,
        },
      };
    }
    if (mode === "dispatch") {
      return {
        ...base,
        title: t("scanner.dispatch.title"),
        context: t("scanner.dispatch.context"),
        hint: t("scanner.dispatch.hint"),
        icon: Truck,
      };
    }
    if (mode === "take") {
      return {
        ...base,
        title: t("scanner.take.title"),
        context: t("scanner.take.context"),
        hint: t("scanner.take.hint"),
        icon: PackageCheck,
        progress: { done: take.summary.assigned, label: t("scanner.take.meter") },
        list: take.list,
        listTitle: t("scanner.take.listTitle"),
        // «2 ta biriktirildi · 3 ta skan» — son birligi bilan (ro'yxatda xato qatorlar ham bor).
        listDescription: `${formatNumberLocalized(take.summary.assigned, { language })} ${t("scanner.take.meter")} · ${t(
          "scanner.take.scans",
          { count: take.list.length, value: formatNumberLocalized(take.list.length, { language }) },
        )}`,
        finish: { label: t("scanner.take.finish"), keepOpen: true, onFinish: () => void finishTake() },
      };
    }
    return { ...base, title: t("scanner.title"), context: t("scanner.context") };
  }, [
    finishTake,
    goToMarket,
    handleModeChange,
    language,
    loadMarkets,
    mode,
    modeOptions,
    showModes,
    submit,
    t,
    take.list,
    take.summary.assigned,
  ]);

  const dispatchLinkState = scannerArrivalState({ targetId: DISPATCH_TARGET_ID });
  const latest = entries[0];
  let lastScan: ReactNode;
  if (mode === "receive") {
    // Market tanlovi — sarlavhadagi almashtirish chipida (pastda takror «Marketni tanlang» qatori yo'q).
    lastScan = null;
  } else if (mode === "dispatch") {
    lastScan = (
      <Link to={DISPATCH_ROUTE} state={dispatchLinkState} className="block rounded-[14px]">
        <CameraLastScan
          icon={<Truck aria-hidden="true" size={18} />}
          title={t("scanner.dispatch.open")}
          subtitle={t("scanner.dispatch.openText")}
          action={<ChevronRight aria-hidden="true" size={18} className="mr-1.5 shrink-0 opacity-70" />}
        />
      </Link>
    );
  } else if (opening) {
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

  const manualSubmitLabel =
    mode === "take"
      ? t("scanner.take.manualSubmit")
      : mode === "dispatch"
        ? t("scanner.dispatch.manualSubmit")
        : mode === "info"
          ? t("scanner.manualSubmit")
          : undefined;
  const manualText = {
    label: t("scanner.manualDialogLabel"),
    hint: t("scanner.manualDialogHint"),
    ...(manualSubmitLabel ? { submitLabel: manualSubmitLabel } : {}),
  };

  const camera = (
    <ScannerCamera
      target={target}
      presentation="page"
      onClose={() => navigate(HOME_ROUTE)}
      lastScan={lastScan}
      // Kuryer «O'zimga olish»: pastda [Qo'lda kiritish] [Tugatish] (chiroq tepada) — maket `courier-courier-bulk-scanner-camera`.
      phoneSecondary={mode === "take" ? "primary" : "torch"}
      manual={manualText}
      switcherOpenKey={switcherKey}
      // Kamera to'xtaydi: «Qabul qilish» — market tanlanmaguncha skan hech qayerga ketmaydi (kamera market
      // sahifasida ochiladi); kuryer xulosasi / «Tugatish» — skanlar qabul qilinmaydi, «Skanerlash faol» yolg'on.
      paused={mode === "receive" || (mode === "take" && (summaryOpen || finishing))}
    />
  );

  const summaryDialog = (
    <Dialog
      open={summaryOpen}
      onClose={() => setSummaryOpen(false)}
      size="md"
      className={isPhone ? "dark" : undefined}
      icon={CircleCheck}
      iconTone="success"
      title={t("scanner.take.summary.title")}
      description={t("scanner.take.summary.text", {
        count: take.summary.assigned,
        value: formatNumberLocalized(take.summary.assigned, { language }),
      })}
      footer={
        <>
          {/* Keng ekranda oddiy o'lcham — ikki tugma bir qatorga sig'adi; telefonda varaqa tugmalari katta. */}
          <Button variant="secondary" size={isPhone ? "lg" : "md"} onClick={() => setSummaryOpen(false)}>
            {t("scanner.take.summary.continue")}
          </Button>
          <Button size={isPhone ? "lg" : "md"} leftIcon={ListChecks} onClick={() => navigate(ORDERS_ROUTE)}>
            {t("scanner.take.summary.orders")}
          </Button>
        </>
      }
    >
      <dl className="m-0 flex flex-col divide-y divide-border">
        {(
          [
            { key: "assigned", value: take.summary.assigned, className: "text-success-fg" },
            { key: "already", value: take.summary.already, className: "text-text" },
            { key: "failed", value: take.summary.failed, className: take.summary.failed > 0 ? "text-danger-fg" : "text-text" },
          ] as const
        ).map((row) => (
          <div key={row.key} className="flex min-h-11 items-center justify-between gap-3 py-2">
            <dt className="text-sm text-text-muted">{t(`scanner.take.summary.${row.key}`)}</dt>
            <dd className={cx("m-0 text-base font-bold", row.className)}>
              {formatNumberLocalized(row.value, { language })}
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );

  if (isPhone) {
    return (
      <>
        {camera}
        {summaryDialog}
      </>
    );
  }

  let modeAction: ReactNode = null;
  if (mode === "receive") {
    modeAction = (
      <Button fullWidth leftIcon={Store} aria-haspopup="dialog" onClick={openMarketPicker}>
        {t("scanner.receive.pick")}
      </Button>
    );
  } else if (mode === "dispatch") {
    modeAction = (
      <Link to={DISPATCH_ROUTE} state={dispatchLinkState} className={buttonClasses({ fullWidth: true })}>
        <Truck size={18} aria-hidden="true" className="shrink-0" />
        {t("scanner.dispatch.open")}
      </Link>
    );
  }

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
            {/* Rejimda sahifa ochilmaydi — izoh rejimniki («Buyurtma darhol sizga biriktiriladi»). */}
            <p className="text-sm text-text-muted">{t(mode === "info" ? "scanner.subtitle" : `scanner.${mode}.context`)}</p>
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
          {showModes ? (
            <div className="min-w-0 max-lg:col-span-2">
              <ScanModeCard
                options={modeOptions}
                mode={mode}
                onModeChange={handleModeChange}
                text={t(`scanner.modes.${mode}Text`)}
                action={modeAction}
              />
            </div>
          ) : null}
          {mode === "info" && outcome ? (
            <div className="min-w-0 max-lg:col-span-2">
              <ScanOutcomeCard outcome={outcome} />
            </div>
          ) : null}
          {mode === "take" ? (
            <div className="min-w-0 max-lg:col-span-2">
              <ScanTakeCard
                list={take.list}
                assigned={take.summary.assigned}
                finishing={finishing}
                onFinish={() => void finishTake()}
              />
            </div>
          ) : null}
          {/* «Qabul qilish»: market tanlanmaguncha kod hech qayerga ketmaydi — qo'lda kiritish ham yo'q. */}
          {mode !== "receive" ? (
            <ScanUsbCard
              onSubmit={(code) => submit(code, "manual")}
              showTips={!isBelowLg && !(mode === "info" && outcome) && !showModes}
              submitLabel={manualSubmitLabel}
            />
          ) : null}
          {mode !== "take" ? (
            <ScanRecentCard
              entries={entries}
              limit={isBelowLg ? 2 : 4}
              emptyText={mode === "info" ? undefined : t("scanner.recentEmptyModeText")}
            />
          ) : null}
        </aside>
      </div>
      {summaryDialog}
    </div>
  );
};

export default memo(ScanPage);
