// dizayn-v2: (maket yo'q) superadmin-warehouse-stock-in-dialog
import { useState } from "react";
import { Link2, SearchX, Store } from "lucide-react";
import { useProducts } from "../../../../entities/product";
import { getErrorStatus } from "../../../../shared/lib/errorKind";
import { notify } from "../../../../shared/lib/notify";
import { cx } from "../../../../shared/lib/cx";
import { Button, Dialog, EmptyState, Field, SkeletonLines, TextInput } from "../../../../shared/ui/primitives";
import { useWarehouseText } from "../../model/useWarehouseText";
import { useProductSuggestions, type ProductSuggestion } from "../model/useProductSuggestions";

export type LinkBarcodeDialogProps = {
  /** Bog'lanadigan zavod shtrix kodi (`null` — oyna yopiq). */
  code: string | null;
  marketId: string | null;
  marketName: string | null;
  onClose: () => void;
  /** Kod mahsulotga yozildi — chaqiruvchi kodni qayta qidiradi (`lookup`) va qatorni qo'shadi. */
  onLinked: (code: string, product: ProductSuggestion) => void;
};

const OPTION =
  "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-left " +
  "transition-[background-color,border-color] duration-150 motion-reduce:transition-none hover:bg-sunken " +
  "has-checked:border-action has-checked:bg-action-soft";

/**
 * «MAHSULOTGA BOG'LASH» — kirimda topilmagan zavod shtrix kodi (ega qarori 11: «zavod kodi kirimda skanerlanib
 * mahsulotga bog'lanadi»). Maket yo'q — eng yaqini `superadmin-warehouse-stock-in-dialog` (sariq qatordagi tugma):
 * mahsulot nomi bo'yicha qidiruv (tanlangan market bo'lsa — shu market), ro'yxatdan bittasi → «Kodni bog'lash» →
 * `PATCH /product/:id { barcode }`. 409 — kod shu marketning boshqa mahsulotida; 400 — kod noto'g'ri (nazorat
 * raqami). Mahsulotda boshqa shtrix kod bo'lsa — almashtirilishi aytiladi.
 */
export const LinkBarcodeDialog = ({ code, marketId, marketName, onClose, onLinked }: LinkBarcodeDialogProps) => {
  const text = useWarehouseText();
  const { t } = text;
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProductSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { updateProduct } = useProducts();
  const suggestions = useProductSuggestions(search, marketId, Boolean(code));

  const reset = () => {
    setSearch("");
    setSelected(null);
    setError(null);
  };

  const close = () => {
    if (updateProduct.isPending) return;
    reset();
    onClose();
  };

  const submit = async () => {
    if (!code || !selected || updateProduct.isPending) return;
    setError(null);
    const data = new FormData();
    data.append("barcode", code);
    try {
      await updateProduct.mutateAsync({ id: Number(selected.id), data });
      notify.success(t("link.success"), { description: t("link.successText", { code, name: selected.name }) });
      const product = selected;
      reset();
      onLinked(code, product);
    } catch (submitError) {
      const status = getErrorStatus(submitError);
      setError(status === 409 ? t("link.errors.taken") : status === 400 ? t("link.errors.invalid") : text.writeError(submitError));
    }
  };

  const busy = updateProduct.isPending;
  const query = search.trim();

  return (
    <Dialog
      open={Boolean(code)}
      onClose={close}
      busy={busy}
      size="md"
      icon={Link2}
      title={t("link.title")}
      description={code ? t("link.description", { code }) : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            {t("actions.cancel")}
          </Button>
          <Button type="submit" leftIcon={Link2} loading={busy} disabled={!selected}>
            {t("link.submit")}
          </Button>
        </>
      }
    >
      <Field label={t("link.search")} hint={marketName ? t("link.searchHintMarket", { market: marketName }) : t("link.searchHint")}>
        <TextInput
          mode="search"
          value={search}
          onValueChange={(value) => {
            setSearch(value);
            setSelected(null);
          }}
          placeholder={t("link.searchPlaceholder")}
          autoComplete="off"
          readOnly={busy}
        />
      </Field>
      {query.length < 2 ? (
        <p className="m-0 text-[13px] text-text-muted">{t("link.typeToSearch")}</p>
      ) : suggestions.isFetching && suggestions.items.length === 0 ? (
        <SkeletonLines lines={3} />
      ) : suggestions.items.length === 0 ? (
        <EmptyState icon={SearchX} size="inline" title={t("link.notFound")} />
      ) : (
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="sr-only">{t("link.choose")}</legend>
          {suggestions.items.map((product) => (
            <label key={product.id} className={cx(OPTION)}>
              <input
                type="radio"
                name="link-product"
                value={product.id}
                checked={selected?.id === product.id}
                onChange={() => setSelected(product)}
                disabled={busy}
                className="size-[18px] shrink-0 accent-action"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold text-text">{product.name}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
                  {product.marketName ? (
                    <span className="inline-flex items-center gap-1">
                      <Store size={14} aria-hidden="true" />
                      {product.marketName}
                    </span>
                  ) : null}
                  {product.skuCode ? <span className="font-mono">{product.skuCode}</span> : null}
                  {product.barcode ? (
                    <span className="text-warning-fg">{t("link.replaces", { code: product.barcode })}</span>
                  ) : null}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {error ? (
        <p role="alert" className="m-0 text-[13px] font-semibold text-danger-fg">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
};
