// dizayn-v2: superadmin-products-delete-dialog, admin-products-delete-dialog, manager-products-delete-dialog, registrator-products-delete-dialog
import { useCallback } from "react";
import { Store, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProducts } from "../../../entities/product";
import { useConfirm } from "../../../shared/ui/primitives";
import { describeProductError } from "../model/productErrors";
import type { Product } from "../model/productView";
import { ProductThumb } from "./ProductThumb";

/**
 * O'CHIRISH TASDIG'I — maket `*-products-delete-dialog`: qizil `Trash2`, «O'chirishni tasdiqlang», «Quyidagi
 * mahsulotni rostdan o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.», kartochka (rasm/`Tag` · nom · market),
 * «Bekor qilish» / qizil «O'chirish». `DELETE product/:id` (`deleteProduct`) — oyna ichida: so'rov ketayotganda
 * tugmalar qulf, xato bo'lsa i18n matni oynada qoladi (xom backend `message` emas). `true` — o'chirildi.
 */
export const useDeleteProductConfirm = () => {
  const { t } = useTranslation("products");
  const confirm = useConfirm();
  const { deleteProduct } = useProducts();
  const { mutateAsync } = deleteProduct;

  return useCallback(
    (product: Product, marketName: string | null) =>
      confirm({
        tone: "danger",
        icon: Trash2,
        title: t("v2.delete.title"),
        description: t("v2.delete.description"),
        confirmLabel: t("v2.delete.confirm"),
        confirmIcon: Trash2,
        loadingLabel: t("v2.delete.loading"),
        details: (
          <span className="flex min-w-0 items-center gap-3">
            <ProductThumb product={product} className="bg-surface" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold text-text wrap-break-word">{product.name}</span>
              {marketName ? (
                <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-text-muted">
                  <Store size={14} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                  <span className="truncate">{marketName}</span>
                </span>
              ) : null}
            </span>
          </span>
        ),
        onConfirm: () => mutateAsync(product.id),
        errorMessage: (error) => `${t("v2.delete.error")} ${describeProductError(error, t)}`,
      }),
    [confirm, mutateAsync, t],
  );
};
