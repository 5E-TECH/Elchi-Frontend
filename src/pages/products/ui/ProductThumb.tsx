// dizayn-v2: superadmin-products-list, admin-products-list, market-products-list, superadmin-products-create, admin-products-create
import { useState } from "react";
import { Tag } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import { getProductImageUrl, type Product } from "../model/productView";

/**
 * Mahsulot ikonka uyasi (`.el-stat-icon` 36 px, neytral): rasm bo'lsa — rasm, bo'lmasa yoki ochilmasa — `Tag`
 * (maketdagidek; ikonka katalogida «Mahsulot» = `Tag`). Bezak: nom yonidagi matnda bor.
 */
export const ProductThumb = ({ product, className }: { product: Product; className?: string }) => {
  const imageUrl = getProductImageUrl(product);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;

  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-sunken text-text-muted",
        className,
      )}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailedUrl(imageUrl ?? null)}
        />
      ) : (
        <Tag size={18} strokeWidth={2} />
      )}
    </span>
  );
};
