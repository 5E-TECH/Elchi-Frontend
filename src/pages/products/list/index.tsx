// dizayn-v2: superadmin-products-list, admin-products-list, manager-products-list, registrator-products-list, market-products-list, market_operator-products-list, market_operator-products-unassigned, superadmin-products-select-market-dialog, admin-products-market-select-dialog, manager-products-market-select-dialog, registrator-products-market-select-dialog, superadmin-products-edit-dialog, admin-products-edit-dialog, manager-products-edit-dialog, registrator-products-edit-dialog, superadmin-products-delete-dialog, admin-products-delete-dialog, manager-products-delete-dialog, registrator-products-delete-dialog
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Lock, Pencil, Plus, RefreshCw, SearchX, Store, Tag, Trash2, Unlink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { canCreateProducts } from "../../../app/lib/access";
import { useProducts } from "../../../entities/product";
import { ProductThumb } from "../../../entities/product/ui/ProductThumb";
import { useMarkets } from "../../../entities/markets";
import { isMarketSideRole } from "../../../entities/user/lib/role";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { isInactiveMarketStatus } from "../../../shared/lib/marketStatus";
import { cx } from "../../../shared/lib/cx";
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
  getProductImageUrl,
  getProductList,
  getProductMarketName,
  getProductMeta,
  toProductMarkets,
  type Product,
  type ProductMarket,
} from "../model/productView";
import { ProductBillable, ProductDimensions, ProductWeight } from "../ui/ProductMeasureCells";
import { ProductPrice } from "../ui/ProductPrice";
import { useDeleteProductConfirm } from "../ui/useDeleteProductConfirm";
import { EditProductDialog } from "./ui/EditProductDialog";
import { SelectMarketDialog } from "./ui/SelectMarketDialog";

// Qidiruv URL'ga (va so'rovga) yozishdan oldingi kutish — avvalgidek (GlobalSearchInput global rejimi).
const SEARCH_DEBOUNCE_MS = 1000;
const NAME_SORT_KEY = "name";

/** «Narx» katagi (jadval va karta). */
const priceCell = (product: Product) => <ProductPrice product={product} />;

/**
 * MAHSULOTLAR — `/products` (superadmin, admin, menejer, registrator; market va market operatori — faqat ko'rish),
 * dizayn v2.
 *
 * Maketlar: `superadmin-products-list` (= admin, menejer, registrator — `admin--products-list`), `market-products-list`
 * (= `market_operator-products-list`), `market_operator-products-unassigned`.
 * Xodim: sarlavha «Mahsulotlar» + «Jami N ta mahsulot», asosiy amal «Mahsulot yaratish» (`canCreateProducts`) —
 * «Marketni tanlang» oynasi → `/products/create-product/:marketId`; karta: qidiruv (URL `product_search`, 1 s kutish,
 * sahifa 1) + «Market: Barchasi» (URL `market_id`, sahifa 1); jadval «# · Mahsulot nomi · Market · Narx · amallar»
 * (planshetda < 1024 «Market» ustuni yashirin — market nomi mahsulot nomi ostida `Store` bilan) + o'lchov ustunlari,
 * telefonda kartalar.
 * Market va market operatori (MH-1, ega qarori 2026-10-15): yaratish, «Amallar», tahrirlash va o'chirish yo'q;
 * qidiruv yonida «Faqat ko'rish…» izohi; sarlavhada «Jami N ta mahsulot · <market>» (market — profil nomi, operatorda
 * qatordagi `market.name`); jadval «# · Mahsulot nomi · Narx». Operator marketga biriktirilmagan bo'lsa
 * (`GET product/my-products` → 400) — «Siz hali marketga biriktirilmagansiz» + «Qayta tekshirish».
 * O'lchov ustunlari (6FLyjO6j, backend MH-3): «Og'irlik» va «O'lcham, sm» (planshetda yashirin), «Hisob vazni»
 * (qalin + «og'irlik bo'yicha» / «hajm bo'yicha» / «hajm hisobga olinmaydi»); o'lchovsiz eski mahsulot —
 * «Kiritilmagan» (`warning`). Telefon kartasida narx ostida «0,2 kg · og'irlik bo'yicha».
 *
 * So'rovlar: xodim — `GET product?page&limit&search&market_id`, faol marketlar `GET markets?status=active&limit=100`
 * (filtr va tanlash oynasi uchun); market va operator — `GET product/my-products?page&limit&search`. Tahrirlash —
 * oyna (`EditProductDialog`), o'chirish — tasdiq oynasi (`useDeleteProductConfirm`).
 */
