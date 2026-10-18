// dizayn-v2: superadmin-scan-result, manager-scan-result, registrator-scan-result, courier-scan-order-detail, courier-scan-package-detail, courier-scan-post-detail
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type ScanStickyBarProps = {
  /** Planshetdagi (768–1023) chap xulosa: «№10226 · Zarina Yo'ldosheva» / «365 000 so'm · Uygacha». */
  summary?: { title: string; sub: string } | null;
  /** Panel tepasidagi natija (O'zimga olish / Qabul qilish xabari) — tugma yonida ko'rinsin. */
  notice?: ReactNode;
  /** Tugmalar (`lg`, 48px). Telefonda to'liq enli bo'lak bo'lib bo'linadi. */
  children: ReactNode;
};

/**
 * Pastga yopishgan amal paneli — maketdagi `.el-sticky-bar` (planshet va telefon). Skaner qobig'ida
 * (`ScanLayout`) pastki menyu yo'q, shuning uchun `bottom-0` + `safe-area`. Kontent panel ostida qolmasin:
 * sahifa oxirida panel balandligiga teng joy qoladi (balandlik o'lchanadi — natija xabari chiqqanda ham).
 */
export const ScanStickyBar = ({ summary, notice, children }: ScanStickyBarProps) => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(72);

  useLayoutEffect(() => {
    const element = barRef.current;
    if (!element) return undefined;
    const apply = () => setHeight(Math.ceil(element.getBoundingClientRect().height));
    apply();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div aria-hidden="true" className="shrink-0" style={{ height }} data-testid="scan-sticky-spacer" />
      <div
        ref={barRef}
        className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-3 border-t border-border bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        {notice}
        <div className="flex min-w-0 items-center gap-2">
          {summary ? (
            <div className="flex min-w-0 flex-[999_1_auto] flex-col max-md:hidden">
              <span className="truncate text-sm font-semibold text-text">{summary.title}</span>
              <span className="truncate text-[13px] text-text-muted">{summary.sub}</span>
            </div>
          ) : null}
          <div className="flex min-w-0 flex-[1_1_auto] items-center justify-end gap-2 max-md:[&>*]:min-w-0 max-md:[&>*]:flex-1">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};
