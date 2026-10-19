// dizayn-v2: tizim-scanner, superadmin-neworders-market-orders-camera, manager-dispatch-camera-dialog, courier-scan-permission-denied, courier-courier-bulk-scanner-camera-list
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Camera,
  CameraOff,
  Check,
  ChevronDown,
  CircleCheck,
  CircleX,
  Flashlight,
  History,
  Info,
  Keyboard,
  List,
  RefreshCw,
  Repeat,
  ScanLine,
  Timer,
  TriangleAlert,
  Undo2,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { markScannerCameraMounted } from "../../lib/scanner/scannerHost";
import type {
  ScanTarget,
  ScanTargetListItem,
  ScanTargetStat,
  ScanTargetSwitcher,
  ScanTargetSwitcherOption,
  ScanTargetTone,
} from "../../lib/scanner/scanTargets";
import {
  Badge,
  Button,
  Dialog,
  Field,
  IconButton,
  Portal,
  Pressable,
  SegmentedControl,
  Spinner,
  TextInput,
  useFocusTrap,
  useScrollLock,
} from "../primitives";
import { useIsPhone } from "../primitives/date/useIsPhone";
import { detectCameraPlatform } from "./cameraPermission";
import {
  CameraBottom,
  CameraButton,
  CameraCard,
  CameraChip,
  CameraCount,
  CameraHint,
  CameraLastScan,
  CameraProgress,
  CameraStatus,
  CameraSteps,
  CameraSurface,
  CameraToast,
  CameraToasts,
  ScanFinder,
  type CameraTone,
} from "./CameraSurface";
import { useScannerCameraSession, type CameraResult } from "./useScannerCameraSession";

/**
 * KAMERA SKANERI (dizayn v2) — taxta `tizim-scanner`: anatomiya (§03, 10 qism), holatlar (§04), uzluksiz skan
 * (§05), desktop/planshet oynasi (§06), kirish qulayligi (§08). Maketlar: `superadmin-neworders-market-orders-camera`
 * (telefon to'liq ekran + desktop oyna), `manager-dispatch-camera-dialog` (planshet, o'ng panel 300 px, ro'yxatda
 * «Bekor qilish»), `courier-scan-permission-denied`, `courier-courier-bulk-scanner-camera-list` (ro'yxat varag'i).
 *
 * Ko'rinish:
 *   - telefon (< 768) — to'liq ekran, doim qorong'i yuza; pastda hisoblagich, oxirgi skan, amallar;
 *   - `overlay` planshet/desktop — markazda oyna 1080 × 680 (planshet: to'liq kenglik, chetlar 24 px), chapda
 *     kamera (yuqorida faqat holat chipi va asboblar), o'ngda 360 px (planshet 300) panel: sarlavha + «Yopish»,
 *     hisoblagich, qoida, ro'yxat, «USB skaner ham tayyor», amallar;
 *   - `page` planshet/desktop — faqat kamera bloki (universal skaner sahifasi yon kartalarni o'zi chizadi).
 *
 * Mantiq: `useCameraQrScanner` + `useScannerGate` (700 / 1800 ms) — kamera har skandan keyin YOPILMAYDI;
 * har o'qilgan qiymat `target.onScan(raw, "camera")`, qo'lda kiritilgan — `"manual"`. Natija xabari sahifaning
 * `playScanFeedback(...)` hodisasidan (USB skan ham shu yerda ko'rinadi). Kamera ochiq turganda USB skaner
 * sahifaning o'z hook'i orqali ishlayveradi — kamera uni ikkinchi marta yubormaydi.
 *
 * A11y: fokus «Yopish» da boshlanadi, Tab oyna ichida aylanadi, Esc yopadi, orqa sahifa aylanmaydi (`overlay`);
 * natija `role="status"`; chiroq kamera yopilganda o'zi o'chadi (oqim to'xtaydi).
 */

export type ScannerCameraPresentation = "overlay" | "page";