const ProductTable = () => {
  const { t, i18n } = useTranslation("products");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const roleState = useSelector((state: RootState) => state.role);
  const profile = useSelector((state: RootState) => state.user.user);
  const isRoleResolved = Boolean(roleState.role);
  // Market va uning operatori — o'z marketining mahsulotlari, faqat ko'rish (MH-1).
  const isMarketSide = isMarketSideRole(roleState.role);
  const isOperator = roleState.role === "market_operator";
  // Yaratish, tahrirlash va o'chirish — faqat xodim (`canCreateProducts`: superadmin, admin, registrator, menejer).
  const canManage = useSelector(canCreateProducts);
  const [showMarketSelect, setShowMarketSelect] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [sort, setSort] = useState<DataTableSort | null>(null);
  const confirmDelete = useDeleteProductConfirm();

  // ─── Faol marketlar (faqat xodim: filtr va tanlash oynasi) ───────────────────
  const { useGetMarkets } = useMarkets();
  const marketsQuery = useGetMarkets({ status: "active", limit: 100 }, isRoleResolved && !isMarketSide);
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
    if (!isMarketSide && marketIdFromUrl) params.market_id = marketIdFromUrl;
    return params;
  }, [isMarketSide, limit, marketIdFromUrl, page, searchFromUrl]);
  const myProductsParams = useMemo(
    () => ({ page, limit, ...(searchFromUrl ? { search: searchFromUrl } : {}) }),
    [limit, page, searchFromUrl],
  );

  const { useGetProducts, useGetMyProducts } = useProducts();
  // Xato ro'yxat kartasida (`ErrorState`) — global xabar takrorlanmaydi.
  const staffQuery = useGetProducts(apiParams, isRoleResolved && !isMarketSide, { silentError: true });
  const marketQuery = useGetMyProducts(isRoleResolved && isMarketSide, myProductsParams, {
    keepPreviousData: true,
    silentError: true,
  });
  const productsQuery = isMarketSide ? marketQuery : staffQuery;
  // Operator hech qaysi marketga biriktirilmagan: backend `my-products` ga 400 qaytaradi (`market_id` yo'q).
  const isUnassigned = isOperator && productsQuery.isError && getErrorStatus(productsQuery.error) === 400;
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
  const handleCreate = () => setShowMarketSelect(true);

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
        cell: (product) => {
          // Planshetda (< 1024) «Market» ustuni yashirin — market nomi mahsulot nomi ostida (maket `.el-show-tablet`).
          const marketName = isMarketSide ? null : getProductMarketName(product);
          return (
            <span className="flex min-w-0 items-center gap-3">
              <ProductThumb imageUrl={getProductImageUrl(product)} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="min-w-0 font-semibold text-text wrap-break-word">{product.name}</span>
                {marketName ? (
                  <span className="hidden min-w-0 items-center gap-1.5 text-[13px] text-text-muted max-lg:inline-flex">
                    <Store size={14} strokeWidth={2} aria-hidden="true" className="shrink-0 text-text-subtle" />
                    <span className="truncate">{marketName}</span>
                  </span>
                ) : null}
              </span>
            </span>
          );
        },
      },
    ];
    if (!isMarketSide) {
      list.push({
        id: "market",
        header: t("v2.list.columns.market"),
        hideBelow: "lg",
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
    list.push(
      {
        id: "price",
        header: t("v2.list.columns.price"),
        align: "end",
        className: "w-[160px]",
        cell: priceCell,
      },
      {
        id: "weight",
        header: t("v2.list.columns.weight"),
        align: "end",
        hideBelow: "lg",
        className: "whitespace-nowrap",
        cell: (product) => <ProductWeight product={product} />,
      },
      {
        id: "dimensions",
        header: t("v2.list.columns.dimensions"),
        hideBelow: "lg",
        className: "whitespace-nowrap",
        cell: (product) => <ProductDimensions product={product} />,
      },
      {
        id: "billable",
        header: t("v2.list.columns.billable"),
        cell: (product) => <ProductBillable product={product} />,
      },
    );
    if (canManage) {
      list.push({
        id: "actions",
        header: <span className="sr-only">{t("v2.list.columns.actions")}</span>,
        className: "w-[104px]",
        cellClassName: "text-right",
        cell: actions,
      });
    }
    return list;
  }, [actions, canManage, isMarketSide, rowNumber, t]);

  // Telefon kartasi (maket `.el-list-item`): ikonka · nom (+ market, xodimda) · narx · tahrirlash, o'chirish (xodimda).
  const renderCard = useCallback(
    (product: Product) => {
      const marketName = isMarketSide ? null : getProductMarketName(product);
      return (
        <div className={cx("flex min-h-14 items-start gap-3 py-2.5 pl-4", canManage ? "pr-2" : "pr-4")}>
          <ProductThumb imageUrl={getProductImageUrl(product)} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
            <span className="font-semibold text-text wrap-break-word">{product.name}</span>
            {marketName ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-text-muted">
                <Store size={14} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{marketName}</span>
              </span>
            ) : null}
            <span className="flex flex-col items-start gap-1 text-[13px] text-text-muted">
              <span className="whitespace-nowrap">
                <ProductPrice product={product} />
              </span>
              <ProductBillable product={product} layout="inline" />
            </span>
          </span>
          {canManage ? actions(product) : null}
        </div>
      );
    },
    [actions, canManage, isMarketSide],
  );

  const handleSortChange = useCallback((next: DataTableSort | null) => {
    setSort(next && next.key === NAME_SORT_KEY ? next : null);
  }, []);

  // ─── Ko'rinish ───────────────────────────────────────────────────────────────
  const isLoading = !isRoleResolved || productsQuery.isLoading;
  const total = meta?.total;
  // Market tomonida sarlavhada market nomi: market — o'z profili nomi, operator — qatordagi `market.name`.
  const ownMarketName = isMarketSide
    ? (productRows?.map(getProductMarketName).find(Boolean) ??
      (isOperator ? null : (profile?.name?.trim() || null)))
    : null;
  const totalText =
    total !== undefined ? t("v2.list.total", { count: total, value: formatNumberLocalized(total, { language }) }) : null;
  const description = isUnassigned ? (
    t("v2.list.unassignedSubtitle")
  ) : totalText ? (
    ownMarketName ? (
      t("v2.list.totalWithMarket", { total: totalText, market: ownMarketName })
    ) : (
      totalText
    )
  ) : isLoading ? (
    <Skeleton width={128} height={14} className="inline-block align-middle" />
  ) : null;
  const hasFilters = Boolean(searchFromUrl) || (!isMarketSide && Boolean(marketIdFromUrl));

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("title")}
        description={description}
        actions={
          canManage ? (
            <Button leftIcon={Plus} onClick={handleCreate}>
              {t("v2.list.create")}
            </Button>
          ) : undefined
        }
      />

      {isUnassigned ? (
        <Card as="section" padding="none" aria-label={t("v2.list.listLabel")}>
          <EmptyState
            icon={Unlink}
            title={t("v2.list.unassignedTitle")}
            description={t("v2.list.unassignedDescription")}
            action={
              <Button
                variant="secondary"
                leftIcon={RefreshCw}
                loading={productsQuery.isFetching}
                loadingText={t("v2.list.unassignedChecking")}
                onClick={() => void productsQuery.refetch()}
              >
                {t("v2.list.unassignedRetry")}
              </Button>
            }
          />
        </Card>
      ) : (
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
            label={isMarketSide ? t("v2.list.searchAriaMarket") : t("v2.list.searchAria")}
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
          {!isMarketSide ? (
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
          ) : (
            // Market tomoni — faqat ko'rish (maket `market-products-list`: qulf + izoh qidiruv yonida).
            <p className="flex min-w-0 flex-[1_1_240px] items-center gap-2 text-[13px] leading-[18px] text-text-muted">
              <Lock size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 text-text-subtle" />
              <span className="min-w-0">{t("v2.list.readOnlyHint")}</span>
            </p>
          )}
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
                isMarketSide
                  ? [
                      t("v2.list.columns.index"),
                      t("v2.list.columns.name"),
                      t("v2.list.columns.price"),
                      t("v2.list.columns.billable"),
                    ]
                  : [
                      t("v2.list.columns.index"),
                      t("v2.list.columns.name"),
                      t("v2.list.columns.market"),
                      t("v2.list.columns.price"),
                      t("v2.list.columns.billable"),
                    ]
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
                description={canManage ? t("v2.list.emptyDescription") : undefined}
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
      )}

      {canManage ? (
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

      {canManage ? <EditProductDialog product={editTarget} onClose={() => setEditTarget(null)} /> : null}
    </div>
  );
};

export default memo(ProductTable);
