// dizayn-v2: (maket yo'q) market-operators-list
import { useTranslation } from "react-i18next";
import { useUpdateMarketOperatorWarehouseAccess, type MarketOperator } from "../../../entities/market-operator";
import { cx } from "../../../shared/lib/cx";
import { notify } from "../../../shared/lib/notify";
import { Pressable, Spinner } from "../../../shared/ui/primitives";
import { httpStatusOf } from "../model/httpStatus";

type WarehouseAccessSwitchProps = {
  operator: MarketOperator;
  /** `table` — jadval katagi (kalit + «Ko'radi»), `card` — telefon kartasidagi qator (yorliq chapda, kalit o'ngda). */
  layout: "table" | "card";
};

/**
 * «OMBORDAGI QOLDIQNI KO'RADI» — operator qatoridagi kalit (XtcEyQjb; ega qarori: market har operatorga alohida
 * yoqadi, sukut o'chiq). Maket yo'q — eng yaqini `market-operators-list` qatori + kalit retsepti
 * `superadmin-users-edit-market-warehouse` (`.el-switch`, `role="switch"`, bosish maydoni 44 px).
 *
 * OPTIMISTIK EMAS: bosilganda kalit server javobigacha eski holatda turadi (band — spinner, qayta bosib bo'lmaydi);
 * `PATCH /market-operators/:id/warehouse-access` muvaffaqiyatli bo'lsa — yangi holat va xabar, xato bo'lsa — kalit
 * o'zgarmaydi va i18n xabar (404 — ro'yxat yangilanadi).
 */
export const WarehouseAccessSwitch = ({ operator, layout }: WarehouseAccessSwitchProps) => {
  const { t } = useTranslation("marketOperators");
  const update = useUpdateMarketOperatorWarehouseAccess();
  const checked = operator.can_view_warehouse_stock;
  const pending = update.isPending;

  const toggle = () => {
    if (pending) return;
    const enabled = !checked;
    update.mutate(
      { id: operator.id, enabled },
      {
        onSuccess: (saved) =>
          notify.success(t(saved.can_view_warehouse_stock ? "warehouseAccess.enabled" : "warehouseAccess.disabled"), {
            description: operator.name,
          }),
        onError: (error) =>
          notify.error(t("warehouseAccess.failedTitle"), {
            description: t(httpStatusOf(error) === 404 ? "warehouseAccess.notFound" : "warehouseAccess.failed"),
          }),
      },
    );
  };

  const control = (
    <Pressable
      role="switch"
      aria-checked={checked}
      aria-label={t("warehouseAccess.labelFor", { name: operator.name })}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={toggle}
      className="group relative inline-flex h-11 w-12 shrink-0 items-center justify-center disabled:cursor-progress"
    >
      <span
        aria-hidden="true"
        className={cx(
          "relative h-5 w-9 rounded-full transition-colors duration-150 motion-reduce:transition-none group-disabled:opacity-60",
          checked ? "bg-action" : "bg-border-strong",
        )}
      >
        <span
          className={cx(
            "absolute left-0.5 top-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 motion-reduce:transition-none",
            checked && "translate-x-4",
          )}
        />
      </span>
    </Pressable>
  );

  if (layout === "card") {
    return (
      <div className="flex min-w-0 items-center justify-between gap-3 rounded-[10px] bg-sunken py-0.5 pr-1 pl-3">
        <span aria-hidden="true" className="min-w-0 text-[13px] text-text">
          {t("warehouseAccess.label")}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1">
          {pending ? <Spinner size="sm" /> : null}
          {control}
        </span>
      </div>
    );
  }

  return (
    <span className="-my-2 -ml-1.5 inline-flex items-center gap-1 whitespace-nowrap">
      {control}
      <span className={cx("text-[13px]", checked ? "text-text" : "text-text-muted")} aria-hidden="true">
        {checked ? t("warehouseAccess.on") : t("warehouseAccess.off")}
      </span>
      {pending ? <Spinner size="sm" /> : null}
    </span>
  );
};
