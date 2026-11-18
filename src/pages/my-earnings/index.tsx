// dizayn-v2: market_operator-earnings, market_operator-earnings-no-commission
import { Info, TriangleAlert } from "lucide-react";
import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { COMMISSION_SAMPLE_PRICE, formatCommissionValue } from "../../entities/market-operator";
import { useUser } from "../../entities/user/api/userApi";
import {
  CURRENCY_LABEL,
  formatMoneyLocalized,
  formatNumberLocalized,
  resolveMoneyLanguage,
} from "../../shared/lib/formatMoney";
import { Badge, Card, ErrorState, PageHeader, QueryBoundary, SkeletonLines } from "../../shared/ui/primitives";
import { readOperatorProfile, readOperatorRate, sampleEarning, type OperatorRate } from "./lib/operatorRate";
import { EarningsSummary } from "./ui/EarningsSummary";
import { MyPaymentsCard } from "./ui/MyPaymentsCard";

/** Maketda «Stavkam» — qatorning 1/3 qismi (`flex: 1 1 300px`), yonida «To'lovlar» (`flex: 2 1 460px`). */
const RATE_CARD = "w-full";
/** `.el-alert.el-tone-warning` (CODE-MAP) — sahifa kengligida, «Hisob» ustida (maket `-earnings-no-commission`). */
const ALERT = "flex w-full items-start gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-fg";
/** `.el-kpi-value` · `.el-kpi-unit` (CODE-MAP). */
const VALUE =
  "whitespace-nowrap text-[28px] leading-9 font-bold tracking-[-.01em] text-text proportional-nums max-md:text-[22px] max-md:leading-[30px]";
const UNIT = "ml-1 text-sm font-semibold tracking-normal text-text-muted max-md:text-[13px]";

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border py-2.5">
    <dt className="text-[13px] text-text-muted">{label}</dt>
    <dd className="m-0 text-right text-[13px] font-semibold text-text">{children}</dd>
  </div>
);

const Note = ({ children }: { children: ReactNode }) => (
  <p className="m-0 flex items-start gap-2 text-[13px] text-text-muted">
    <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
    <span>{children}</span>
  </p>
);

const RateCard = ({ rate }: { rate: OperatorRate | null }) => {
  const { t, i18n } = useTranslation("myEarnings");
  const language = i18n.language;
  const valueText = rate ? formatNumberLocalized(rate.value, { language, fractionDigits: 2 }) : "";
  const unit = rate?.type === "fixed" ? CURRENCY_LABEL[resolveMoneyLanguage(language)] : "%";

  return (
    <Card title={t("rate.title")} divided className={RATE_CARD} bodyClassName="flex flex-col gap-4">
      {rate ? (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={VALUE} data-testid="operator-rate-value">
            {valueText}
            <span className={UNIT}>{unit}</span>
          </span>
          <span className="text-[13px] text-text-muted">
            {t(rate.type === "percent" ? "rate.percentHint" : "rate.fixedHint")}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="warning" dot>
            {t("rate.notSet")}
          </Badge>
        </div>
      )}
      <dl className="m-0 flex flex-col border-t border-border">
        <Row label={t("rate.type")}>
          {rate ? t(rate.type === "percent" ? "rate.typePercent" : "rate.typeFixed") : "—"}
        </Row>
        <Row label={t("rate.setBy")}>{t("rate.marketOwner")}</Row>
        {rate ? (
          <Row label={t("rate.sample")}>
            <span className="whitespace-nowrap">{formatMoneyLocalized(COMMISSION_SAMPLE_PRICE, { language })}</span>
            {" → "}
            <span className="whitespace-nowrap">
              {rate.type === "percent"
                ? formatMoneyLocalized(sampleEarning(rate), { language })
                : formatCommissionValue("fixed", rate.value, language)}
            </span>
          </Row>
        ) : null}
      </dl>
      <Note>{t(rate ? "rate.note" : "rate.unsetNote")}</Note>
    </Card>
  );
};

/**
 * «DAROMADIM» — market operatorining komissiya hisobi (`/my-earnings`, MO-2; maketlar `market_operator-earnings`,
 * `market_operator-earnings-no-commission`).
 *
 * Tartib (maket): ogohlantirish (stavka yo'q) → «Hisob» (Qoldiq · Daromad · To'langan — `GET finance/operators/me/
 * balance`, F2qp6FtE / 37vonCdg) → «Stavkam» (`GET auth/my-profile`) | «To'lovlar» (`GET finance/operators/me/payments`,
 * faqat o'qish — market o'zi yozadi, Elchi kassasiga ta'sir qilmaydi). «Belgilaydi» — umumiy «Market egasi» (profil
 * market nomini bermaydi — N13). «Daromadlar» jadvali (`/me/earnings` ro'yxati) — 37vonCdg qolgan qismi, bu yerda
 * chizilmagan.
 * Holatlar: har blok o'z yuklanishi va xatosi bilan (`ErrorState` + «Qayta urinish», xom backend matnisiz).
 */
const MyEarningsPage = () => {
  const { t } = useTranslation("myEarnings");
  const { useGetMyProfile } = useUser();
  const profileQuery = useGetMyProfile({ silentError: true });
  const profile = profileQuery.data ? readOperatorProfile(profileQuery.data) : null;
  const unset = profile !== null && readOperatorRate(profile) === null;
  // Javob bo'sh yoki shakli buzilgan (profil yo'q) — «Komissiya belgilanmagan» deb chalg'itmaymiz, xato ko'rsatamiz.
  const malformed = (
    <Card title={t("rate.title")} divided className={RATE_CARD}>
      <ErrorState size="card" onRetry={() => void profileQuery.refetch()} retrying={profileQuery.isFetching} />
    </Card>
  );

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {unset ? (
        <div role="status" className={ALERT}>
          <TriangleAlert size={20} aria-hidden="true" className="mt-px shrink-0" />
          <div className="flex min-w-0 flex-col gap-0.5 text-text">
            <p className="m-0 font-bold">{t("unset.title")}</p>
            <p className="m-0 text-[13px]">{t("unset.text")}</p>
          </div>
        </div>
      ) : null}
      <EarningsSummary />
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_300px]">
          <QueryBoundary
            query={profileQuery}
            isEmpty={() => false}
            empty={malformed}
            className="flex w-full min-w-0 flex-col"
            loading={
              <Card title={t("rate.title")} divided className={RATE_CARD}>
                <SkeletonLines lines={4} />
              </Card>
            }
            error={(error, retry) => (
              <Card title={t("rate.title")} divided className={RATE_CARD}>
                <ErrorState error={error} size="card" onRetry={retry} retrying={profileQuery.isFetching} />
              </Card>
            )}
          >
            {(response) => {
              const record = readOperatorProfile(response);
              if (!record) return malformed;
              return <RateCard rate={readOperatorRate(record)} />;
            }}
          </QueryBoundary>
        </div>
        <MyPaymentsCard className="min-w-0 flex-[2_1_460px]" />
      </div>
    </div>
  );
};

export default memo(MyEarningsPage);
