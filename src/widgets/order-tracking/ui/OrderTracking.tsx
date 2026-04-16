import { CheckCircle2, Clock3, History, Sparkles, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Loader } from "../../../shared/ui/Loader";
import { TrackingEmptyState, TrackingTimeline, useOrderTracking } from "../../../features/order-tracking";
import { StatusBadge } from "../../../shared/ui/StatusBadge";

type OrderTrackingProps = {
  orderId: string | number;
  currentStatus?: string | null;
};

type JourneyStep = {
  key: string;
  labelKey: string;
  aliases?: string[];
};

const STATUS_LABEL_KEY_MAP: Record<string, string> = {
  created: "statusCreated",
  new: "statusNew",
  received: "statusReceived",
  waiting: "statusWaiting",
  on_the_road: "statusOnTheRoad",
  sold: "statusSold",
  cancelled: "statusCancelled",
  paid: "statusPaid",
  partly_paid: "statusPartlyPaid",
  closed: "statusClosed",
  rollback: "tracking.action.rollback",
};

const JOURNEY_STEPS: JourneyStep[] = [
  { key: "new", labelKey: "statusNew", aliases: ["created"] },
  { key: "received", labelKey: "statusReceived" },
  { key: "waiting", labelKey: "statusWaiting", aliases: ["on_the_road", "on the road"] },
  { key: "sold", labelKey: "statusSold" },
  { key: "paid", labelKey: "statusPaid", aliases: ["partly_paid"] },
  { key: "closed", labelKey: "statusClosed" },
];

const SPECIAL_STATUS_UI: Record<string, { title: string; desc: string; tone: string }> = {
  cancelled: {
    title: "Bekor qilingan holat",
    desc: "Buyurtma standart jarayondan chiqib ketgan. Tarixda bekor qilish sababini ko'rish mumkin.",
    tone: "border-red-400/30 bg-red-500/10 text-red-200",
  },
  rollback: {
    title: "Qaytarish jarayoni",
    desc: "Buyurtma oldingi bosqichga qaytgan. Keyingi harakatlar tarix orqali kuzatiladi.",
    tone: "border-orange-400/30 bg-orange-500/10 text-orange-100",
  },
};

const normalizeStatus = (status?: string | null) => status?.replaceAll(" ", "_").toLowerCase() ?? "";

const stepMatchesStatus = (step: JourneyStep, status?: string | null) => {
  const normalizedStatus = normalizeStatus(status);
  return [step.key, ...(step.aliases ?? [])].some((candidate) => normalizeStatus(candidate) === normalizedStatus);
};

const getJourneyIndex = (status?: string | null) =>
  JOURNEY_STEPS.findIndex((step) => stepMatchesStatus(step, status));

const getStatusLabel = (status?: string | null) => {
  const normalizedStatus = normalizeStatus(status);
  return STATUS_LABEL_KEY_MAP[normalizedStatus];
};

