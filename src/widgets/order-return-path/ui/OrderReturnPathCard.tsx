// dizayn-v2: superadmin-orders-detail-cancelled, manager-orders-detail-cancelled, market-orders-detail-cancelled
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  CircleX,
  Clock,
  Inbox,
  PackageCheck,
  QrCode,
  Send,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useCancelHandoverMethodLabel, type CancelHandoverMethod } from "../../../entities/order";
import { formatTrackingDateTime } from "../../../features/order-tracking";
import { cx } from "../../../shared/lib/cx";
import { Badge, Button, buttonClasses, Card, Skeleton } from "../../../shared/ui/primitives";
import type { ReturnPath, ReturnPathStep, ReturnPathStepKind } from "../model/returnPath";

const STEP_ICON: Record<ReturnPathStepKind, LucideIcon> = {
  cancelled: CircleX,
  sent: Send,
  received: Inbox,
  handed: PackageCheck,
};

/** Usul belgisi ikonkasi — `tizim-states-data` §09 «Topshirish usuli». */
const METHOD_ICON: Partial<Record<CancelHandoverMethod, LucideIcon>> = {
  qr: QrCode,
  manual: TriangleAlert,
  no_qr: ShieldCheck,
};

type OrderReturnPathCardProps = {
  path: ReturnPath;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Market roli: «Posilka hozir: … — olib ketishingiz mumkin», «Olib ketishingiz kutilmoqda» va «QR kodni ochish». */
  marketView?: boolean;
  /** Market QR oynasi turgan sahifa (`/new-orders/cancelled/:marketId`). */
  qrHref?: string | null;
  className?: string;
};

/** Doira (`.el-stat-icon` 32, `rounded-full`) va pastga chiziq (kutilayotgan qadam oldidan — uzuq). */
const Rail = ({
  icon: Icon,
  label,
  last,
  dashedNext,
  pending,
}: {
  icon: LucideIcon;
  label: string;
  last: boolean;
  dashedNext: boolean;
  pending?: boolean;
}) => (
  <div className="flex w-8 flex-none flex-col items-center">
    <span
      role="img"
      aria-label={label}
      className={cx(
        "inline-flex size-8 items-center justify-center rounded-full",
        pending
          ? "bg-surface text-text-subtle ring-2 ring-inset ring-border-strong"
          : "bg-sunken text-text-muted",
      )}
    >
      <Icon size={16} aria-hidden="true" />
    </span>
    {last ? null : dashedNext ? (
      <span
        aria-hidden="true"
        className="my-1 w-0 flex-1 border-l-2 border-dashed border-border-strong"
      />
    ) : (
      <span aria-hidden="true" className="my-1 w-0.5 flex-1 rounded-full bg-border" />
    )}
  </div>
);

/** «Kuryer **Akmal Rahimov**» — rol va qalin ism. */
const Actor = ({ role, name }: { role: string | null; name: string | null }) => {
  const { t } = useTranslation("orders");
  if (!name && !role) return null;
  const roleLabel = role ? t(`tracking.roleValue.${role}`, { defaultValue: "" }) : "";
  return (
    <>
      {roleLabel ? `${roleLabel} ` : null}
      {name ? <span className="font-semibold text-text">{name}</span> : null}
    </>
  );
};

const join = (parts: ReactNode[]) =>
  parts
    .filter((part) => part !== null && part !== undefined && part !== false && part !== "")
    .flatMap((part, index) => (index === 0 ? [part] : [" · ", part]));

/**
 * «QAYTARISH YO'LI» kartasi (taklif §3.3): bekor qilingan posilka kuryerdan marketgacha — har qadamda kim,
 * qayerda, qachon va usul. Karta ichida karta yo'q: qadamlar oddiy ro'yxat (`ol`), tarixdagi vaqt chizig'i
 * shaklida. Ma'lumot — `useOrderReturnPath` (`GET orders/:id/tracking`).
 */
