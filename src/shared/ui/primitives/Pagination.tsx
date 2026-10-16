import type { ComponentProps, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { formatNumberLocalized } from "../../lib/formatMoney";
import { Select } from "./Select";
import { useIsPhone } from "./date/useIsPhone";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  SAHIFALASH — dizayn v2 (`.el-pagination` / `.el-pages` / `.el-page`)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Maket: `superadmin-orders-list` (karta pastki qismi): chapda «1–10 / 1 248 ta buyurtma», o'ngda
 *  «10 ta» (sahifadagi qatorlar soni, telefonda yashirin) va sahifalar: ‹ 1 2 3 … 125 ›.
 *  Klasslar: `design/CODE-MAP.md` 2.6.
 *
 *  Sahifa raqamlari doim 5 o'ringa sig'adi (telefonda 358 px ga ham): birinchi, oxirgi va joriy atrofi —
 *  `1 2 3 … 125` · `1 … 60 … 125` · `1 … 123 124 125`. Joriy sahifa `aria-current="page"`, chetda
 *  «Oldingi sahifa» / «Keyingi sahifa» (`disabled`). Telefonda har tugma 44 px.
 *
 *  Telefonda qator BITTA satrda turadi (375 px da ham): 5 sahifa ham `1 2 3 … 5` ko'rinishida (7 ta 44 px
 *  tugma 375 px kartaga sig'maydi), «…» kerak bo'lsa 24 px dan 12 px gacha qisqaradi. 360 px dan tor
 *  ekranda — ikki satrga o'raladi (gorizontal toshish yo'q).
 *
 *  Karta ichida: `<Card padding="none" footer={<Pagination … />}>` — `footer` o'zi `.el-card-foot`.
 *  Jami 0 bo'lsa hech narsa chizilmaydi (bo'sh holatni sahifa ko'rsatadi).
 */

export type PaginationRange = { from: number; to: number; total: number };

export type PaginationProps = Omit<ComponentProps<"div">, "children"> & {
  /** Joriy sahifa (1 dan). */
  page: number;
  pageSize: number;
  /** Jami yozuvlar soni. */
  total: number;
  onPageChange: (page: number) => void;
  /** Berilsa — «10 ta» tanlovi (telefonda yashirin). */
  onPageSizeChange?: (pageSize: number) => void;
  /** Sukut: 10 · 25 · 50 · 100 (joriy qiymat ro'yxatda bo'lmasa qo'shiladi). */
  pageSizeOptions?: readonly number[];
  /**
   * Xulosa: sukut «1–10 / 1 248». Funksiya — sonlar `formatNumberLocalized` bilan tayyor matn:
   * `(r) => t("orders:paginationSummary", r)` → «1–10 / 1 248 ta buyurtma».
   */
  summary?: ReactNode | ((range: { from: string; to: string; total: string }) => ReactNode);
  /** Sahifalar navigatsiyasi nomi (sukut «Sahifalar»). */
  label?: string;
  /** Hammasi o'chiq (so'rov ketmoqda). */
  disabled?: boolean;
};

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100] as const;
const ELLIPSIS = "…";

/**
 * 5 o'rinli sahifalar qatori. `"…"` — tashlab ketilgan oraliq.
 * Jami ≤ 5 — hammasi; boshida `1 2 3 … N`; oxirida `1 … N-2 N-1 N`; o'rtada `1 … p … N`.
 * `compact` (telefon) — hammasi faqat jami ≤ 4 bo'lsa; 5 sahifa ham `…` bilan (eng ko'pi 4 raqam).
 */
// eslint-disable-next-line react-refresh/only-export-components -- sof funksiya primitiv bilan birga sinaladi
export const getPageItems = (
  page: number,
  totalPages: number,
  compact = false,
): Array<number | typeof ELLIPSIS> => {
  if (totalPages <= (compact ? 4 : 5)) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (page <= 3) return [1, 2, 3, ELLIPSIS, totalPages];
  if (page >= totalPages - 2) return [1, ELLIPSIS, totalPages - 2, totalPages - 1, totalPages];
  return [1, ELLIPSIS, page, ELLIPSIS, totalPages];
};

const PAGE =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-border bg-surface px-2 " +
  "text-[13px] font-semibold text-text hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-45 " +
  "disabled:hover:bg-surface aria-[current=page]:border-action aria-[current=page]:bg-action " +
  "aria-[current=page]:text-on-solid transition-[background-color,border-color,color,opacity] duration-150 " +
  "motion-reduce:transition-none max-md:h-11 max-md:min-w-11";

export const Pagination = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  summary,
  label,
  disabled = false,
  className,
  ...rest
}: PaginationProps) => {
  const { t, i18n } = useTranslation("ui");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();

  if (total <= 0) return null;

  const size = Math.max(1, Math.floor(pageSize) || 1);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const range: PaginationRange = {
    from: (current - 1) * size + 1,
    to: Math.min(current * size, total),
    total,
  };
  const text = {
    from: formatNumberLocalized(range.from, { language }),
    to: formatNumberLocalized(range.to, { language }),
    total: formatNumberLocalized(range.total, { language }),
  };
  const summaryNode =
    typeof summary === "function" ? summary(text) : (summary ?? t("pagination.summary", text));

  const sizes = Array.from(new Set([...pageSizeOptions, size])).sort((a, b) => a - b);
  const go = (next: number) => {
    if (disabled || next < 1 || next > totalPages || next === current) return;
    onPageChange(next);
  };

  return (
    <div
      className={cx(
        "flex w-full min-w-0 flex-wrap items-center justify-between gap-3 text-[13px] text-text-muted",
        "max-md:flex-col max-md:items-start",
        className,
      )}
      {...rest}
    >
      <span className="tabular-nums">{summaryNode}</span>
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
        {onPageSizeChange ? (
          <div className="w-[96px] max-md:hidden">
            <Select
              size="sm"
              aria-label={t("pagination.pageSize", { count: size })}
              listLabel={t("pagination.pageSize", { count: size })}
              disabled={disabled}
              value={String(size)}
              options={sizes.map((option) => ({
                value: String(option),
                label: t("pagination.pageSizeOption", { count: option }),
              }))}
              onChange={(value) => {
                const next = Number(value);
                if (Number.isFinite(next) && next > 0 && next !== size) onPageSizeChange(next);
              }}
            />
          </div>
        ) : null}
        <nav
          aria-label={label ?? t("pagination.label")}
          className="flex min-w-0 flex-wrap items-center gap-1 max-md:flex-nowrap max-[359px]:flex-wrap"
        >
          <button
            type="button"
            className={PAGE}
            aria-label={t("pagination.previous")}
            disabled={disabled || current <= 1}
            onClick={() => go(current - 1)}
          >
            <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} />
          </button>
          {getPageItems(current, totalPages, isPhone).map((item, index) =>
            item === ELLIPSIS ? (
              <span
                key={`gap-${index}`}
                aria-hidden="true"
                className="inline-flex h-8 min-w-6 items-center justify-center text-text-subtle max-md:h-11 max-md:w-6 max-md:min-w-3 max-md:shrink"
              >
                {ELLIPSIS}
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={cx(PAGE, "tabular-nums")}
                aria-current={item === current ? "page" : undefined}
                disabled={disabled && item !== current}
                onClick={() => go(item)}
              >
                {formatNumberLocalized(item, { language })}
              </button>
            ),
          )}
          <button
            type="button"
            className={PAGE}
            aria-label={t("pagination.next")}
            disabled={disabled || current >= totalPages}
            onClick={() => go(current + 1)}
          >
            <ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
          </button>
        </nav>
      </div>
    </div>
  );
};
