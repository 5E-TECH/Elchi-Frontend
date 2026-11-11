// dizayn-v2: superadmin-integrations-catalog, admin-integrations-catalog
import { Fragment, createElement, useMemo } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, CreditCard, Download, Handshake, Inbox, PackageCheck, Store, Truck, type LucideIcon } from "lucide-react";
import { canManageCarrierAccounts } from "../../app/lib/access";
import { useHqBranch } from "../../entities/branch";
import { CATEGORY_LABEL, ROLE_META, type IntegrationRole } from "../../entities/integrations";
import { Badge, EmptyState, PageHeader, Pressable } from "../../shared/ui/primitives";
import { CONNECTION_TYPES, type ConnectionTypeMeta } from "./connections";

/**
 * KATALOG — «Qaysi tizimni ulaysiz?» (maket `*-integrations-catalog`).
 *
 * ⚠️ YO'NALISH SAVOLI OLIB TASHLANGAN. Yo'nalishni konsoldagi TAB belgilaydi (Hamkorlar / Tashqi tizimlar /
 * Marketplace), katalog esa faqat o'sha tabga mos turlarni YASSI ro'yxatda ko'rsatadi. Hamkor (BeePost)
 * yaratish katalogsiz — konsoldagi «Yangi hamkor» oynasi orqali.
 *
 * Karta — `Pressable` (haqiqiy `<button>`): fokus, Enter / Bo'shliq brauzerning o'zida (`keyboardAccess.test.tsx`).
 * Ichida faqat `<span>` (frazali kontent — tugma ichida to'g'ri); nomi `aria-label` da. `items-stretch text-left` —
 * tugmaning brauzer sukutlari (`text-align: center`) avvalgi `div` ko'rinishini o'zgartirmasin.
 *
 * «Tashqi yetkazuvchi (Carrier API)» kartasi (maket katalogi, «Yetkazuvchi» dan keyin) — usta emas: konsolning
 * «Tashqi yetkazuvchilar» tabida yaratish oynasini ochadi (`?scope=carrier&new=1`). Faqat superadmin va admin.
 */

type Scope = "partner" | "external" | "marketplace";

const matchScope = (meta: ConnectionTypeMeta, scope: Scope): boolean => {
  if (scope === "partner") return meta.kind === "partner";
  if (scope === "marketplace") return meta.kind === "integration" && meta.category === "marketplace";
  return meta.kind === "integration" && meta.category !== "marketplace";
};

/** Turning ikonkasi (neytral `.el-stat-icon`) — rol bo'yicha. */
const ROLE_ICON: Record<IntegrationRole, LucideIcon> = {
  source: Inbox,
  carrier: Truck,
  payment: CreditCard,
  mirror: Download,
};

const iconOf = (type: ConnectionTypeMeta): LucideIcon =>
  type.kind === "partner" ? Handshake : type.category === "marketplace" ? Store : ROLE_ICON[type.role];

/** Konsoldagi scope tab nomi — «← Tashqi tizimlar». */
const BACK_LABEL: Record<Scope, string> = {
  partner: "navPartners",
  external: "navExternal",
  marketplace: "navMarketplace",
};