export type ScannerCameraProps = {
  target: ScanTarget;
  /** `overlay` (sukut) — oqim ustidagi oyna (fokus tuzog'i, Esc, skroll qulfi); `page` — sahifaning o'zi. */
  presentation?: ScannerCameraPresentation;
  /** «Yopish» (va Esc). `page` da ixtiyoriy — berilmasa telefonda yopish tugmasi yo'q. */
  onClose?: () => void;
  /**
   * Telefon pastidagi «Oxirgi» qatori (`target.list` bo'lmasa): universal skaner sahifasi o'z tarixini beradi
   * (maket `superadmin-scan-camera` — «Oxirgi: №10241 · Buyurtma», bosilsa natija ochiladi).
   */
  lastScan?: ReactNode;
  /**
   * Telefonda «Qo'lda kiritish» yonidagi tugma: sukut — «Tugatish» / «Yopish»; `"torch"` — «Chiroq»
   * (universal skaner maketi: yopish tepada, chiroq pastda; qurilmada chiroq bo'lmasa — faqat «Qo'lda kiritish»).
   */
  phoneSecondary?: "primary" | "torch";
  /** «Kodni qo'lda kiriting» varag'i matnlari (sukut — oqim: «Qo'shish»; universal skaner: «Ochish»). */
  manual?: ScannerCameraManualText;
  /**
   * Maqsad vaqtincha yo'q (`ScannerHost` almashish oralig'i: eski sahifa yopildi, yangisi hali yuklanmoqda).
   * Kamera ishlayveradi, lekin skan va qo'lda kiritish hech qayerga yuborilmaydi; chipda «Yuklanmoqda».
   */
  suspended?: boolean;
};

export type ScannerCameraManualText = { label?: string; hint?: string; submitLabel?: string };

const RESULT_TONE: Record<CameraResult["type"], CameraTone> = {
  success: "success",
  duplicate: "info",
  missing: "error",
  error: "error",
  tooFast: "warning",
};

const RESULT_ICON: Record<CameraResult["type"], LucideIcon> = {
  success: Check,
  duplicate: Repeat,
  missing: X,
  error: CircleX,
  tooFast: Timer,
};

const LIST_TONE: Record<ScanTargetTone, { icon: LucideIcon; className: string; camera: CameraTone | null }> = {
  success: { icon: CircleCheck, className: "text-success-fg", camera: "success" },
  warning: { icon: TriangleAlert, className: "text-warning-fg", camera: "warning" },
  danger: { icon: CircleX, className: "text-danger-fg", camera: "error" },
  neutral: { icon: Info, className: "text-text-muted", camera: null },
};

const listTone = (item: ScanTargetListItem) => LIST_TONE[item.tone ?? "neutral"];

