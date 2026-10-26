// dizayn-v2: superadmin-notifications-send-audience, superadmin-notifications-send-states
import { Eye, Filter, RotateCw, Save, TriangleAlert, Users, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NoticeAlert } from "../../notification";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Button, Spinner } from "../../../shared/ui/primitives";
import type { AudiencePreview } from "../api/campaignApi";
import { AUDIENCE_STAFF_ROLES } from "../model/audience";
import {
  CAMPAIGN_BATCH_SIZE,
  type AudiencePreviewErrorKind,
  type AudiencePreviewState,
} from "../model/previewState";

export type AudienceSummaryProps = {
  state: AudiencePreviewState;
  /** So'nggi natija (yuklanayotganda — oldingisi). */
  data: AudiencePreview | undefined;
  errorKind?: AudiencePreviewErrorKind;
  /**
   * «Filtrsiz — barcha mijozlarga yuborish» katakchasi ko'rinadimi (mijoz tanlangan, filtr yo'q). Belgilangan yoki
   * yo'qligidan qat'i nazar BIR joyda turadi — bosilganda fokus yo'qolmaydi.
   */
  showAllCustomers: boolean;
  /** «Filtrsiz — barcha mijozlarga yuborish». */
  allCustomers: boolean;
  onAllCustomersChange: (next: boolean) => void;
  onRetry: () => void;
  onSample: () => void;
  onSave: () => void;
  disabled?: boolean;
};

const BOX = "flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-sunken px-4 py-3";
const CHOICE =
  "flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-border-strong bg-surface " +
  "p-3 text-sm text-text has-[:checked]:border-action has-[:checked]:bg-action-soft has-[:disabled]:cursor-not-allowed";

/**
 * «Filtrsiz — barcha mijozlarga yuborish» (`confirm_all_customers`). Belgilangach ham ko'rinib turadi (son blokining
 * ostida, o'sha joyda) — aks holda tanlovni qaytarib bo'lmasdi.
 */
export const AllCustomersChoice = ({
  checked,
  disabled = false,
  onChange,
  className,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  className?: string;
}) => {
  const { t } = useTranslation("notifications");
  return (
    <label className={cx(CHOICE, className)}>
      <input
        type="checkbox"
        className="size-[18px] shrink-0 cursor-pointer accent-action disabled:cursor-not-allowed"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">{t("campaign.summary.allCustomers")}</span>
    </label>
  );
};

/**
 * «AUDITORIYA» BLOKI — «Kimga» kartasining pastida (maketlar `superadmin-notifications-send-audience`,
 * `-send-states` «Auditoriya hisobi»): son va kesim (Mijoz · Market · Xodim; faqat xodim bo'lsa — rollar bo'yicha),
 * «Push: N ta foydalanuvchi» (backend qurilma emas, foydalanuvchini sanaydi), «Namunani ko'rish» va «Segmentni
 * saqlash». Holatlar: filtr tanlang (+ «Filtrsiz»), hisoblanmoqda (tugmalar o'chiq), 0 ta, chegaradan oshdi (qizil),
 * katta auditoriya (navbat izohi + info), xato (+ «Qayta urinish»). SMS (KM-5) — rozilik bo'yicha son forma «Kanal»
 * kartasida (SMS tanlanganda).
 */
