import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { cx } from "../../lib/cx";
import { useDocumentTitle } from "../../lib/documentTitle";

/**
 * «Orqaga» havolasining manzili:
 *  - `string` — route (`"/orders"`): oddiy havola (`<a href>`), yangi oynada ham ochiladi;
 *  - funksiya — tugma, bosilganda shu funksiya chaqiriladi;
 *  - `true` — tugma, brauzer tarixida bir qadam orqaga (`navigate(-1)`).
 *    Faqat ota sahifa noma'lum bo'lsa: havoladan to'g'ridan-to'g'ri ochilgan
 *    sahifada tarix bo'sh bo'ladi, shuning uchun imkon bo'lsa route bering.
 */
export type PageHeaderBack = string | (() => void) | true;

/**
 * «← …» havolasi va uning matni. Taxta `tizim-states-navigation`: «Havola matni —
 * qaytiladigan bo'lim nomi, «Orqaga» emas». Shuning uchun route yoki funksiya
 * berilsa `backLabel` MAJBURIY (ota sahifa nomi, masalan «Buyurtmalar»). Faqat
 * `back={true}` (ota sahifa noma'lum) da u ixtiyoriy — sukut `ui:common.back` («Orqaga»).
 */
type PageHeaderBackProps =
  | {
      /** Sarlavha ustidagi «← …» havolasi (maketdagi `.el-back`). */
      back?: undefined;
      backLabel?: undefined;
    }
  | {
      back: string | (() => void);
      /** Havola matni — ota sahifa nomi, maketdagidek («Buyurtmalar»). */
      backLabel: string;
    }
  | {
      back: true;
      /** Berilmasa: `ui:common.back` («Orqaga»). */
      backLabel?: string;
    };

export type PageHeaderProps = Omit<ComponentProps<"header">, "title"> &
  PageHeaderBackProps & {
    /** Sahifa sarlavhasi — har doim `<h1>` (sahifada bitta). Uzun sarlavha qatorga o'raladi, kesilmaydi. */
    title: ReactNode;
    /**
     * Sarlavha ostidagi qisqa izoh (`.el-sub`: 14px, qator 1.5 = 21px, `text-text-muted`).
     * Ichida faqat matn qatori elementlari (`span`, badge).
     */
    description?: ReactNode;
    /**
     * O'ng tomondagi amallar. Ekranda **bitta** asosiy tugma (`Button variant="primary"`),
     * qolganlari ikkinchi darajali. Telefonda sarlavha ostiga tushadi va to'liq enga
     * cho'ziladi (har tugma teng bo'lak).
     */
    actions?: ReactNode;
    /**
     * Sarlavhaga yopishgan kichik ikonka tugma (4px oraliq) — masalan
     * `<IconButton size="sm" icon={Copy} label="Buyurtma raqamini nusxalash" />` (maket `*-orders-detail`).
     */
    titleAction?: ReactNode;
    /** Sarlavha yonidagi qo'shimcha (12px oraliq): holat badge'i, son. */
    meta?: ReactNode;
    /** Sarlavha ostidagi qism (masalan `Tabs`), sahifa ritmi oralig'ida (24, telefonda 16). */
    children?: ReactNode;
    /**
     * Matn bloki qatordagi bo'sh joyni egallaydi (maketdagi `.el-pagehead-text { flex: 1 1 auto }`):
     * `meta` qatori butun enga cho'ziladi, undagi `ml-auto` element (masalan telefondagi «Yangilash»
     * ikonka tugmasi, maket `*-orders-list`) o'ng chetga tushadi. Sukut `false` — o'zgarishsiz.
     */
    grow?: boolean;
  };

/** Maketdagi `.el-back`: 13px · 600 · `text-muted`, hover `action-hover`, `ArrowLeft` 16. */
const BACK_CLASS = cx(
  "mb-1 inline-flex items-center gap-1.5 self-start text-left text-[13px] font-semibold text-text-muted",
  // Telefonda bosish maydoni 44px; sarlavhagacha ko'rinadigan oraliq esa desktopdagidek 8px
  // qoladi (maketning `min-height: 44px; margin: -12px 0 -8px` usuli). Desktopda quti matnga
  // teng — global `:focus-visible` halqasi matnni o'raydi (taxta `tizim-states-navigation`).
  "max-md:-mt-3 max-md:-mb-2 max-md:min-h-11",
  "transition-[color] duration-150 hover:text-action-hover motion-reduce:transition-none",
);

