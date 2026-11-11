// dizayn-v2: superadmin-integrations-carrier-console, admin-integrations-carrier-console
import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  CircleCheck,
  Code,
  ExternalLink,
  KeyRound,
  Lock,
  PackageCheck,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  ScrollText,
  Shield,
  TriangleAlert,
  User,
  Wallet,
} from "lucide-react";
import type { CarrierAccount } from "../../../entities/integrations/carriers";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { Badge, Button, Card, Skeleton, buttonClasses } from "../../../shared/ui/primitives";
import { InlineAlert, SectionHead } from "../ui";
import { IP_ALLOWLIST_MAX_ENTRIES } from "./ipAllowlist";
import { accountState, initialsOf, type CourierInfo } from "./carrierModel";
import { carrierDocsUrl, carrierPublicBaseUrl } from "./carrierLinks";
import { useCourierName } from "./carrierFormat";
import { CarrierStateBadge, CourierStatusBadge } from "./carrierParts";
import { useCourierReceivable } from "./useCarrierCouriers";

/**
 * TANLANGAN AKKAUNT (maket `*-carrier-console`, ikkinchi karta): sarlavha + «Tahrirlash», kuryer holati
 * ogohlantirishi (bloklangan / o'chirilgan), 2×2 bo'limlar — «Bog'langan kuryer», «IP cheklovi», «API kalit»,
 * «Ulanish holati» — «Kompaniya dasturchisi uchun» va pastki qator (ID, sanalar, «Faoliyat jurnali»).
 *
 * Har qiymat haqiqiy manbadan: akkaunt — `admin/carriers`; kuryer — `users/:id`; «Qabul qilinishi kerak» — kuryer
 * kassasining `olinishi_kerak` i («Kuryer kassasi» sahifasidagi son; olinmasa «—»); HQ — `branches/hq`; manzil —
 * ilovaning API hosti (`VITE_BASE_URL`). Endpointlar ro'yxati va so'rov cheklovi — `docs/public/CARRIER_API.md` (§2)
 * dagi doimiy matn.
 *
 * `headingRef`, `rotateRef`, `statusRef` — oynalar yopilgach fokus qaytadigan joylar (sarlavha, «Kalitni yangilash»,
 * «To'xtatish / Yoqish»): kalit va rad javobi oynalari boshqa oyna yopilayotganda ochiladi, sukut «ochgan element»
 * DOM'dan olinadi.
 */

const API_ENDPOINTS_LIST = [
  { path: "POST /carrier/scan", key: "carrier.detail.apiScan" },
  { path: "POST /carrier/orders/:id/status", key: "carrier.detail.apiStatus" },
  { path: "GET /carrier/orders", key: "carrier.detail.apiOrders" },
  { path: "GET /carrier/cashbox", key: "carrier.detail.apiCashbox" },
  { path: "POST /carrier/returns", key: "carrier.detail.apiReturns" },
] as const;

const Section = ({ children, className }: { children: ReactNode; className?: string }) => (
  <section className={cx("flex min-w-0 flex-col gap-4 bg-surface p-5 max-md:p-4", className)}>
    {children}
  </section>
);

/** Yorliq ustuni: kuryer bo'limida 44 %, dasturchi blokida 36 % (maket `.el-kv`). */
const KV_COLUMNS = {
  wide: "grid-cols-[minmax(120px,44%)_minmax(0,1fr)]",
  narrow: "grid-cols-[minmax(112px,36%)_minmax(0,1fr)]",
} as const;

const Kv = ({
  rows,
  columns,
}: {
  rows: Array<{ label: ReactNode; value: ReactNode }>;
  columns: keyof typeof KV_COLUMNS;
}) => (
  <dl className={cx("grid gap-x-4 gap-y-2.5 text-sm", KV_COLUMNS[columns])}>
    {rows.map((row, index) => (
      <div key={index} className="contents">
        <dt className="text-text-muted">{row.label}</dt>
        <dd className="min-w-0 font-semibold text-text [overflow-wrap:anywhere]">{row.value}</dd>
      </div>
    ))}
  </dl>
);