const CatalogPage = () => {
  const { t } = useTranslation("integrations");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const scopeParam = searchParams.get("scope");
  const scope: Scope | null =
    scopeParam === "partner" || scopeParam === "external" || scopeParam === "marketplace" ? scopeParam : null;

  const items = useMemo(() => (scope ? CONNECTION_TYPES.filter((m) => matchScope(m, scope)) : CONNECTION_TYPES), [scope]);
  const canManageCarriers = useSelector(canManageCarrierAccounts);
  /** Carrier API kartasi — tashqi tizimlar ro'yxatida (yoki katalog to'liq ochilganda). */
  const showCarrierCard = canManageCarriers && (scope === null || scope === "external");
  /** «Yetkazuvchi» kartasidan keyin; u ro'yxatda bo'lmasa — oxirida. */
  const carrierAfter = useMemo(() => {
    const index = items.findIndex((m) => m.role === "carrier");
    return index === -1 ? items.length - 1 : index;
  }, [items]);
  const hq = useHqBranch(showCarrierCard);

  const backTo = scope ? `/integrations/connections?scope=${scope}` : "/integrations";

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back={backTo}
        backLabel={t(scope ? BACK_LABEL[scope] : "pageTitle")}
        title={t("newConnection")}
        description={t("console.catalogSub")}
      />

      {items.length === 0 && !showCarrierCard ? (
        <EmptyState title={t("catNoTypes")} />
      ) : (
        <div
          role="list"
          aria-label={t("console.catalogListAria")}
          className="grid grid-cols-[repeat(auto-fit,minmax(max(min(340px,100%),calc((100%-16px)/2)),1fr))] gap-4"
        >
          {showCarrierCard && items.length === 0 ? (
            <CarrierTypeCard hqName={hq?.name} onPick={() => navigate("/integrations/connections?scope=carrier&new=1")} />
          ) : null}
          {items.map((type, index) => (
            <Fragment key={type.key}>
              <TypeCard type={type} onPick={() => navigate(`/integrations/new/${type.key}`)} />
              {showCarrierCard && index === carrierAfter ? (
                <CarrierTypeCard hqName={hq?.name} onPick={() => navigate("/integrations/connections?scope=carrier&new=1")} />
              ) : null}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Katalog kartasi (ko'rinish): ikonka, nom, belgilar, izoh, «Kerak bo'ladi» ro'yxati. Usta turlari (`TypeCard`) va
 * Carrier API kartasi bitta joydan — ko'rinish o'zgarsa bir marta o'zgaradi.
 */
const CatalogCard = ({
  icon,
  title,
  badges,
  description,
  prereqs,
  onPick,
  opensDialog = false,
}: {
  icon: LucideIcon;
  title: string;
  badges: string[];
  description: string;
  prereqs: string[];
  onPick: () => void;
  /** Bosilganda oyna ochiladi (`aria-haspopup="dialog"`), sahifa emas. */
  opensDialog?: boolean;
}) => {
  const { t } = useTranslation("integrations");
  return (
    <div role="listitem" className="flex min-w-0">
      <Pressable
        onClick={onPick}
        aria-label={t("catCardAria", { name: title })}
        aria-haspopup={opensDialog ? "dialog" : undefined}
        className="flex w-full min-w-0 cursor-pointer flex-col items-stretch rounded-[14px] border border-border bg-surface text-left text-text transition-[background-color,border-color] duration-150 hover:border-border-strong hover:bg-row-hover motion-reduce:transition-none"
      >
        <span className="flex flex-col gap-3 px-5 pb-4 pt-5 max-md:px-4">
          <span className="flex items-center gap-3">
            <span className="inline-flex size-9 flex-none items-center justify-center rounded-[10px] bg-sunken text-text-muted">
              {/* `createElement` — render paytida komponent «yaratilmaydi» (react-hooks/static-components). */}
              {createElement(icon, { size: 20, "aria-hidden": true })}
            </span>
            <span className="min-w-0 flex-1 text-base font-bold text-text">{title}</span>
            <ChevronRight size={20} aria-hidden="true" className="flex-none text-action-fg" />
          </span>
          <span className="flex flex-wrap gap-1.5">
            {badges.map((badge, index) => (
              <Badge key={index}>{badge}</Badge>
            ))}
          </span>
          <span className="text-[13px] leading-[18px] text-text-muted">{description}</span>
        </span>
        <span className="flex flex-1 flex-col gap-2 border-t border-border px-5 pb-5 pt-3.5 max-md:px-4">
          <span className="text-xs font-semibold uppercase tracking-[.04em] text-text-muted">{t("catPrereqTitle")}</span>
          <span role="list" className="flex flex-col gap-1.5">
            {prereqs.map((item) => (
              <span key={item} role="listitem" className="flex items-start gap-2 text-[13px] leading-[18px] text-text">
                <Check size={16} aria-hidden="true" className="mt-px flex-none text-text-subtle" />
                <span>{item}</span>
              </span>
            ))}
          </span>
        </span>
      </Pressable>
    </div>
  );
};

const TypeCard = ({ type, onPick }: { type: ConnectionTypeMeta; onPick: () => void }) => {
  const { t } = useTranslation("integrations");
  return (
    <CatalogCard
      icon={iconOf(type)}
      title={t(type.labelKey)}
      badges={[t(ROLE_META[type.role].labelKey), t(CATEGORY_LABEL[type.category])]}
      description={t(type.descKey)}
      prereqs={type.prereqKeys.map((item: string) => t(item))}
      onPick={onPick}
    />
  );
};

/** Carrier API turi — usta emas: konsolning yaratish oynasini ochadi. */
const CarrierTypeCard = ({ hqName, onPick }: { hqName?: string; onPick: () => void }) => {
  const { t } = useTranslation("integrations");
  return (
    <CatalogCard
      icon={PackageCheck}
      title={t("carrier.catalog.title")}
      badges={[t(ROLE_META.carrier.labelKey), "Carrier API"]}
      description={t("carrier.catalog.desc")}
      prereqs={[
        t("carrier.catalog.prereq1", { hq: hqName || t("carrier.hqFallback") }),
        t("carrier.catalog.prereq2"),
        t("carrier.catalog.prereq3"),
      ]}
      onPick={onPick}
      opensDialog
    />
  );
};

export default CatalogPage;
