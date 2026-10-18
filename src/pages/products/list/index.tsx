// dizayn-v2: superadmin-products-list, admin-products-list, manager-products-list, registrator-products-list, market-products-list, superadmin-products-select-market-dialog, admin-products-market-select-dialog, manager-products-market-select-dialog, registrator-products-market-select-dialog, superadmin-products-edit-dialog, admin-products-edit-dialog, manager-products-edit-dialog, registrator-products-edit-dialog, market-products-edit-dialog, superadmin-products-delete-dialog, admin-products-delete-dialog, manager-products-delete-dialog, registrator-products-delete-dialog, market-products-delete-dialog
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, SearchX, Store, Tag, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { canCreateProducts } from "../../../app/lib/access";
import { useProducts } from "../../../entities/product";
import { useMarkets } from "../../../entities/markets";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { isInactiveMarketStatus } from "../../../shared/lib/marketStatus";
import { notify } from "../../../shared/lib/notify";
import { useDebounce } from "../../../shared/lib/useDebounce";
import { usePagination } from "../../../shared/lib/usePagination";
import { useQueryParams } from "../../../shared/lib/useQueryParams";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  PageHeader,
  Pagination,
  QueryBoundary,
  Select,
  Skeleton,
  SkeletonTable,
  TextInput,
  type DataTableColumn,
  type DataTableSort,
  type SelectOption,
} from "../../../shared/ui/primitives";
import {
  getProductList,
  getProductMarketName,
  getProductMeta,
  toProductMarkets,
  type Product,
  type ProductMarket,
} from "../model/productView";
import { ProductThumb } from "../ui/ProductThumb";
import { useDeleteProductConfirm } from "../ui/useDeleteProductConfirm";
import { EditProductDialog } from "./ui/EditProductDialog";
import { SelectMarketDialog } from "./ui/SelectMarketDialog";

// Qidiruv URL'ga (va so'rovga) yozishdan oldingi kutish — avvalgidek (GlobalSearchInput global rejimi).
const SEARCH_DEBOUNCE_MS = 1000;
const NAME_SORT_KEY = "name";

/**
 * MAHSULOTLAR — `/products` (superadmin, admin, menejer, registrator, market), dizayn v2.
 *
 * Maketlar: `superadmin-products-list` (= admin, menejer, registrator — `admin--products-list`), `market-products-list`.
 * Sarlavha «Mahsulotlar» + «Jami N ta mahsulot», asosiy amal «Mahsulot yaratish» (`canCreateProducts`): xodim —
 * «Marketni tanlang» oynasi → `/products/create-product/:marketId`; market — o'z id'si bilan to'g'ridan-to'g'ri.
 * Karta: qidiruv (URL `product_search`, 1 s kutish, sahifa 1) + xodimda «Market: Barchasi» (URL `market_id`, sahifa 1);
 * jadval «# · Mahsulot nomi · Market · amallar» (nom bo'yicha saralash — joriy sahifa ichida, avvalgidek), telefonda
 * kartalar; sahifalash (URL `page` / `limit`).
 *
 * So'rovlar: xodim — `GET product?page&limit&search&market_id`, faol marketlar `GET markets?status=active&limit=100`
 * (filtr va tanlash oynasi uchun); market — `GET product/my-products?page&limit&search`. Tahrirlash — oyna
 * (`EditProductDialog`), o'chirish — tasdiq oynasi (`useDeleteProductConfirm`).
 */