export const CarrierAccountDetail = ({
  account,
  info,
  hqBranchId,
  onEdit,
  onRotate,
  onStatus,
  onCreate,
  headingRef,
  rotateRef,
  statusRef,
}: {
  account: CarrierAccount;
  info: CourierInfo | undefined;
  hqBranchId: string | null;
  onEdit: () => void;
  onRotate: () => void;
  onStatus: () => void;
  onCreate: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
  rotateRef: RefObject<HTMLButtonElement | null>;
  statusRef: RefObject<HTMLButtonElement | null>;
}) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const state = accountState(account, info);
  const courierName = useCourierName()(account, info);
  const courier = info?.state === "ready" ? info.courier : null;
  const receivable = useCourierReceivable(courier ? courier.id : undefined, Boolean(courier));
  const rules = account.ip_allowlist ?? [];
  const isHq = Boolean(courier?.branch && hqBranchId && courier.branch.id === hqBranchId);
  const notHq = Boolean(courier?.branch && hqBranchId && courier.branch.id !== hqBranchId);
  const userHref = `/all-users/${account.courier_user_id}`;
  const money = (value: number | null) =>
    value === null ? "—" : formatMoneyLocalized(value, { language });
  const num = (value: number | null) =>
    value === null ? "—" : formatNumberLocalized(value, { language });
  const titleId = `carrier-sel-${account.id}`;

  return (
    <Card padding="none" aria-labelledby={titleId} className="overflow-hidden">
      {/* ── Sarlavha ── */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 border-b border-border px-5 py-4 max-md:px-4">
        <div className="flex min-w-0 flex-[1_1_360px] items-start gap-3">
          <span className="inline-flex size-9 flex-none items-center justify-center rounded-[10px] bg-sunken text-text-muted">
            <PackageCheck size={20} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <h2
                ref={headingRef}
                id={titleId}
                tabIndex={-1}
                className="mr-1 text-base font-bold text-text outline-none [overflow-wrap:anywhere]"
              >
                {account.name}
              </h2>
              <CarrierStateBadge state={state} />
              <Badge>{t("carrier.detail.badgeType")}</Badge>
              <Badge>Carrier API</Badge>
            </div>
            <p className="text-[13px] leading-[18px] text-text-muted">{t("carrier.detail.hint")}</p>
          </div>
        </div>
        <Button variant="secondary" leftIcon={Pencil} onClick={onEdit} aria-haspopup="dialog">
          {t("carrier.detail.edit")}
        </Button>
      </div>

      {/* ── Kuryer holati: kalit ishlamayotgan bo'lsa — tafsilot tepasida ── */}
      {state === "courierInactive" ? (
        <div className="border-b border-border px-5 py-4 max-md:px-4">
          <InlineAlert
            tone="warning"
            title={t("carrier.detail.blockedTitle")}
            actionPlacement="below"
            action={
              <Link
                to={userHref}
                className={buttonClasses({
                  variant: "secondary",
                  size: "sm",
                  className: "max-md:min-h-11",
                })}
              >
                <User size={16} aria-hidden="true" />
                {t("carrier.detail.openCourier")}
              </Link>
            }
          >
            {t("carrier.detail.blockedText", { name: courierName })}
          </InlineAlert>
        </div>
      ) : state === "courierMissing" ? (
        <div className="border-b border-border px-5 py-4 max-md:px-4">
          <InlineAlert
            tone="danger"
            role="status"
            title={t("carrier.detail.missingTitle")}
            actionPlacement="below"
            action={
              <Button
                variant="secondary"
                size="sm"
                leftIcon={Plus}
                onClick={onCreate}
                className="max-md:min-h-11"
              >
                {t("carrier.newButton")}
              </Button>
            }
          >
            {t("carrier.detail.missingText", { id: account.courier_user_id })}
          </InlineAlert>
        </div>
      ) : null}

      {/* ── 2×2 bo'limlar ── */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-px bg-border">
        <Section>
          <SectionHead
            icon={User}
            title={t("carrier.detail.courierTitle")}
            actions={
              <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                <Lock size={14} aria-hidden="true" />
                {t("carrier.detail.courierLocked")}
              </span>
            }
          />
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-sunken text-sm font-semibold text-text-muted"
            >
              {initialsOf(courierName)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {courier ? (
                <Link
                  to={userHref}
                  className="relative text-sm font-semibold text-text hover:text-action-fg hover:underline [overflow-wrap:anywhere] max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-3 max-md:after:content-['']"
                >
                  {courierName}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-text">{courierName}</span>
              )}
              <span className="text-[13px] text-text-muted">
                {info?.state === "loading" ? (
                  <Skeleton className="h-3.5 w-32" />
                ) : courier ? (
                  courier.phone ? (
                    formatPhone(courier.phone)
                  ) : (
                    "—"
                  )
                ) : info?.state === "missing" ? (
                  t("carrier.courierMissingRow", { id: account.courier_user_id })
                ) : (
                  "—"
                )}
              </span>
            </div>
            {courier ? <CourierStatusBadge courier={courier} /> : null}
          </div>
          {courier ? (
            <Kv
              columns="wide"
              rows={[
                { label: t("carrier.detail.branch"), value: courier.branch?.name || "—" },
                {
                  label: t("carrier.detail.tariff"),
                  value:
                    courier.tariffHome === null && courier.tariffCenter === null
                      ? "—"
                      : t("carrier.detail.tariffValue", {
                          home: num(courier.tariffHome),
                          center: money(courier.tariffCenter),
                        }),
                },
                {
                  label: t("carrier.detail.receivable"),
                  // Yuklanmoqda — skelet; so'rov yiqildi (403, 404 kassasi yo'q, 5xx) yoki son yo'q — «—».
                  value:
                    receivable.state === "loading" ? (
                      <Skeleton className="h-4 w-24" />
                    ) : (
                      money(receivable.state === "ready" ? receivable.value : null)
                    ),
                },
              ]}
            />
          ) : null}
          {isHq ? (
            <p className="flex items-start gap-2 text-[13px] leading-[18px] text-success-fg">
              <CircleCheck size={16} aria-hidden="true" className="mt-px flex-none" />
              <span>{t("carrier.detail.hqNote")}</span>
            </p>
          ) : notHq && courier?.branch ? (
            <InlineAlert
              tone="warning"
              title={t("carrier.detail.notHqTitle", { branch: courier.branch.name })}
            >
              {t("carrier.detail.notHqText", { name: account.name, branch: courier.branch.name })}
            </InlineAlert>
          ) : null}
          {/* O'chirilgan kuryerda havolalar yo'q foydalanuvchiga olib borardi — maketda faqat tepadagi ogohlantirish. */}
          {info?.state === "missing" ? null : (
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/payments/cash-detail/${account.courier_user_id}?type=courier`}
              className={buttonClasses({
                variant: "secondary",
                size: "sm",
                className: "max-md:min-h-11",
              })}
            >
              <Wallet size={16} aria-hidden="true" />
              {t("carrier.detail.cashLink")}
            </Link>
            <Link
              to={userHref}
              className={buttonClasses({
                variant: "ghost",
                size: "sm",
                className: "max-md:min-h-11",
              })}
            >
              {t("carrier.detail.profileLink")}
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </div>
          )}
        </Section>

        <Section>
          <SectionHead
            icon={Shield}
            title={t("carrier.detail.ipTitle")}
            actions={
              <Badge>
                {formatNumberLocalized(rules.length, { language })} /{" "}
                {formatNumberLocalized(IP_ALLOWLIST_MAX_ENTRIES, { language })}
              </Badge>
            }
          />
          {rules.length ? (
            <>
              <ul aria-label={t("carrier.detail.ipListAria")} className="flex flex-wrap gap-1.5">
                {rules.map((rule) => (
                  <li key={rule} className="flex">
                    {/* Maket `.el-badge.el-tone-neutral` (28 px, 13 px). */}
                    <Badge className="h-7 px-2.5 text-[13px]">{rule}</Badge>
                  </li>
                ))}
              </ul>
              <p className="text-[13px] leading-[18px] text-text-muted">
                {t("carrier.detail.ipHint")}
              </p>
            </>
          ) : (
            <p className="text-[13px] leading-[18px] text-text-muted">
              {t("carrier.detail.ipNoneText")}
            </p>
          )}
          <p className="text-xs text-text-muted">{t("carrier.detail.ipFormats")}</p>
          <div>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={Pencil}
              onClick={onEdit}
              aria-haspopup="dialog"
              className="max-md:min-h-11"
            >
              {t("carrier.detail.ipEdit")}
            </Button>
          </div>
        </Section>

        <Section>
          <SectionHead
            icon={KeyRound}
            title={t("carrier.detail.keyTitle")}
            actions={<Badge>elc_…</Badge>}
          />
          <div className="flex min-w-0 items-center gap-3 rounded-[10px] bg-sunken px-3 py-2.5">
            <span className="inline-flex size-9 flex-none items-center justify-center rounded-[10px] bg-surface text-text-muted">
              <Lock size={18} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold text-text">{t("carrier.detail.keyOnce")}</span>
              <span className="text-[13px] text-text-muted">{t("carrier.detail.keyHashOnly")}</span>
            </span>
          </div>
          <p className="text-[13px] leading-[18px] text-text-muted">
            {t("carrier.detail.keyHint")}
          </p>
          <div>
            <Button
              ref={rotateRef}
              variant="danger-soft"
              size="sm"
              leftIcon={RefreshCw}
              onClick={onRotate}
              aria-haspopup="dialog"
              className="max-md:min-h-11"
            >
              {t("carrier.detail.rotate")}
            </Button>
          </div>
        </Section>

        <Section>
          <SectionHead
            icon={Power}
            title={t("carrier.detail.statusTitle")}
            actions={<CarrierStateBadge state={account.is_active ? "active" : "stopped"} />}
          />
          {account.is_active ? (
            <InlineAlert tone="info" title={t("carrier.detail.activeTitle")}>
              {t("carrier.detail.activeText")}
            </InlineAlert>
          ) : (
            <>
              <p className="text-[13px] leading-[18px] text-text-muted">
                {t("carrier.detail.stoppedText", { name: account.name })}
              </p>
              <p className="flex items-start gap-2 text-[13px] font-semibold leading-[18px] text-warning-fg">
                <TriangleAlert size={16} aria-hidden="true" className="mt-px flex-none" />
                <span>{t("carrier.detail.stoppedWarn")}</span>
              </p>
            </>
          )}
          {/* Bitta element ikkala holatda: to'xtatish / yoqishdan keyin fokus shu tugmaga qaytadi (DOM'da qoladi). */}
          <div>
            <Button
              ref={statusRef}
              variant={account.is_active ? "danger-soft" : "secondary"}
              size="sm"
              leftIcon={Power}
              onClick={onStatus}
              aria-haspopup="dialog"
              className="max-md:min-h-11"
            >
              {t(account.is_active ? "carrier.detail.stop" : "carrier.detail.enable")}
            </Button>
          </div>
        </Section>
      </div>

      {/* ── Kompaniya dasturchisi uchun ── */}
      <div className="flex flex-wrap gap-x-8 gap-y-5 border-t border-border p-5 max-md:p-4">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5">
          <SectionHead icon={Code} title={t("carrier.detail.devTitle")} />
          <Kv
            columns="narrow"
            rows={[
              { label: t("carrier.detail.devBaseUrl"), value: carrierPublicBaseUrl() },
              { label: t("carrier.detail.devKeyHeader"), value: "X-Api-Key: elc_…" },
              { label: t("carrier.detail.devPing"), value: "GET /carrier/ping" },
              {
                label: t("carrier.detail.devRate"),
                value: (
                  <>
                    {t("carrier.detail.devRateValue")}{" "}
                    <span className="font-medium text-text-muted">
                      {t("carrier.detail.devRateNote")}
                    </span>
                  </>
                ),
              },
            ]}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <a
              href={carrierDocsUrl()}
              target="_blank"
              rel="noreferrer noopener"
              className={buttonClasses({
                variant: "secondary",
                size: "sm",
                className: "max-md:min-h-11",
              })}
            >
              <BookOpen size={16} aria-hidden="true" />
              {t("carrier.detail.devDocs")}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
            <span className="text-xs text-text-muted">{t("carrier.detail.devDocsHint")}</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-[2_1_420px] flex-col gap-2.5">
          <h3 className="text-sm font-semibold text-text">{t("carrier.detail.apiTitle")}</h3>
          <ul aria-label={t("carrier.detail.apiListAria")} className="flex flex-col">
            {API_ENDPOINTS_LIST.map((row) => (
              <li
                key={row.path}
                className="flex flex-wrap gap-x-4 gap-y-0.5 border-t border-border py-2"
              >
                <span className="max-w-full flex-[0_0_236px] text-[13px] font-semibold text-text">
                  {row.path}
                </span>
                <span className="min-w-0 flex-[1_1_260px] text-[13px] text-text-muted">
                  {t(row.key)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-muted">{t("carrier.detail.apiNote")}</p>
        </div>
      </div>

      {/* ── Pastki qator ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-5 py-3 max-md:px-4">
        <span className="text-xs text-text-muted">
          {t("carrier.detail.footer", {
            id: account.id,
            created: formatDateTimeLocalized(account.createdAt, { language }),
            updated: formatDateTimeLocalized(account.updatedAt, { language }),
          })}
        </span>
        <Link
          to="/activity-logs"
          className={buttonClasses({
            variant: "ghost",
            size: "sm",
            className: "-mr-2 max-md:min-h-11",
          })}
        >
          <ScrollText size={16} aria-hidden="true" />
          {t("carrier.detail.logs")}
        </Link>
      </div>
    </Card>
  );
};
