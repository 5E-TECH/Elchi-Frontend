// dizayn-v2: investor-investments-list-loading
import { Skeleton } from "../../../shared/ui/primitives";

/**
 * Investor ro'yxat sahifalarining yuklanish skeleti (maket `investor-investments-list-loading`; `/profits` ham shu
 * naqsh — route-map izohi). Maketda ustun sarlavhasi qatori YO'Q — faqat qatorlar: kompyuterda har qatorda
 * `widths` bo'yicha chiziqlar (ikkinchisidan boshlab o'ngga suriladi), telefonda kartalar (summa + o'ng chiziq,
 * pastda sana chizig'i). `SkeletonTable` doim sarlavha qatorini chizadi — shuning uchun alohida.
 */
export const InvestorListSkeleton = ({
  rows = 5,
  widths = ["18%", "20%", "16%"],
}: {
  rows?: number;
  /** Kompyuter qatoridagi chiziqlar kengligi (maket: 18% · 20% · 16%). */
  widths?: readonly string[];
}) => (
  <div data-skeleton-preset="investor-list" className="min-w-0">
    <div className="max-md:hidden">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex h-14 items-center justify-between gap-6 border-t border-border px-5">
          {widths.map((width, column) => (
            <Skeleton key={column} tone="border" width={width} height={12} className={column === 1 ? "ml-auto" : undefined} />
          ))}
        </div>
      ))}
    </div>
    <div className="hidden flex-col max-md:flex">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex flex-col gap-2.5 border-t border-border px-4 py-3.5">
          <span className="flex justify-between gap-4">
            <Skeleton tone="border" width="48%" height={12} />
            <Skeleton tone="border" width="22%" height={12} />
          </span>
          <Skeleton tone="border" width="40%" height={12} />
        </div>
      ))}
    </div>
  </div>
);
