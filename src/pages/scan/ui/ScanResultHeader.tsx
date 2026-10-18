// dizayn-v2: superadmin-scan-result, manager-scan-result, registrator-scan-result, courier-scan-order-detail, courier-scan-package-detail, courier-scan-post-detail
import type { ReactNode } from "react";
import { ArrowLeft, CircleCheck, ExternalLink, ScanLine, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { cx } from "../../../shared/lib/cx";
import { Badge, IconButton, buttonClasses } from "../../../shared/ui/primitives";
import { SCANNER_ROUTE } from "../model/routes";
import { useIsBelowMd } from "../model/useViewport";
import { ScanAlert } from "./ScanAlert";

/** Maketdagi `.el-back` (CODE-MAP 2.1): 13px · 600 · `text-muted`, hover `action-hover`, `ArrowLeft` 16. */
const BACK_LINK =
  "inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-text-muted " +
  "transition-[color] duration-150 hover:text-action-hover motion-reduce:transition-none";

type ScanResultHeaderProps = {
  /** Sarlavha yonidagi plitka ikonkasi (buyurtma — `CircleCheck`, paket — `Package`, pochta — `Mail`). */
  icon: LucideIcon;
  /** ≥ 768: «Buyurtma №10226» / «Paket B-137» / «Pochta №2493». */
  title: string;
  /** < 768 (`.el-mtop`): «№10226» / «Paket B-137» / «Pochta №2493». */
  phoneTitle: string;
  /** < 768: «Skanerlangan buyurtma» / «Paket qabul qilish» / «Skanerlangan pochta». */
  phoneSub: string;
  /** ≥ 768: «QR muvaffaqiyatli o'qildi · skanerlangan buyurtma». */
  sub: string;
  /** < 768: muvaffaqiyat ogohlantirishining ikkinchi qatori. */
  alertText: string;
  /** ≥ 768: sarlavhaga yopishgan kichik tugma (buyurtma raqamini nusxalash). */
  titleAction?: ReactNode;
  /** < 768: yuqori panelning o'ng tugmasi (`/orders/edit/:id`); berilmasa — yo'q. */
  phoneDetailHref?: string | null;
  phoneDetailLabel?: string;
  /** ≥ 768: «USB skaner tayyor» dan keyingi amallar. Sukut — ikkinchi darajali «Yana skanerlash». */
  actions?: ReactNode;
};

/** «Yana skanerlash» havolasi (sarlavha va pastki panel uchun bir xil). */
export const ScanAgainLink = ({
  variant = "secondary",
  size = "md",
  compact = false,
  className,
}: {
  variant?: "primary" | "secondary";
  size?: "md" | "lg";
  /** Telefon panelidagi juft tugma — ixcham chekka, ikonkasiz (ikkalasi bir qatorga to'liq sig'adi). */
  compact?: boolean;
  className?: string;
}) => {
  const { t } = useTranslation("scan");
  return (
    <Link to={SCANNER_ROUTE} className={buttonClasses({ variant, size, compact, className })}>
      {/* Telefondagi juft tugmada ikonka yo'q — matn 175 px ga to'liq sig'sin (kesilmasin). */}
      {compact ? null : <ScanLine size={18} aria-hidden="true" className="shrink-0" />}
      <span className="min-w-0 truncate">{t("scanAgain")}</span>
    </Link>
  );
};

/**
 * Natija sarlavhasi. Telefonda (< 768) — `.el-mtop` (orqaga ikonka-tugma, «№…» + izoh, ixtiyoriy o'ng
 * tugma) va ostida «QR muvaffaqiyatli o'qildi» ogohlantirishi; planshet va desktopda — «← Skanerga
 * qaytish», plitka + `h1` + izoh, o'ngda «USB skaner tayyor» va amallar. Har holatda bitta `h1`.
 */
export const ScanResultHeader = ({
  icon: Icon,
  title,
  phoneTitle,
  phoneSub,
  sub,
  alertText,
  titleAction,
  phoneDetailHref,
  phoneDetailLabel,
  actions,
}: ScanResultHeaderProps) => {
  const { t } = useTranslation("scan");
  const navigate = useNavigate();
  const isPhone = useIsBelowMd();

  if (isPhone) {
    return (
      <>
        {/* `.el-mtop` — skaner qobig'ining 16px chekkasidan chiqib, ekran eniga (shell'siz ekran). */}
        <header className="-mx-4 -mt-4 flex h-14 items-center gap-2 border-b border-border bg-surface pl-1 pr-2">
          <IconButton size="lg" icon={ArrowLeft} label={t("backToScanner")} onClick={() => navigate(SCANNER_ROUTE)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate text-[17px] font-bold leading-[22px] text-text">{phoneTitle}</h1>
            <span className="truncate text-xs text-text-muted">{phoneSub}</span>
          </div>
          {phoneDetailHref ? (
            <IconButton
              size="lg"
              icon={ExternalLink}
              label={phoneDetailLabel ?? ""}
              onClick={() => navigate(phoneDetailHref)}
            />
          ) : null}
        </header>
        <ScanAlert tone="success" icon={CircleCheck} title={t("scannedOk")} role="status" compact>
          {alertText}
        </ScanAlert>
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Link to={SCANNER_ROUTE} className={cx(BACK_LINK, "mb-1")}>
        <ArrowLeft size={16} aria-hidden="true" className="shrink-0" />
        {t("backToScanner")}
      </Link>
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success-fg">
            <Icon size={24} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-1">
              <h1 className="min-w-0 text-2xl/8 font-bold tracking-[-.01em] wrap-break-word text-text">{title}</h1>
              {titleAction}
            </div>
            <p className="text-sm/normal text-text-muted">{sub}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success" dot>
            {t("scannerReady")}
          </Badge>
          {actions ?? <ScanAgainLink />}
        </div>
      </header>
    </div>
  );
};
