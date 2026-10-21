// dizayn-v2: superadmin-products-list, superadmin-orders-detail, superadmin-neworders-create-manual-step2-existing-customer
import { useState } from "react";
import { Tag, type LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";

export type ProductThumbSize = "md" | "lg";

const SIZE: Record<ProductThumbSize, { box: string; icon: number }> = {
  // `.el-stat-icon` — mahsulotlar ro'yxati, buyurtma tafsiloti.
  md: { box: "size-9", icon: 18 },
  // Buyurtma yaratish 2-qadami (katalog va tanlangan mahsulotlar) — 40 px, chegarali.
  lg: { box: "size-10 border border-border", icon: 18 },
};

export type ProductThumbProps = {
  /** Tayyor (ochiq) rasm manzili; bo'lmasa yoki ochilmasa — ikonka. */
  imageUrl?: string | null;
  size?: ProductThumbSize;
  /** Rasm yo'q bo'lganda ikonka (sukut `Tag` — ikonka katalogida «Mahsulot»). */
  fallbackIcon?: LucideIcon;
  className?: string;
};

/**
 * Mahsulot rasmi uyasi (neytral `bg-sunken`, radius 10): rasm bo'lsa — rasm, bo'lmasa yoki yuklanmasa — ikonka.
 * Bezak (`aria-hidden`): nom yonidagi matnda bor. Mahsulotlar sahifasi, buyurtma tafsiloti va buyurtma yaratish
 * (CS-B) shu bitta komponentni ishlatadi.
 */
export const ProductThumb = ({ imageUrl, size = "md", fallbackIcon: Icon = Tag, className }: ProductThumbProps) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = imageUrl?.trim() || null;
  const showImage = url != null && failedUrl !== url;
  const { box, icon } = SIZE[size];

  return (
    <span
      aria-hidden="true"
      data-product-thumb={showImage ? "image" : "icon"}
      className={cx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-sunken text-text-muted",
        box,
        className,
      )}
    >
      {showImage ? (
        <img src={url} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailedUrl(url)} />
      ) : (
        <Icon size={icon} strokeWidth={2} />
      )}
    </span>
  );
};