type BackLinkProps = { back: PageHeaderBack; label: string };

const BackContent = ({ label }: { label: string }) => (
  <>
    <ArrowLeft size={16} aria-hidden="true" className="shrink-0" />
    {label}
  </>
);

/** `navigate(-1)` — `useNavigate` faqat shu holatda chaqiriladi. */
const HistoryBackButton = ({ label }: { label: string }) => {
  const navigate = useNavigate();
  return (
    <button type="button" className={BACK_CLASS} onClick={() => navigate(-1)}>
      <BackContent label={label} />
    </button>
  );
};

const BackLink = ({ back, label }: BackLinkProps) => {
  if (typeof back === "string") {
    return (
      <Link to={back} className={BACK_CLASS}>
        <BackContent label={label} />
      </Link>
    );
  }
  if (typeof back === "function") {
    return (
      <button type="button" className={BACK_CLASS} onClick={back}>
        <BackContent label={label} />
      </button>
    );
  }
  return <HistoryBackButton label={label} />;
};

/**
 * SAHIFA SARLAVHASI — dizayn v2 (`design/CODE-MAP.md` 2.4: `.el-pagehead`).
 *
 *   <PageHeader
 *     back="/orders"
 *     backLabel={ordersTitle}            // «Buyurtmalar»
 *     title="№10305"
 *     titleAction={copyButton}           // <IconButton size="sm" icon={Copy} label=… />
 *     meta={statusBadge}                 // holat badge'i
 *     description={createdLine}          // «Yaratilgan: Kecha, 11:40 · Nur Elektronika»
 *     actions={<Button variant="primary">{sellLabel}</Button>}
 *   />
 *
 * Tuzilma (maket `superadmin-orders-list`, `manager-orders-detail`):
 *  - chapda: «← ota sahifa» havolasi, `<h1>` (24/32 · 700, telefonda 20/28) va yonida `meta`,
 *    ostida izoh;
 *  - o'ngda amallar, matn blokining pastki chizig'ida (`items-end`); joy yetmasa
 *    sarlavha ostiga o'raladi;
 *  - telefonda (< 768) amallar to'liq enli qatorda, har biri teng bo'lak.
 */
export const PageHeader = ({
  title,
  description,
  back,
  backLabel,
  actions,
  titleAction,
  meta,
  children,
  grow = false,
  className,
  ...rest
}: PageHeaderProps) => {
  const { t } = useTranslation("ui");
  // Brauzer sarlavhasi va shell e'loni — shu `<h1>` matni (WuVeVZqo); matn bo'lmasa (yuklanish skeleti) — kutadi.
  useDocumentTitle(typeof title === "string" || typeof title === "number" ? String(title) : null);

  const h1 = (
    <h1 className="min-w-0 text-2xl/8 font-bold tracking-[-.01em] wrap-break-word text-text max-md:text-xl/7">
      {title}
    </h1>
  );
  // Maketdagidek: [h1 + ikonka tugma] 4px, ular bilan meta orasida 12px (qator — 8px).
  const heading = titleAction ? (
    <div className="flex min-w-0 items-center gap-1">
      {h1}
      {titleAction}
    </div>
  ) : (
    h1
  );

  return (
    <header className={cx("flex min-w-0 flex-col gap-6 max-md:gap-4", className)} {...rest}>
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4 max-md:items-stretch">
        <div className={cx("flex min-w-0 flex-col gap-1", grow && "flex-auto")}>
          {back !== undefined ? (
            <BackLink back={back} label={backLabel ?? t("common.back")} />
          ) : null}
          {meta ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              {heading}
              {meta}
            </div>
          ) : (
            heading
          )}
          {/* `.el-sub` qator balandligini o'zi bermaydi — 1.5 meros (21px); `text-sm` yolg'iz 20px qilardi. */}
          {description ? <p className="text-sm/normal text-text-muted">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:[&>*]:flex-1">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </header>
  );
};
