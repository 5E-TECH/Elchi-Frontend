// dizayn-v2: (maket yo'q) superadmin-orders-detail-edit-order-dialog
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/config/store";
import { PRODUCT_LIST_MAX_LIMIT, useProducts } from "../../../../entities/product";
import { isMarketSideRole } from "../../../../entities/user/lib/role";
import { Select, type SelectOption } from "../../../../shared/ui/primitives";
import { toCatalogItems, type CatalogItem } from "./addOrderItemModel";

/**
 * «Mahsulot qo'shish» — buyurtmani tahrirlash oynasida (HQ hali qabul qilmagan buyurtma) shu buyurtma
 * marketining katalogidan mahsulot tanlanadi: adashib 1 ta mahsulot bilan yaratilgan buyurtmaga ikkinchisi
 * qo'shiladi yoki noto'g'risi o'chirilib, to'g'risi qo'shiladi. Ro'yxatda allaqachon bor mahsulotlar
 * chiqmaydi. Katalog — buyurtma yaratish formasidagi bilan bir xil so'rov (xodim: `product/market/:id`,
 * market tomoni: `product/my-products`; kesh umumiy). Tanlangach qiymat bo'shaydi — keyingisini tanlash mumkin.
 *
 * Backend qo'shilgan mahsulot aynan shu marketniki ekanini tekshiradi (`PATCH orders/:id/full`).
 */

const CATALOG_PARAMS = { limit: PRODUCT_LIST_MAX_LIMIT };

type Props = {
  marketId: string;
  /** Ro'yxatdagi mahsulotlar (katalog id'lari) — variantlarda chiqmaydi. */
  usedProductIds: ReadonlySet<string>;
  disabled?: boolean;
  onAdd: (product: CatalogItem) => void;
};

export const AddOrderItemPicker = memo(({ marketId, usedProductIds, disabled = false, onAdd }: Props) => {
  const { t } = useTranslation("newOrders");
  const role = useSelector((state: RootState) => state.role.role);
  const isMarketRole = isMarketSideRole(role);
  const { useGetByMarketId, useGetMyProducts } = useProducts();
  const byMarket = useGetByMarketId(marketId || undefined, !isMarketRole, CATALOG_PARAMS);
  const mine = useGetMyProducts(isMarketRole, CATALOG_PARAMS);
  const query = isMarketRole ? mine : byMarket;

  const catalog = useMemo(() => toCatalogItems(query.data), [query.data]);
  const options = useMemo<SelectOption[]>(
    () =>
      catalog
        .filter((product) => !usedProductIds.has(product.id))
        .map((product) => ({ value: product.id, label: product.name, searchText: product.name })),
    [catalog, usedProductIds],
  );
  const noMarket = !isMarketRole && !marketId;

  return (
    <Select
      searchable
      value={null}
      disabled={disabled || noMarket || query.isError}
      loading={query.isLoading}
      placeholder={
        query.isError
          ? t("editDialog.addItemError")
          : query.isSuccess && options.length === 0
            ? t("editDialog.addItemEmpty")
            : t("editDialog.addItemPlaceholder")
      }
      noOptionsText={t("editDialog.addItemEmpty")}
      options={options}
      onChange={(value) => {
        const product = value ? catalog.find((item) => item.id === value) : undefined;
        if (product) onAdd(product);
      }}
    />
  );
});

AddOrderItemPicker.displayName = "AddOrderItemPicker";
