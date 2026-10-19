// dizayn-v2: superadmin-scan-camera, courier-scan-camera, courier-scan-invalid, courier-scan-not-found, courier-scan-manual-entry
import { useId, useState, type FormEvent } from "react";
import { Ban, ChevronRight, Hand, History, ScanQrCode, SearchX, Store, Sun, TriangleAlert, Usb } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { canHandoverCancelledToMarket } from "../../../app/lib/access";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { Badge, Button, Card, EmptyState, Field, TextInput, buttonClasses } from "../../../shared/ui/primitives";
import type { ScanHistoryEntry } from "../model/scanHistory";
import { SCAN_HISTORY_ICON, scanHistorySub, scanHistoryTitle } from "../model/scanHistoryText";
import { notFoundTextKey, type ScanOutcome } from "../model/useUniversalScan";
import { ScanAlert } from "./ScanAlert";

/** Bekor qilinganlarni marketga topshirish ro'yxati — market QR'i shu yerda skanerlanadi. */
const CANCELLED_HANDOVER_ROUTE = "/new-orders/cancelled";

export const scanDetailRoute = (token: string) => `/scan/${encodeURIComponent(token)}`;

/** Plitka ikonkasi (`.el-stat-icon`): 36/40 px, `bg-sunken`. */
const TileIcon = ({ icon: Icon, small = false }: { icon: typeof Usb; small?: boolean }) => (
  <span
    aria-hidden="true"
    className={
      small
        ? "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text"
        : "inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text"
    }
  >
    <Icon size={small ? 18 : 20} strokeWidth={2} />
  </span>
);

/**
 * «Natija» kartasi (maket `courier-scan-invalid`, `courier-scan-not-found`): ochilmagan oxirgi skan — sabab
 * (ton + ikonka + matn) va o'qilgan matn. Market QR'ida — Bekor qilinganlar sahifasiga havola (ruxsat bo'lsa).
 */
export const ScanOutcomeCard = ({ outcome }: { outcome: ScanOutcome }) => {
  const { t, i18n } = useTranslation("scan");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const canHandover = useSelector(canHandoverCancelledToMarket);

  let title: string;
  let text: string;
  let icon = Ban;
  let codeLabel = t("scanner.scannedCode");
  if (outcome.kind === "invalid") {
    title = t("scanner.invalid.title");
    text = t("scanner.invalid.text");
    codeLabel = t("scanner.readText");
  } else if (outcome.kind === "market-qr") {
    title = t("scanner.marketQr.title");
    text = t("scanner.marketQr.text");
    icon = Store;
  } else if (outcome.kind === "not-found") {
    const key = notFoundTextKey(outcome.resource);
    title = t(`${key}.notFoundTitle`);
    text = t(`${key}.notFoundText`);
    icon = SearchX;
  } else {
    title = t("scanner.error.title");
    text = outcome.message ?? t("scanner.error.text");
    icon = TriangleAlert;
  }

  return (
    <Card
      padding="lg"
      title={t("scanner.resultTitle")}
      actions={<span className="text-xs text-text-muted">{formatDateTimeLocalized(outcome.at, { language })}</span>}
      bodyClassName="flex flex-col gap-3"
    >
      <ScanAlert tone={outcome.kind === "market-qr" ? "warning" : "danger"} icon={icon} title={title} role="alert">
        {text}
      </ScanAlert>
      <div className="flex flex-col gap-0.5 rounded-xl bg-sunken px-3 py-2.5">
        <span className="text-xs text-text-muted">{codeLabel}</span>
        <span className="text-sm font-semibold [overflow-wrap:anywhere] text-text">{outcome.raw}</span>
      </div>
      {outcome.kind === "market-qr" && canHandover ? (
        <Link to={CANCELLED_HANDOVER_ROUTE} className={buttonClasses({ variant: "secondary", fullWidth: true })}>
          <Store size={18} aria-hidden="true" className="shrink-0" />
          {t("scanner.marketQr.open")}
        </Link>
      ) : null}
    </Card>
  );
};

