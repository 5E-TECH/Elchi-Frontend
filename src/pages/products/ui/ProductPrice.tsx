// dizayn-v2: superadmin-products-list, market-products-list, superadmin-products-create
import { useTranslation } from "react-i18next";
import { formatProductPrice, getProductPrice, type Product } from "../model/productView";

/**
 * «NARX» KATAGI — ro'yxat jadvali va telefon kartalari (`/products`, «Market mahsulotlari»). Narx bor —
 * `formatProductPrice` (tiyin yaxlitlanmaydi); yo'q — ko'rinishda «—», ekran o'quvchiga «Narx kiritilmagan».
 */
export const ProductPrice = ({ product }: { product: Product }) => {
  const { t, i18n } = useTranslation("products");
  const price = getProductPrice(product);
  if (price !== null) return <>{formatProductPrice(price, i18n.resolvedLanguage ?? i18n.language)}</>;
  return (
    <span className="text-text-subtle">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{t("v2.list.noPrice")}</span>
    </span>
  );
};
