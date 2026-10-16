// dizayn-v2: superadmin-orders-detail, market-orders-detail, courier-orders-detail
import { useState } from "react";
import { Tag } from "lucide-react";
import { getProductImageUrl, type OrderDetailItem } from "./orderDetailModel";

/**
 * Mahsulot ikonka uyasi (`.el-stat-icon` 36px, neytral): rasm bo'lsa — rasm, bo'lmasa yoki
 * ochilmasa — `Tag` (maketdagidek).
 */
export const ProductThumb = ({ item }: { item: OrderDetailItem }) => {
  const imageUrl = getProductImageUrl(item);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;

  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-sunken text-text-muted">
      {showImage ? (
        <img
          src={imageUrl ?? undefined}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailedUrl(imageUrl ?? null)}
        />
      ) : (
        <Tag size={18} aria-hidden="true" />
      )}
    </span>
  );
};