/**
 * «USB skaner ham tayyor · Tinglanmoqda» + «Kodni qo'lda kiriting [Ochish]» + maslahatlar (planshetda
 * yashirin) — maket `superadmin-scan-camera` yon paneli. Kod yoki `/scan/<token>` havolasi qabul qilinadi
 * (buyurtma raqami bo'yicha qidiruv API'si yo'q — route-map izohi).
 */
export const ScanUsbCard = ({ onSubmit, showTips }: { onSubmit: (code: string) => void; showTips: boolean }) => {
  const { t } = useTranslation("scan");
  const titleId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = value.trim();
    if (!code) {
      setError(true);
      return;
    }
    setError(false);
    setValue("");
    onSubmit(code);
  };

  return (
    <Card padding="lg" aria-labelledby={titleId} bodyClassName="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <TileIcon icon={Usb} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={titleId} className="text-base font-bold text-text">
              {t("scanner.usbTitle")}
            </h2>
            <Badge tone="success" dot>
              {t("scanner.usbBadge")}
            </Badge>
          </div>
          <p className="text-[13px] text-text-muted">{t("scanner.usbText")}</p>
        </div>
      </div>
      <div aria-hidden="true" className="h-px bg-border" />
      <form noValidate onSubmit={submit} aria-label={t("scanner.manualLabel")}>
        <Field
          label={t("scanner.manualLabel")}
          hint={t("scanner.manualHint")}
          error={error ? t("scanner.manualRequired") : undefined}
        >
          <div className="flex gap-2">
            <TextInput
              value={value}
              onValueChange={(next) => {
                setValue(next);
                if (error && next.trim()) setError(false);
              }}
              placeholder={t("scanner.manualPlaceholder")}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="secondary">
              {t("scanner.manualSubmit")}
            </Button>
          </div>
        </Field>
      </form>
      {showTips ? (
        <ul className="flex flex-col gap-2">
          {[
            { icon: Sun, text: t("scanner.tips.light") },
            { icon: ScanQrCode, text: t("scanner.tips.center") },
            { icon: Hand, text: t("scanner.tips.hold") },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2 text-[13px] text-text-muted">
              <Icon size={16} aria-hidden="true" className="shrink-0 text-text-subtle" />
              {text}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
};

/** «Oxirgi skanerlar · Shu qurilmada» — bosilsa `/scan/:token`. Planshetda 2 ta, desktopda 4 tagacha. */
export const ScanRecentCard = ({ entries, limit }: { entries: ScanHistoryEntry[]; limit: number }) => {
  const { t, i18n } = useTranslation("scan");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const shown = entries.slice(0, limit);

  return (
    <Card
      padding="none"
      title={t("scanner.recentTitle")}
      actions={<span className="text-xs text-text-muted">{t("scanner.recentScope")}</span>}
      className="overflow-hidden"
    >
      {shown.length === 0 ? (
        <EmptyState icon={History} title={t("scanner.recentEmptyTitle")} description={t("scanner.recentEmptyText")} />
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {shown.map((entry) => {
            const Icon = SCAN_HISTORY_ICON[entry.kind];
            const sub = scanHistorySub(t, entry, language);
            return (
              <li key={entry.token}>
                <Link
                  to={scanDetailRoute(entry.token)}
                  className="flex min-h-16 items-center gap-3 px-5 py-3 text-text transition-colors duration-150 hover:bg-sunken focus-visible:bg-sunken motion-reduce:transition-none"
                >
                  <TileIcon icon={Icon} small />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{scanHistoryTitle(t, entry, language)}</span>
                    {sub ? <span className="truncate text-[13px] text-text-muted">{sub}</span> : null}
                  </span>
                  <span className="text-xs whitespace-nowrap text-text-muted">
                    {formatDateTimeLocalized(entry.at, { language })}
                  </span>
                  <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-text-subtle" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