const humanizeStatus = (status?: string | null) => {
  if (!status) {
    return "—";
  }

  return status
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const OrderTracking = ({ orderId, currentStatus }: OrderTrackingProps) => {
  const { t } = useTranslation("orders");
  const { events, isLoading, isError, errorMessage, hasMore, loadMore } = useOrderTracking(orderId);
  const normalizedCurrentStatus = normalizeStatus(currentStatus);
  const journeyIndex = getJourneyIndex(normalizedCurrentStatus);
  const isSpecialStatus = normalizedCurrentStatus in SPECIAL_STATUS_UI;
  const specialStatusUi = SPECIAL_STATUS_UI[normalizedCurrentStatus];
  const nextStep = journeyIndex >= 0 ? JOURNEY_STEPS[journeyIndex + 1] : undefined;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-gray-200 bg-white/95 p-5 shadow-sm dark:border-white/10 dark:bg-white/4 sm:p-6 lg:p-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-r from-main/10 via-transparent to-cyan-400/10 dark:from-main/12 dark:via-transparent dark:to-cyan-300/8" />
      <div className="pointer-events-none absolute -right-16 top-10 h-36 w-36 rounded-full bg-main/10 blur-3xl dark:bg-main/12" />

      <div className="relative mx-auto mb-6 w-full max-w-5xl rounded-[28px] border border-white/10 bg-linear-to-br from-main/12 via-white/80 to-cyan-400/10 p-4 shadow-[0_20px_60px_rgba(91,76,255,0.12)] dark:from-main/14 dark:via-white/[0.04] dark:to-cyan-300/10 sm:p-5">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-main/20 bg-main/12 text-main shadow-lg shadow-main/10 dark:border-white/10 dark:bg-white/8 dark:text-white">
              <History size={20} />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-main/15 bg-main/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-main dark:border-white/10 dark:bg-white/7 dark:text-white/90">
                <Sparkles size={12} />
                Live Journey
              </div>
              <h2 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">{t("tracking.title")}</h2>
              <p className="text-sm text-gray-500 dark:text-white/80">
                #{orderId}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {normalizedCurrentStatus ? <StatusBadge status={normalizedCurrentStatus} size="md" /> : null}
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-main/15 bg-main/10 px-3 py-1.5 text-xs font-semibold text-main dark:border-white/10 dark:bg-white/7 dark:text-white">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {events.length}
            </div>
          </div>
        </div>

        {isSpecialStatus && specialStatusUi ? (
          <div className={`rounded-2xl border px-4 py-4 ${specialStatusUi.tone}`}>
            <p className="text-sm font-semibold">{specialStatusUi.title}</p>
            <p className="mt-1 text-sm opacity-90">{specialStatusUi.desc}</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-[24px] border border-white/10 bg-black/[0.04] p-4 dark:bg-white/[0.04]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-main dark:text-white/70">
                    Status Flow
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-white/75">
                    Hozirgi holat va keyingi kutilayotgan bosqichlar
                  </p>
                </div>
                <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 sm:inline-flex">
                  <Zap size={12} />
                  Active
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {JOURNEY_STEPS.map((step, index) => {
                  const isDone = journeyIndex > index;
                  const isCurrent = journeyIndex === index;

                  return (
                    <div
                      key={step.key}
                      className={[
                        "relative overflow-hidden rounded-2xl border p-4 transition-all",
                        isCurrent
                          ? "border-main/30 bg-main/15 shadow-[0_16px_32px_rgba(91,76,255,0.18)]"
                          : isDone
                            ? "border-emerald-400/20 bg-emerald-500/10"
                            : "border-white/10 bg-white/[0.04]",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                            {String(index + 1).padStart(2, "0")}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-white">{t(step.labelKey)}</p>
                        </div>
                        <div
                          className={[
                            "flex h-9 w-9 items-center justify-center rounded-xl border",
                            isCurrent
                              ? "border-main/30 bg-main text-white"
                              : isDone
                                ? "border-emerald-400/20 bg-emerald-400/15 text-emerald-300"
                                : "border-white/10 bg-white/[0.05] text-white/55",
                          ].join(" ")}
                        >
                          {isDone ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
                        </div>
                      </div>

                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={[
                            "h-full rounded-full transition-all",
                            isCurrent ? "w-2/3 bg-main" : isDone ? "w-full bg-emerald-400" : "w-1/4 bg-white/20",
                          ].join(" ")}
                        />
                      </div>

                      <p className="mt-3 text-xs text-white/70">
                        {isCurrent
                          ? "Buyurtma aynan shu bosqichda turibdi"
                          : isDone
                            ? "Bu bosqich muvaffaqiyatli yakunlangan"
                            : "Navbatdagi ehtimoliy jarayon bosqichi"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-black/[0.05] p-4 dark:bg-white/[0.04]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-main dark:text-white/70">
                Next Signal
              </p>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-main/20 bg-main/12 p-4">
                  <p className="text-xs text-white/65">Hozirgi holat</p>
                  <p className="mt-2 text-base font-bold text-white">
                    {normalizedCurrentStatus ? <span>{getStatusLabel(normalizedCurrentStatus) ? t(getStatusLabel(normalizedCurrentStatus) as string) : humanizeStatus(normalizedCurrentStatus)}</span> : "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs text-white/65">Keyingi kutilayotgan bosqich</p>
                  <p className="mt-2 text-base font-bold text-white">
                    {nextStep ? t(nextStep.labelKey) : "Jarayon yakunlangan"}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    {nextStep
                      ? "Agar jarayon odatiy ketma-ketlikda davom etsa, buyurtma keyin shu statusga o'tadi."
                      : "Bu buyurtma flow bo'yicha oxirgi bosqichga yetgan."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isLoading && events.length === 0 ? (
        <div className="relative flex min-h-56 items-center justify-center">
          <Loader />
        </div>
      ) : null}

      {!isLoading && isError ? (
        <TrackingEmptyState
          type="error"
          message={errorMessage || t("tracking.error")}
        />
      ) : null}

      {!isLoading && !isError && events.length === 0 ? <TrackingEmptyState type="empty" /> : null}

      {events.length > 0 ? (
        <div className="relative mx-auto w-full max-w-4xl space-y-5">
          <TrackingTimeline events={events} />
          {hasMore ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={isLoading}
                className="inline-flex items-center justify-center rounded-xl border border-main/20 bg-main/10 px-4 py-2.5 text-sm font-semibold text-main transition-colors hover:bg-main/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("tracking.loadMore")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default OrderTracking;