export const OrderReturnPathCard = ({
  path,
  isLoading = false,
  isError = false,
  onRetry,
  marketView = false,
  qrHref = null,
  className,
}: OrderReturnPathCardProps) => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const methodLabel = useCancelHandoverMethodLabel();
  const time = (value: string) => formatTrackingDateTime(value, { language });

  const subtitle = path.closed
    ? t("returnPath.subtitleClosed")
    : marketView && path.currentPlace
      ? t("returnPath.subtitleMarketReady", { place: path.currentPlace })
      : t("returnPath.subtitleOpen");

  const stepLines = (step: ReturnPathStep): ReactNode => {
    switch (step.kind) {
      case "cancelled":
        return (
          <>
            {step.actor || step.place ? (
              <p className="m-0 text-[13px] text-text-muted">
                {join([<Actor key="a" role={step.role} name={step.actor} />, step.place])}
              </p>
            ) : null}
            {step.reason ? (
              <p className="m-0 text-[13px] text-text-muted">
                {t("returnPath.reason", {
                  reason: t(`cancelReasons.${step.reason}`, { defaultValue: step.reason }),
                })}
              </p>
            ) : null}
          </>
        );
      case "sent":
        return (
          <>
            <p className="m-0 text-[13px] text-text-muted">
              {join([<Actor key="a" role={step.role} name={step.actor} />, step.place])}
              {step.to ? <> → {step.to}</> : null}
            </p>
            {step.postId ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge>{t("returnPath.post", { id: step.postId })}</Badge>
              </div>
            ) : null}
          </>
        );
      case "received":
        return (
          <p className="m-0 text-[13px] text-text-muted">
            {join([step.place, <Actor key="a" role={step.role} name={step.actor} />])}
          </p>
        );
      case "handed": {
        const MethodIcon = step.handover ? METHOD_ICON[step.handover.method] : undefined;
        const method = methodLabel(step.handover);
        return (
          <>
            <p className="m-0 text-[13px] text-text-muted">
              {join([step.place, <Actor key="a" role={step.role} name={step.actor} />])}
              {step.market ? <> → {step.market}</> : null}
            </p>
            {method ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge icon={MethodIcon} data-testid="return-path-method">
                  {method}
                </Badge>
              </div>
            ) : null}
          </>
        );
      }
      default:
        return null;
    }
  };

  const pending = path.pending;
  const pendingText = (() => {
    if (!pending) return null;
    const market = path.market;
    switch (pending.kind) {
      case "send":
        return t("returnPath.pendingText.send");
      case "receive":
        return pending.place
          ? t("returnPath.pendingText.receive", { place: pending.place })
          : t("returnPath.pendingText.receiveUnknown");
      case "handover":
        return marketView
          ? t("returnPath.pendingText.handoverSelf")
          : pending.atBranch
            ? t("returnPath.pendingText.handoverBranch", {
                market: market ?? t("tracking.entity.market"),
              })
            : t("returnPath.pendingText.handover", {
                market: market ?? t("tracking.entity.market"),
              });
      default:
        return null;
    }
  })();

  const showQr =
    marketView &&
    Boolean(qrHref) &&
    !path.closed &&
    (path.stage === "hq" || path.stage === "branch");

  return (
    <Card
      as="section"
      title={t("returnPath.title")}
      description={subtitle}
      padding="none"
      className={className}
      data-testid="order-return-path"
      data-stage={path.stage}
      footer={
        showQr && qrHref ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <p className="m-0 text-[13px] text-text-muted">{t("returnPath.qrHint")}</p>
            <Link
              to={qrHref}
              className={cx(buttonClasses({ variant: "secondary" }), "max-md:w-full")}
            >
              <QrCode size={18} aria-hidden="true" />
              {t("returnPath.qrOpen")}
            </Link>
          </div>
        ) : undefined
      }
    >
      <div className="px-5 py-4 max-md:px-4">
        {isLoading && path.steps.length === 0 ? (
          <div
            className="flex flex-col gap-4"
            aria-busy="true"
            aria-label={t("returnPath.loading")}
          >
            <Skeleton height={44} />
            <Skeleton height={44} />
          </div>
        ) : null}
        {isError && path.steps.length === 0 ? (
          <div
            className="mb-4 flex flex-wrap items-center gap-3 text-[13px] text-text-muted"
            role="status"
          >
            <span>{t("returnPath.error")}</span>
            {onRetry ? (
              <Button variant="link" size="sm" onClick={onRetry}>
                {t("retry", { ns: "common" })}
              </Button>
            ) : null}
          </div>
        ) : null}
        <ol className="m-0 flex list-none flex-col p-0">
          {path.steps.map((step, index) => {
            const isLast = index === path.steps.length - 1 && !pending;
            const title = t(`returnPath.step.${step.kind}`);
            return (
              <li
                key={step.id}
                className="flex gap-3"
                data-testid="return-path-step"
                data-kind={step.kind}
              >
                <Rail
                  icon={STEP_ICON[step.kind]}
                  label={title}
                  last={isLast}
                  dashedNext={!isLast && index === path.steps.length - 1}
                />
                <div
                  className={cx("flex min-w-0 flex-1 flex-col gap-1.5 pt-[5px]", !isLast && "pb-5")}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <p className="m-0 text-sm font-semibold text-text">{title}</p>
                    <time
                      dateTime={step.at}
                      className="whitespace-nowrap text-[13px] text-text-muted"
                    >
                      {time(step.at)}
                    </time>
                  </div>
                  {stepLines(step)}
                </div>
              </li>
            );
          })}
          {pending ? (
            <li
              className="flex gap-3"
              aria-current="step"
              data-testid="return-path-pending"
              data-kind={pending.kind}
            >
              <Rail
                icon={Clock}
                label={t(`returnPath.pending.${pending.kind}`)}
                last
                dashedNext={false}
                pending
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-[5px]">
                <p className="m-0 text-sm font-semibold text-text-muted">
                  {t(`returnPath.pending.${pending.kind}`)}
                </p>
                <p className="m-0 text-[13px] text-text-muted">
                  {join([
                    pendingText,
                    pending.kind === "handover" ? pending.place : null,
                    pending.days !== null ? (
                      <span key="d" className="whitespace-nowrap">
                        {t("cancelReturn.days", { ns: "status", count: pending.days })}
                      </span>
                    ) : null,
                  ])}
                </p>
              </div>
            </li>
          ) : null}
        </ol>
      </div>
    </Card>
  );
};