const ProductTable = () => {
  const { t, i18n } = useTranslation("products");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const roleState = useSelector((state: RootState) => state.role);
  const profile = useSelector((state: RootState) => state.user.user);
  const isRoleResolved = Boolean(roleState.role);
  const isMarketRole = roleState.role === "market";
  // Backend `POST /product` registrator va menejerga ham ochiq (market_id majburiy) — ular ham market tanlab yaratadi.
  const canCreate = useSelector(canCreateProducts);
  const marketUserId = roleState.id ?? profile?.id;
  const [showMarketSelect, setShowMarketSelect] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [sort, setSort] = useState<DataTableSort | null>(null);
  const confirmDelete = useDeleteProductConfirm();

  // ─── Faol marketlar (faqat xodim: filtr va tanlash oynasi) ───────────────────
  const { useGetMarkets } = useMarkets();
  const marketsQuery = useGetMarkets({ status: "active", limit: 100 }, isRoleResolved && !isMarketRole);
  const markets = useMemo<ProductMarket[]>(
    () => toProductMarkets(marketsQuery.data).filter((market) => !isInactiveMarketStatus(market.status)),
    [marketsQuery.data],
  );
  const marketOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("v2.list.all") },
      ...markets.map((market) => ({ value: String(market.id), label: market.name })),
    ],
    [markets, t],
  );

  // ─── URL: qidiruv, market, sahifa ────────────────────────────────────────────
  const { getAllParams, setMultipleParams } = useQueryParams();
  const { page, limit, setPage, setLimit } = usePagination({ key: "products", defaultLimit: 10 });
  const allParams = getAllParams();
  // URL — qidiruv va market filtrining YAGONA manbai: F5, havola va orqaga/oldinga o'tish bir xil natija beradi.
  // Qidiruv Redux'da saqlanmaydi: `useResetInputsOnPathChange` yo'l o'zgarganda Redux qidiruvlarini tozalaydi.
  const searchFromUrl = allParams.product_search ?? "";
  const marketIdFromUrl = allParams.market_id ?? "";
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  // URL tashqaridan o'zgargandagina (orqaga/oldinga, havola) maydon yangilanadi — yozilayotgan matnga tegilmaydi.
  const [syncedSearch, setSyncedSearch] = useState(searchFromUrl);
  if (searchFromUrl !== syncedSearch) {
    setSyncedSearch(searchFromUrl);
    setSearchInput(searchFromUrl);
  }

  // Qidiruv va 1-sahifa bitta URL yangilanishida yoziladi.
  const writeSearchToUrl = useCallback(
    (value: string) => {
      setSyncedSearch(value);
      setMultipleParams({ product_search: value, page: "" });
    },
    [setMultipleParams],
  );
  const writeSearchDebounced = useDebounce(writeSearchToUrl, SEARCH_DEBOUNCE_MS);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    writeSearchDebounced(value);
  };

  // Tanlangan market va 1-sahifa BITTA URL yangilanishida yoziladi (× — «Barchasi»).
  const handleMarketFilterChange = (value: string | null) => {
    setMultipleParams({ market_id: value ?? "", page: "" });
  };

  const clearFilters = () => {
    setSearchInput("");
    setSyncedSearch("");
    setMultipleParams({ product_search: "", market_id: "", page: "" });
  };

  // ─── Mahsulotlar ─────────────────────────────────────────────────────────────
  const apiParams = useMemo(() => {
    const params: Record<string, string | number> = { page, limit };
    if (searchFromUrl) params.search = searchFromUrl;
    if (!isMarketRole && marketIdFromUrl) params.market_id = marketIdFromUrl;
    return params;
  }, [isMarketRole, limit, marketIdFromUrl, page, searchFromUrl]);
  const myProductsParams = useMemo(
    () => ({ page, limit, ...(searchFromUrl ? { search: searchFromUrl } : {}) }),
    [limit, page, searchFromUrl],
  );

  const { useGetProducts, useGetMyProducts } = useProducts();
  // Xato ro'yxat kartasida (`ErrorState`) — global xabar takrorlanmaydi.
  const staffQuery = useGetProducts(apiParams, isRoleResolved && !isMarketRole, { silentError: true });
  const marketQuery = useGetMyProducts(isRoleResolved && isMarketRole, myProductsParams, {
    keepPreviousData: true,
    silentError: true,
  });
  const productsQuery = isMarketRole ? marketQuery : staffQuery;
  const response = productsQuery.data;

  const productRows = useMemo(() => (response === undefined ? undefined : getProductList(response)), [response]);
  const meta = useMemo(() => getProductMeta(response, { page, limit }), [limit, page, response]);
  const offset = ((meta?.page ?? page) - 1) * (meta?.limit ?? limit);

  // Oxirgi sahifadagi oxirgi mahsulot o'chirilsa (yoki URL'dagi sahifa endi yo'q) — mavjud oxirgi sahifaga.
  const lastPage = meta && meta.total > 0 ? Math.ceil(meta.total / meta.limit) : null;
  const pageOutOfRange = Boolean(productRows && productRows.length === 0 && lastPage !== null && page > lastPage);
  useEffect(() => {
    if (pageOutOfRange && lastPage !== null) setPage(lastPage);
  }, [lastPage, pageOutOfRange, setPage]);

  // Nom bo'yicha saralash — joriy sahifa ichida (server faqat «yangilari tepada» qaytaradi; avvalgi jadval ham shunday).
  const rows = useMemo(() => {
    if (!productRows || !sort) return productRows;
    const sorted = [...productRows].sort((a, b) => a.name.localeCompare(b.name, language, { sensitivity: "base" }));
    return sort.direction === "desc" ? sorted.reverse() : sorted;
  }, [language, productRows, sort]);
  const rowNumber = useMemo(() => {
    const order = new Map(productRows?.map((product, index) => [product.id, offset + index + 1]));
    return (product: Product) => order.get(product.id) ?? 0;
  }, [offset, productRows]);

  // ─── Amallar ─────────────────────────────────────────────────────────────────
  const handleCreate = () => {
    if (isMarketRole) {
      if (!marketUserId) {
        notify.warning(t("marketNotResolved"), { description: t("marketNotResolvedDescription") });
        return;
      }
      navigate(`/products/create-product/${marketUserId}`);
      return;
    }
    setShowMarketSelect(true);
  };

  const handleSelectMarket = useCallback(
    (market: ProductMarket) => {
      setShowMarketSelect(false);
      navigate(`/products/create-product/${market.id}`);
    },
    [navigate],
  );

  const handleDelete = useCallback(
    async (product: Product) => {
      if (await confirmDelete(product, getProductMarketName(product))) {
        notify.success(t("deleteSuccess"));
      }
    },
    [confirmDelete, t],
  );

  const actions = useCallback(
    (product: Product) => (
      <span className="flex shrink-0 items-center justify-end gap-1 max-md:gap-0">
        <IconButton
          size="sm"
          icon={Pencil}
          label={t("v2.list.editAria", { name: product.name })}
          onClick={() => setEditTarget(product)}
        />
        <IconButton
          size="sm"
          variant="danger"
          icon={Trash2}
          label={t("v2.list.deleteAria", { name: product.name })}
          onClick={() => void handleDelete(product)}
        />
      </span>
    ),
    [handleDelete, t],
  );

  const columns = useMemo<DataTableColumn<Product>[]>(() => {
    const list: DataTableColumn<Product>[] = [
      {
        id: "index",
        header: t("v2.list.columns.index"),
        className: "w-16",
        cell: (product) => <span className="font-semibold text-text-subtle">{rowNumber(product)}</span>,
      },
      {
        id: NAME_SORT_KEY,
        header: t("v2.list.columns.name"),
        sortable: true,
        sortTitle: t("v2.list.sortByName"),
        cell: (product) => (
          <span className="flex min-w-0 items-center gap-3">
            <ProductThumb product={product} />
            <span className="min-w-0 font-semibold text-text wrap-break-word">{product.name}</span>
          </span>
        ),
      },
    ];
    if (!isMarketRole) {
      list.push({
        id: "market",
        header: t("v2.list.columns.market"),
        className: "w-[36%]",
        cell: (product) => {
          const name = getProductMarketName(product);
          return (
            <span className="inline-flex min-w-0 items-center gap-2">
              <Store size={18} strokeWidth={2} aria-hidden="true" className="shrink-0 text-text-subtle" />
              {name ?? <span className="text-text-subtle">—</span>}
            </span>
          );
        },
      });
    }
    list.push({
      id: "actions",
      header: <span className="sr-only">{t("v2.list.columns.actions")}</span>,
      className: "w-[104px]",
      cellClassName: "text-right",
      cell: actions,
    });
    return list;
  }, [actions, isMarketRole, rowNumber, t]);

  // Telefon kartasi (maket `.el-list-item`): ikonka · nom (+ market) · tahrirlash, o'chirish.
  const renderCard = useCallback(
    (product: Product) => {
      const marketName = isMarketRole ? null : getProductMarketName(product);
      return (
        <div className="flex min-h-14 items-center gap-3 py-2.5 pl-4 pr-2">
          <ProductThumb product={product} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
            <span className="font-semibold text-text wrap-break-word">{product.name}</span>
            {marketName ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-text-muted">
                <Store size={14} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{marketName}</span>
              </span>
            ) : null}
          </span>
          {actions(product)}
        </div>
      );
    },
    [actions, isMarketRole],
  );

  const handleSortChange = useCallback((next: DataTableSort | null) => {
    setSort(next && next.key === NAME_SORT_KEY ? next : null);
  }, []);

  // ─── Ko'rinish ───────────────────────────────────────────────────────────────
  const isLoading = !isRoleResolved || productsQuery.isLoading;
  const total = meta?.total;
  const description =
    total !== undefined ? (
      t("v2.list.total", { count: total, value: formatNumberLocalized(total, { language }) })
    ) : isLoading ? (
      <Skeleton width={128} height={14} className="inline-block align-middle" />
    ) : null;
  const hasFilters = Boolean(searchFromUrl) || (!isMarketRole && Boolean(marketIdFromUrl));

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("title")}
        description={description}
        actions={
          canCreate ? (
            <Button leftIcon={Plus} onClick={handleCreate}>
              {t("v2.list.create")}
            </Button>
          ) : undefined
        }
      />

      <Card
        as="section"
        padding="none"
        aria-label={t("v2.list.listLabel")}
        footer={
          meta && meta.total > 0 ? (
            <Pagination
              page={meta.page}
              pageSize={meta.limit}
              total={meta.total}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
              summary={(range) => t("v2.list.pagination", range)}
            />
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 max-md:px-4">
          <Field
            label={isMarketRole ? t("v2.list.searchAriaMarket") : t("v2.list.searchAria")}
            hideLabel
            className="min-w-0 flex-[10_1_320px]"
          >
            <TextInput
              mode="search"
              name="product_search"
              value={searchInput}
              onValueChange={handleSearchChange}
              onClear={() => writeSearchToUrl("")}
              onSearch={writeSearchToUrl}
              placeholder={t("v2.list.searchPlaceholder")}
              autoComplete="off"
            />
          </Field>
          {!isMarketRole ? (
            <Field
              id="market_id"
              label={t("v2.list.marketFilter")}
              hideLabel
              labelAs="span"
              className="min-w-0 flex-[1_1_220px] md:max-w-[340px]"
            >
              <Select
                options={marketOptions}
                value={marketIdFromUrl || null}
                onChange={handleMarketFilterChange}
                placeholder={t("v2.list.all")}
                inlineLabel={t("v2.list.marketFilter")}
                icon={Store}
                searchable={markets.length > 8}
                loading={marketsQuery.isLoading}
              />
            </Field>
          ) : null}
        </div>

        <QueryBoundary
          query={{
            data: rows,
            isLoading,
            isError: productsQuery.isError,
            error: productsQuery.error,
            refetch: productsQuery.refetch,
          }}
          loadingLabel={t("v2.list.loading")}
          loading={
            <SkeletonTable
              framed={false}
              columns={
                isMarketRole
                  ? [t("v2.list.columns.index"), t("v2.list.columns.name")]
                  : [t("v2.list.columns.index"), t("v2.list.columns.name"), t("v2.list.columns.market")]
              }
              rows={8}
            />
          }
          empty={
            hasFilters ? (
              <EmptyState
                icon={SearchX}
                title={t("v2.list.filteredEmpty")}
                description={t("v2.list.filteredEmptyDescription")}
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    {t("filters.clearAll", { ns: "ui" })}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Tag}
                title={t("v2.list.empty")}
                description={canCreate ? t("v2.list.emptyDescription") : undefined}
              />
            )
          }
          error={(error, retry) => <ErrorState error={error} title={t("v2.list.loadFailed")} onRetry={retry} />}
          className="border-t border-border"
        >
          {(list, { isRefetching }) => (
            <DataTable
              rows={list}
              columns={columns}
              getRowKey={(product) => String(product.id)}
              label={t("v2.list.listLabel")}
              cardsLabel={t("v2.list.cardsLabel")}
              sort={sort}
              onSortChange={handleSortChange}
              renderCard={renderCard}
              busy={isRefetching}
            />
          )}
        </QueryBoundary>
      </Card>

      {!isMarketRole ? (
        <SelectMarketDialog
          open={showMarketSelect}
          markets={markets}
          isLoading={marketsQuery.isLoading}
          isError={marketsQuery.isError}
          error={marketsQuery.error}
          onRetry={() => void marketsQuery.refetch()}
          onClose={() => setShowMarketSelect(false)}
          onConfirm={handleSelectMarket}
        />
      ) : null}

      <EditProductDialog product={editTarget} isMarketRole={isMarketRole} onClose={() => setEditTarget(null)} />
    </div>
  );
};

export default memo(ProductTable);