export const AudienceSummary = ({
  state,
  data,
  errorKind = "unavailable",
  showAllCustomers,
  allCustomers,
  onAllCustomersChange,
  onRetry,
  onSample,
  onSave,
  disabled = false,
}: AudienceSummaryProps) => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const needsFilter = state === "needsFilter";
  const loading = state === "loading";

  const renderContent = () => {
    if (state === "idle") return null;

    if (needsFilter) {
      return (
        <div className="flex min-w-0 items-start gap-3">
          <Filter aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-text-muted" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="text-base font-bold text-text">
              {t("campaign.summary.needsFilterTitle")}
            </span>
            <span className="text-[13px] text-text-muted">
              {t("campaign.summary.needsFilterText")}
            </span>
          </div>
        </div>
      );
    }

    if (state === "error") {
      const retryable = errorKind !== "badRequest";
      const offline = errorKind === "offline";
      return (
        <NoticeAlert
          tone="danger"
          role="note"
          icon={offline ? WifiOff : TriangleAlert}
          title={t(offline ? "campaign.summary.offlineTitle" : "campaign.summary.errorTitle")}
          action={
            retryable ? (
              <Button variant="secondary" size="sm" leftIcon={RotateCw} onClick={onRetry}>
                {t("campaign.summary.retry")}
              </Button>
            ) : undefined
          }
        >
          {t(
            offline
              ? "campaign.summary.offlineText"
              : retryable
                ? "campaign.summary.errorText"
                : "campaign.summary.errorBadRequest",
          )}
        </NoticeAlert>
      );
    }

    if (state === "overCap" && data) {
      return (
        <NoticeAlert
          tone="danger"
          role="note"
          title={t("campaign.summary.overCapTitle", {
            value: num(data.total),
            max: num(data.campaignMax ?? 0),
          })}
        >
          {t("campaign.summary.overCapText")}
        </NoticeAlert>
      );
    }

    const total = data?.total ?? 0;
    const byRole = data?.byRole ?? {};
    const staffCounts = AUDIENCE_STAFF_ROLES.map((role) => [role, byRole[role] ?? 0] as const).filter(
      ([, value]) => value > 0,
    );
    const staffTotal = Object.entries(byRole)
      .filter(([role]) => role !== "customer" && role !== "market")
      .reduce((sum, [, value]) => sum + value, 0);
    const customers = byRole.customer ?? 0;
    const markets = byRole.market ?? 0;
    const onlyStaff = customers === 0 && markets === 0 && staffTotal > 0;
    const breakdown = onlyStaff
      ? t("campaign.summary.staffOnly", {
          list: [...staffCounts]
            .sort((a, b) => b[1] - a[1])
            .map(([role, value]) =>
              t("campaign.summary.roleCount", {
                role: t(`campaign.role.${role}`),
                value: num(value),
              }),
            )
            .join(" · "),
        })
      : [
          customers ? t("campaign.summary.customer", { value: num(customers) }) : null,
          markets ? t("campaign.summary.market", { value: num(markets) }) : null,
          staffTotal ? t("campaign.summary.staff", { value: num(staffTotal) }) : null,
        ]
          .filter(Boolean)
          .join(" · ");
    const actionsDisabled = disabled || loading || state === "empty";

    return (
      <div className="flex min-w-0 flex-col gap-3">
        <div className={BOX}>
          {/* Matn ustuni qisqara oladi — keng ekranda tugmalar son yonida bir qatorda (maket), telefonda ostida. */}
          <div className="flex min-w-[200px] flex-[1_1_0] items-center gap-3 max-md:min-w-0 max-md:basis-[220px]">
            {loading ? (
              <Spinner size="md" className="shrink-0 text-text-muted" />
            ) : (
              <Users aria-hidden="true" size={20} className="shrink-0 text-text-muted" />
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={cx("text-base font-bold", loading ? "text-text-muted" : "text-text")}>
                {loading
                  ? t("campaign.summary.loading")
                  : t("campaign.summary.title", { value: num(total) })}
              </span>
              {loading ? (
                <span className="text-xs text-text-muted">{t("campaign.summary.loadingHint")}</span>
              ) : state === "empty" ? (
                <span className="text-[13px] text-text-muted">{t("campaign.summary.emptyHint")}</span>
              ) : (
                <>
                  {breakdown ? <span className="text-xs text-text-muted">{breakdown}</span> : null}
                  {state === "big" ? (
                    <span className="text-xs text-text-muted">
                      {t("campaign.summary.bigHint", { batch: num(CAMPAIGN_BATCH_SIZE) })}
                    </span>
                  ) : data?.push !== null && data?.push !== undefined ? (
                    <span className="text-xs text-text-muted">
                      {t("campaign.summary.push", { value: num(data.push) })}
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </div>
          {state === "empty" ? null : (
            <div className="ml-auto flex min-w-[min(100%,300px)] flex-[0_1_auto] flex-wrap gap-2 md:min-w-0">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={Eye}
                disabled={actionsDisabled}
                onClick={onSample}
                aria-haspopup="dialog"
                className="flex-auto"
              >
                {t("campaign.summary.sample")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={Save}
                disabled={actionsDisabled}
                onClick={onSave}
                aria-haspopup="dialog"
                className="flex-auto"
              >
                {t("campaign.summary.save")}
              </Button>
            </div>
          )}
        </div>
        {state === "big" ? (
          <NoticeAlert tone="info" role="note" title={t("campaign.summary.bigTitle")}>
            {t("campaign.summary.bigText", { batch: num(CAMPAIGN_BATCH_SIZE) })}
          </NoticeAlert>
        ) : null}
      </div>
    );
  };

  // Jonli hudud (`role="status"`) va «Filtrsiz» katakchasi DOIM bir xil joyda turadi: holat almashganda faqat
  // ichidagi matn o'zgaradi (o'qigich e'lon qiladi), katakcha esa qayta yaratilmaydi (fokus saqlanadi).
  return (
    <div
      className={cx(
        "flex min-w-0 flex-col",
        needsFilter && "rounded-xl bg-sunken px-4 py-3",
        // Ko'rinadigan narsa yo'q — oqimdan chiqadi (konstruktorda ortiqcha oraliq qolmasin), lekin jonli hudud
        // a11y daraxtida qoladi.
        state === "idle" && !showAllCustomers && "sr-only",
      )}
    >
      <div
        role="status"
        aria-live="polite"
        aria-busy={loading || undefined}
        className="min-w-0"
        data-testid="audience-summary"
        data-state={state}
      >
        {renderContent()}
      </div>
      {showAllCustomers ? (
        <AllCustomersChoice
          checked={allCustomers}
          disabled={disabled}
          onChange={onAllCustomersChange}
          className={cx(needsFilter ? "mt-2 ml-8" : state !== "idle" && "mt-3")}
        />
      ) : null}
    </div>
  );
};