export const ScannerCamera = ({
  target,
  presentation = "overlay",
  onClose,
  lastScan,
  phoneSecondary = "primary",
  manual,
  suspended = false,
}: ScannerCameraProps) => {
  const { t } = useTranslation("ui");
  const isPhone = useIsPhone();
  const overlay = presentation === "overlay";
  const titleId = useId();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [sheet, setSheet] = useState<"manual" | "list" | "switcher" | null>(null);
  const session = useScannerCameraSession({
    videoRef,
    active: sheet === null,
    scanEnabled: !suspended,
    // Telefon ↔ keng ko'rinish almashsa `<video>` boshqa joyda qayta yaratiladi — skaner yangisiga ulanadi.
    layoutKey: isPhone,
    onScan: target.onScan,
  });

  useEffect(() => markScannerCameraMounted(), []);

  // `page` (universal skaner, telefonda to'liq ekran): fokus «Skanerni yopish» da, Esc yopadi (taxta §08).
  // Oyna (`overlay`) buni `useFocusTrap` bilan qiladi. Varaq ochiq bo'lsa Esc faqat varaqni yopadi (o'zi).
  const pageCloses = !overlay && isPhone && Boolean(onClose);
  useEffect(() => {
    if (pageCloses) closeRef.current?.focus();
  }, [pageCloses]);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!pageCloses || sheet !== null) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      onCloseRef.current?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [pageCloses, sheet]);

  const trapRef = useFocusTrap<HTMLDivElement>(overlay, {
    onEscape: onClose,
    initialFocus: closeRef,
    inert: true,
  });
  useScrollLock(overlay);

  const close = () => onClose?.();
  const finish = () => {
    target.finish?.onFinish();
    onClose?.();
  };

  const list = target.list ?? [];
  const latest = list[0];
  const progress = target.progress;
  const meterLabel = progress?.label ?? t("camera.meter.label");
  const resultTone = session.flash ? RESULT_TONE[session.flash] : null;
  const FlashIcon = session.flash ? RESULT_ICON[session.flash] : null;
  const platform = detectCameraPlatform();

  // Yon panelda (planshet 300 px) ikki tugma bir qatorga sig'sin — ixcham (`compact`) ichki chekka.
  const manualButton = (size: "md" | "lg", className?: string) => (
    <Button
      variant="secondary"
      size={size}
      compact={size === "md"}
      leftIcon={Keyboard}
      aria-haspopup="dialog"
      onClick={() => setSheet("manual")}
      className={className}
    >
      {t("camera.action.manual")}
    </Button>
  );

  const primaryButton = (size: "md" | "lg", className?: string) =>
    target.finish ? (
      <Button size={size} compact={size === "md"} leftIcon={Check} onClick={finish} className={className}>
        {target.finish.label}
      </Button>
    ) : (
      // «Tugatish» yo'q — yopish ikkinchi darajali (tepada «Skanerni yopish» ham bor, bitta asosiy amal).
      <Button variant="secondary" size={size} compact={size === "md"} leftIcon={X} onClick={close} className={className}>
        {t("camera.action.close")}
      </Button>
    );

  // Har qatorda 44 px (taxta §03 «Bekor qilish»: telefon ham, yon panel ham).
  const undoButton = (item: ScanTargetListItem) =>
    item.onUndo ? (
      <IconButton
        size="lg"
        variant="ghost"
        icon={Undo2}
        label={`${t("camera.last.undo")} — ${item.title}`}
        onClick={item.onUndo}
      />
    ) : null;

  /* ─── Sahna: karta (ruxsat / xato) yoki ramka + holat ─────────────────── */

  const statusChips: ReactNode[] = [];
  if (!session.online) {
    statusChips.push(
      <CameraChip key="offline" dot="warning" icon={WifiOff}>
        {t("camera.chip.offline")}
      </CameraChip>,
    );
  }

  let card: ReactNode = null;
  if (session.gate === "prompt") {
    card = (
      <CameraCard
        tone="neutral"
        icon={Camera}
        alert={false}
        title={t("camera.permission.title")}
        text={t("camera.permission.text")}
        actions={
          <>
            <Button size="lg" leftIcon={Camera} onClick={session.enable}>
              {t("camera.action.enable")}
            </Button>
            {manualButton("lg")}
          </>
        }
      />
    );
  } else if (session.denied) {
    card = (
      <CameraCard
        tone="error"
        icon={CameraOff}
        title={t("camera.denied.title")}
        text={platform === "telegram" ? t("camera.denied.telegramText") : t("camera.denied.text")}
        actions={
          <>
            <Button size="lg" leftIcon={RefreshCw} onClick={session.retry}>
              {t("camera.action.retry")}
            </Button>
            {manualButton("lg")}
          </>
        }
      >
        <CameraSteps
          steps={[
            t(`camera.denied.steps.${platform}.1`),
            t(`camera.denied.steps.${platform}.2`),
            t(`camera.denied.steps.${platform}.3`),
          ]}
        />
      </CameraCard>
    );
  } else if (session.failedKind) {
    const kind = session.failedKind === "unknown" ? "failed" : session.failedKind;
    card = (
      <CameraCard
        tone={kind === "busy" || kind === "unsupported" ? "warning" : "error"}
        icon={CameraOff}
        title={t(`camera.${kind}.title`)}
        text={t(`camera.${kind}.text`)}
        actions={
          <>
            {kind !== "unsupported" ? (
              <Button size="lg" leftIcon={RefreshCw} onClick={session.retry}>
                {t("camera.action.retry")}
              </Button>
            ) : null}
            {manualButton("lg")}
          </>
        }
      />
    );
  }

  const paused = sheet !== null;
  const waiting = session.gate === "checking";
  let stage: ReactNode;
  let headChip: ReactNode;
  if (card) {
    // Keng oynada kamera ustidagi chip (maket `courier-scan-permission-denied`: «Kamera o'chiq»).
    headChip = session.denied ? <CameraChip dot="error">{t("camera.chip.off")}</CameraChip> : null;
    stage = card;
  } else if (suspended) {
    headChip = <CameraChip dot="info">{t("camera.chip.switching")}</CameraChip>;
    stage = <ScanFinder paused mark={<Spinner size="lg" />} />;
  } else if (paused || waiting) {
    headChip = paused ? <CameraChip>{t("camera.chip.paused")}</CameraChip> : null;
    stage = <ScanFinder paused mark={waiting ? <Spinner size="lg" /> : undefined} />;
  } else if (session.starting) {
    headChip = <CameraChip dot="info">{t("camera.chip.starting")}</CameraChip>;
    stage = (
      <>
        <ScanFinder paused mark={<Spinner size="lg" />} />
        <CameraHint live>{t("camera.hint.starting")}</CameraHint>
      </>
    );
  } else {
    headChip = (
      <CameraChip dot="live">{session.flash === "success" ? t("camera.chip.found") : t("camera.chip.live")}</CameraChip>
    );
    stage = (
      <>
        <ScanFinder
          tone={resultTone}
          mark={FlashIcon ? <FlashIcon aria-hidden="true" focusable="false" size={24} strokeWidth={2.5} /> : null}
        />
        {!session.result ? <CameraHint>{target.hint ?? t("camera.hint.aim")}</CameraHint> : null}
      </>
    );
  }
  const torchChip = session.torchEnabled ? (
    <CameraChip key="torch" icon={Flashlight}>
      {t("camera.chip.torchOn")}
    </CameraChip>
  ) : null;

  const result = session.result;
  const toasts = (
    <CameraToasts>
      {result && !card ? (
        <CameraToast
          key={result.id}
          tone={RESULT_TONE[result.type]}
          icon={RESULT_ICON[result.type]}
          title={
            result.type === "tooFast"
              ? t("camera.result.tooFastTitle")
              : (result.message ?? t(`camera.result.${result.type}`))
          }
          text={result.type === "tooFast" ? t("camera.result.tooFastText") : undefined}
        />
      ) : null}
    </CameraToasts>
  );

  const torchAvailable = session.hasTorch && session.running;
  const torchButton = torchAvailable ? (
    <CameraButton
      icon={Flashlight}
      label={t("camera.torch")}
      aria-pressed={session.torchEnabled}
      onClick={() => void session.toggleTorch()}
    />
  ) : null;
  const torchInBottom = phoneSecondary === "torch";
  const phoneSecondaryButton = torchInBottom ? (
    torchAvailable ? (
      <Button
        variant="secondary"
        size="lg"
        leftIcon={Flashlight}
        aria-pressed={session.torchEnabled}
        onClick={() => void session.toggleTorch()}
      >
        {t("camera.torch")}
      </Button>
    ) : null
  ) : (
    primaryButton("lg")
  );

  const feed = (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      aria-hidden="true"
      onPlaying={() => session.setFeedLive(true)}
      // Kamera to'xtaganda (varaq ochildi, qayta urinish) oqim bo'shatiladi — keyingi ochilishda yana «ishga tushmoqda».
      onEmptied={() => session.setFeedLive(false)}
      className={cx("absolute inset-0 z-0 size-full object-cover", (!session.running || card) && "opacity-0")}
    />
  );

  const modes =
    target.modes && target.modes.length > 0 && target.onModeChange ? (
      <SegmentedControl
        ariaLabel={target.title}
        options={target.modes}
        value={target.mode ?? target.modes[0].value}
        onValueChange={(value) => target.onModeChange?.(value)}
        fullWidth
      />
    ) : null;

  const counter = progress ? <CameraCount done={progress.done} total={progress.total} label={meterLabel} /> : null;
  const stats = target.stats && target.stats.length > 0 ? <StatsLine stats={target.stats} /> : null;
  const switcher = target.switcher;
  const switcherLabel = switcher ? t("camera.switcher.open", { label: switcher.label }) : "";
  const progressBar =
    progress && progress.total !== undefined ? (
      <CameraProgress done={progress.done} total={progress.total} label={target.listTitle ?? t("camera.meter.progress")} />
    ) : null;

  // Pastki panel karta holatiga qarab (maketlar `courier-scan-permission-denied`, taxta 04.1 / 04.2 / 04.14):
  //   - ruxsat izohi va rad etilgan — panel yo'q (amallar kartaning o'zida, ikkinchi «Qo'lda kiritish» yo'q);
  //   - kamera band / ochilmadi / qo'llab-quvvatlanmaydi — faqat rejim va hisoblagich qatori;
  //   - qolgani — to'liq panel (oxirgi skan, [Qo'lda kiritish] [Tugatish | Chiroq]).
  const counterRow =
    counter || list.length > 0 ? (
      <div className="flex min-w-0 items-center gap-3">
        {counter ?? <span className="min-w-0 flex-1" />}
        {list.length > 0 ? (
          <Button variant="ghost" size="sm" leftIcon={List} aria-haspopup="dialog" onClick={() => setSheet("list")}>
            {t("camera.list.open")}
          </Button>
        ) : null}
      </div>
    ) : null;
  let lastRow: ReactNode = lastScan ?? null;
  if (target.list) {
    const LatestIcon = latest ? listTone(latest).icon : History;
    lastRow = latest ? (
      <CameraLastScan
        icon={<LatestIcon aria-hidden="true" size={18} />}
        tone={listTone(latest).camera}
        title={latest.title}
        subtitle={latest.subtitle}
        action={undoButton(latest)}
      />
    ) : (
      <CameraLastScan
        icon={<History aria-hidden="true" size={18} />}
        title={t("camera.last.emptyTitle")}
        subtitle={t("camera.last.emptyText")}
      />
    );
  }
  let phoneBottom: ReactNode;
  if (session.gate === "prompt" || session.denied) {
    phoneBottom = undefined;
  } else if (card) {
    phoneBottom =
      modes || counterRow || progressBar || stats ? (
        <CameraBottom>
          {modes}
          {counterRow}
          {progressBar}
          {stats}
        </CameraBottom>
      ) : undefined;
  } else {
    phoneBottom = (
      <CameraBottom>
        {modes}
        {counterRow}
        {progressBar}
        {stats}
        {lastRow}
        <div className="flex min-w-0 gap-2 [&>*]:min-w-0 [&>*]:flex-1">
          {manualButton("lg")}
          {phoneSecondaryButton}
        </div>
      </CameraBottom>
    );
  }

  /* ─── Telefon: to'liq ekran ─────────────────────────────────────────────── */

  const phoneSurface = (
    <CameraSurface
      label={card ? t("camera.surfaceLabel") : session.starting ? t("camera.chip.starting") : t("camera.surfaceLabel")}
      busy={session.starting || waiting}
      title={target.title}
      context={target.context}
      start={
        onClose ? <CameraButton ref={closeRef} icon={X} label={t("camera.close")} onClick={close} /> : undefined
      }
      tools={torchInBottom ? null : torchButton}
      feed={feed}
      headingExtra={
        switcher ? (
          // 44 px bosish maydoni, ichida 32 px chip (`.el-cam-chip`) — kontekstni almashtirish.
          <Pressable
            aria-label={switcherLabel}
            aria-haspopup="dialog"
            onClick={() => setSheet("switcher")}
            className="-my-1.5 inline-flex min-h-11 max-w-full items-center rounded-full"
          >
            <span className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-text/20 bg-bg/60 pr-2.5 pl-3 text-[13px] font-semibold backdrop-blur-md">
              <span className="truncate">{switcher.label}</span>
              <ChevronDown aria-hidden="true" size={16} strokeWidth={2} className="shrink-0" />
            </span>
          </Pressable>
        ) : null
      }
      bottom={phoneBottom}
    >
      <CameraStatus>
        {/* Telefonda karta butun sahnani egallaydi — «Kamera o'chiq» chipi faqat keng oynada. */}
        {card ? null : headChip}
        {torchChip}
        {statusChips}
      </CameraStatus>
      {stage}
      {toasts}
    </CameraSurface>
  );

  /* ─── Planshet / desktop: kamera bloki (chapda chip, o'ngda asboblar) ─────── */

  const wideSurface = (
    <CameraSurface
      fit="contained"
      heading={false}
      label={t("camera.surfaceLabel")}
      busy={session.starting || waiting}
      title={target.title}
      context={target.context}
      start={
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {headChip}
          {torchChip}
          {statusChips}
        </div>
      }
      tools={torchButton}
      feed={feed}
      className={presentation === "page" ? "rounded-[20px]" : undefined}
    >
      {stage}
      {toasts}
    </CameraSurface>
  );

  const SideIcon = target.icon ?? ScanLine;
  const side = (
    <aside aria-labelledby={titleId} className="flex w-[360px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-raised p-5 text-text max-lg:w-[300px]">
      <div className="flex shrink-0 items-start gap-3">
        <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text">
          <SideIcon size={20} strokeWidth={2} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={titleId} className="text-base font-bold [overflow-wrap:anywhere]">
            {target.title}
          </h2>
          {target.context ? <p className="text-[13px] text-text-muted [overflow-wrap:anywhere]">{target.context}</p> : null}
          {switcher ? (
            <Button
              variant="secondary"
              size="sm"
              rightIcon={ChevronDown}
              aria-label={switcherLabel}
              aria-haspopup="dialog"
              onClick={() => setSheet("switcher")}
              className="mt-1 max-w-full self-start"
            >
              <span className="truncate">{switcher.label}</span>
            </Button>
          ) : null}
        </div>
        {onClose ? (
          <IconButton ref={closeRef} size="sm" variant="ghost" icon={X} label={t("camera.close")} onClick={close} className="-mt-1 -mr-2" />
        ) : null}
      </div>
      {modes}
      {progress ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-baseline gap-1.5">
            <span className="text-[28px] leading-8 font-bold">{progress.done}</span>
            {progress.total !== undefined ? <span className="font-semibold text-text-muted">/ {progress.total}</span> : null}
            <span className="ml-1 text-[13px] text-text-muted">{meterLabel}</span>
          </p>
          {progress.total !== undefined ? (
            <div
              role="progressbar"
              aria-label={target.listTitle ?? t("camera.meter.progress")}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={Math.min(progress.done, progress.total)}
              className="h-2 w-full overflow-hidden rounded-full bg-sunken"
            >
              <span
                className="block h-full rounded-full bg-action"
                style={{ width: `${progress.total > 0 ? Math.min(100, (progress.done / progress.total) * 100) : 0}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {stats}
      {target.note ? (
        <div role="note" className="flex items-start gap-3 rounded-xl bg-info-soft p-3 text-text">
          <Info aria-hidden="true" size={20} strokeWidth={2} className="mt-px shrink-0 text-info-fg" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-semibold">{target.note.title}</span>
            {target.note.text ? <span className="text-[13px] text-text-muted">{target.note.text}</span> : null}
          </div>
        </div>
      ) : null}
      {target.list ? (
        <div className="flex min-h-0 flex-col">
          <span className="pb-1 text-xs font-semibold tracking-[0.04em] text-text-muted uppercase">
            {target.listTitle ?? t("camera.list.title")}
          </span>
          {list.length > 0 ? (
            <ul className="divide-y divide-border border-t border-border">
              {list.map((item) => {
                const tone = listTone(item);
                const Icon = tone.icon;
                return (
                  <li key={item.key} className="flex min-h-13 min-w-0 items-center gap-3 py-2">
                    <Icon aria-hidden="true" size={18} strokeWidth={2} className={cx("shrink-0", tone.className)} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">{item.title}</span>
                      {item.subtitle ? <span className="truncate text-[13px] text-text-muted">{item.subtitle}</span> : null}
                    </span>
                    {undoButton(item)}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="border-t border-border pt-3 text-[13px] text-text-muted">{t("camera.last.emptyText")}</p>
          )}
        </div>
      ) : null}
      <div aria-hidden="true" className="flex-1" />
      <Badge tone="success" dot className="self-start">
        {t("camera.chip.usbReady")}
      </Badge>
      {/* Sig'masa (tor planshet paneli, uzun tarjima) tugmalar matnni kesmasdan ikki qatorga o'tadi. */}
      <div className="flex shrink-0 flex-wrap gap-2 [&>*]:flex-auto">
        {manualButton("md")}
        {primaryButton("md")}
      </div>
    </aside>
  );

  /* ─── Varaqlar: qo'lda kiritish, ro'yxat ─────────────────────────────────── */

  const sheets = (
    <>
      {switcher ? (
        <SwitcherDialog
          open={sheet === "switcher"}
          dark={isPhone}
          switcher={switcher}
          onClose={() => setSheet(null)}
          onSelect={(value) => {
            setSheet(null);
            if (value !== switcher.value) switcher.onSelect(value);
          }}
        />
      ) : null}
      <ManualEntryDialog
        open={sheet === "manual"}
        dark={isPhone}
        text={manual}
        onClose={() => setSheet(null)}
        onSubmit={(code) => {
          setSheet(null);
          if (suspended) return;
          void Promise.resolve()
            .then(() => target.onScan(code, "manual"))
            .catch(() => undefined);
        }}
      />
      <Dialog
        open={sheet === "list"}
        onClose={() => setSheet(null)}
        size="lg"
        className={isPhone ? "dark" : undefined}
        title={target.listTitle ?? t("camera.list.title")}
        description={
          progress ? `${progress.done}${progress.total !== undefined ? ` / ${progress.total}` : ""} · ${target.title}` : target.title
        }
        footerDivider="auto"
        footer={
          <>
            <Button variant="secondary" size="lg" leftIcon={ScanLine} onClick={() => setSheet(null)}>
              {t("camera.list.continue")}
            </Button>
            {primaryButton("lg")}
          </>
        }
      >
        {list.length === 0 ? (
          <p className="text-sm text-text-muted">{t("camera.list.emptyText")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((item) => {
              const tone = listTone(item);
              const Icon = tone.icon;
              return (
                <li key={item.key} className="flex min-w-0 items-center gap-3 py-3">
                  <Icon aria-hidden="true" size={20} strokeWidth={2} className={cx("shrink-0", tone.className)} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm leading-5 font-semibold text-text">{item.title}</span>
                    {item.subtitle ? <span className="truncate text-[13px] leading-[18px] text-text-muted">{item.subtitle}</span> : null}
                  </span>
                  {undoButton(item)}
                </li>
              );
            })}
          </ul>
        )}
      </Dialog>
    </>
  );

  if (!overlay) {
    return (
      <>
        {isPhone ? phoneSurface : wideSurface}
        {sheets}
      </>
    );
  }

  return (
    <Portal layer="overlay">
      <div data-scanner-camera="" className="fixed inset-0 flex items-center justify-center p-6 max-md:p-0">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-overlay" />
        <div
          ref={trapRef}
          role="dialog"
          aria-modal="true"
          aria-label={isPhone ? target.title : undefined}
          aria-labelledby={isPhone ? undefined : titleId}
          tabIndex={-1}
          className={cx(
            "relative outline-none",
            isPhone
              ? "size-full"
              : "flex h-[min(680px,100%)] w-[min(1080px,100%)] overflow-hidden rounded-[20px] border border-border bg-raised shadow-xl",
          )}
        >
          {isPhone ? (
            phoneSurface
          ) : (
            <>
              <div className="relative min-w-0 flex-1">{wideSurface}</div>
              {side}
            </>
          )}
        </div>
      </div>
      {sheets}
    </Portal>
  );
};

const STAT_TONE: Record<ScanTargetTone, string> = {
  success: "text-success-fg",
  warning: "text-warning-fg",
  danger: "text-danger-fg",
  neutral: "",
};

/** «Qabul qilindi 3 · Qoldi 3 · Topilmadi 1» — hisoblagich kengaytmasi (rang faqat qiymatda, matn bilan birga). */
const StatsLine = ({ stats }: { stats: ReadonlyArray<ScanTargetStat> }) => (
  <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[13px] leading-[18px]">
    {stats.map((stat, index) => (
      <span key={stat.key} className="inline-flex items-baseline gap-1 whitespace-nowrap">
        {index > 0 ? (
          <span aria-hidden="true" className="opacity-60">
            ·
          </span>
        ) : null}
        <span className="opacity-80">{stat.label}</span>
        <span className={cx("text-sm font-bold", STAT_TONE[stat.tone ?? "neutral"])}>{stat.value}</span>
      </span>
    ))}
  </p>
);

type SwitcherOptionsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; options: ReadonlyArray<ScanTargetSwitcherOption> };

/**
 * Kontekstni almashtirish varag'i (ega, «F»): qidiruvli ro'yxat, joriy qiymat belgilangan. Kamera yopilmaydi.
 * Maket yo'q — eng yaqini `courier-courier-bulk-scanner-camera-list` (kamera ichidagi varaq).
 */
const SwitcherDialog = ({
  open,
  dark,
  switcher,
  onClose,
  onSelect,
}: {
  open: boolean;
  dark: boolean;
  switcher: ScanTargetSwitcher;
  onClose: () => void;
  onSelect: (value: string) => void;
}) => {
  const { t } = useTranslation("ui");
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState<SwitcherOptionsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const source = switcher.options;
  const isLoader = typeof source === "function";
  // Yuklovchi reyestrda har ma'lumot o'zgarishida yangi funksiya bo'ladi — qayta yuklash faqat ochilganda yoki
  // «Qayta urinish» da (eng oxirgisi ref orqali).
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  });

  useEffect(() => {
    const load = sourceRef.current;
    if (!open || typeof load !== "function") return undefined;
    let cancelled = false;
    load().then(
      (options) => {
        if (!cancelled) setLoaded({ status: "ready", options });
      },
      () => {
        if (!cancelled) setLoaded({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, attempt, isLoader]);

  const state: SwitcherOptionsState = isLoader ? loaded : { status: "ready", options: source };
  const needle = query.trim().toLocaleLowerCase();
  const visible =
    state.status === "ready"
      ? state.options.filter(
          (option) =>
            !needle ||
            option.label.toLocaleLowerCase().includes(needle) ||
            (option.meta ?? "").toLocaleLowerCase().includes(needle),
        )
      : [];

  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} size="lg" className={dark ? "dark" : undefined} title={switcher.title}>
      <TextInput
        mode="search"
        value={query}
        onValueChange={setQuery}
        aria-label={t("camera.switcher.search")}
        placeholder={t("camera.switcher.search")}
      />
      {state.status === "loading" ? (
        <p role="status" className="flex items-center gap-2 py-3 text-sm text-text-muted">
          <Spinner />
          {t("camera.switcher.loading")}
        </p>
      ) : state.status === "error" ? (
        <div role="alert" className="flex flex-col items-start gap-2 py-2">
          <p className="text-sm text-text">{t("camera.switcher.error")}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setLoaded({ status: "loading" });
              setAttempt((value) => value + 1);
            }}
          >
            {t("camera.switcher.retry")}
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-3 text-sm text-text-muted">{t("camera.switcher.empty")}</p>
      ) : (
        <ul className="-mx-1 flex flex-col">
          {visible.map((option) => {
            const current = option.value === switcher.value;
            return (
              <li key={option.value}>
                <Pressable
                  aria-current={current ? "true" : undefined}
                  onClick={() => {
                    setQuery("");
                    onSelect(option.value);
                  }}
                  className={cx(
                    "flex min-h-12 w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors duration-150 hover:bg-sunken motion-reduce:transition-none",
                    current && "bg-action-soft",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-text">{option.label}</span>
                    {option.meta ? <span className="truncate text-[13px] text-text-muted">{option.meta}</span> : null}
                  </span>
                  {current ? (
                    <Check role="img" aria-label={t("camera.switcher.current")} size={18} strokeWidth={2} className="shrink-0 text-action-fg" />
                  ) : null}
                </Pressable>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
};

/** «Kodni qo'lda kiriting» (taxta 04.15): kamera to'xtaydi, natija skandagidek (`source: "manual"`). */
const ManualEntryDialog = ({
  open,
  dark,
  text,
  onClose,
  onSubmit,
}: {
  open: boolean;
  dark: boolean;
  text?: ScannerCameraManualText;
  onClose: () => void;
  onSubmit: (code: string) => void;
}) => {
  const { t } = useTranslation("ui");
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const reset = () => {
    setValue("");
    setError(false);
  };

  const cancel = () => {
    reset();
    onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = value.trim();
    if (!code) {
      setError(true);
      return;
    }
    reset();
    onSubmit(code);
  };

  return (
    <Dialog
      open={open}
      onClose={cancel}
      size="sm"
      className={dark ? "dark" : undefined}
      title={t("camera.manual.title")}
      onSubmit={submit}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={cancel}>
            {t("camera.manual.cancel")}
          </Button>
          <Button type="submit" size="lg">
            {text?.submitLabel ?? t("camera.manual.submit")}
          </Button>
        </>
      }
    >
      {/* `data-scanner-ignore` — odam tez yozib Enter bossa USB skaner deb olinmasin (forma o'zi yuboradi). */}
      <Field
        data-scanner-ignore=""
        label={text?.label ?? t("camera.manual.label")}
        hint={text?.hint ?? t("camera.manual.hint")}
        error={error ? t("camera.manual.required") : undefined}
      >
        <TextInput
          size="lg"
          value={value}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          onValueChange={(next) => {
            setValue(next);
            if (error && next.trim()) setError(false);
          }}
        />
      </Field>
    </Dialog>
  );
};

export default ScannerCamera;
