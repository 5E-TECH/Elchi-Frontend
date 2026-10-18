// dizayn-v2: registrator-dispatch-courier-select-dialog, manager-dispatch-courier-dialog
import { useId, useMemo, useState } from "react";
import { SearchX, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { Button, Dialog, EmptyState, TextInput } from "../../../shared/ui/primitives";
import { filterCouriers, type DispatchCourier } from "../model/dispatchModel";

type CourierPickerDialogProps = {
  open: boolean;
  couriers: readonly DispatchCourier[];
  /** Biriktiriladigan (tanlangan) buyurtmalar soni. */
  count: number;
  /** Filial nomi (faqat filialga bog'langan rollarda — ro'yxat sarlavhasi «… filialining faol kuryerlari»). */
  branchName: string | null;
  /** Biriktirish so'rovi ketmoqda — oyna yopilmaydi, tugma yuklanishda. */
  pending: boolean;
  onClose: () => void;
  onAssign: (courier: DispatchCourier) => void;
};

/**
 * KURYER TANLASH OYNASI — `Dialog` (`size="lg"`, telefonda pastki varaqa). Maketlar
 * `registrator-dispatch-courier-select-dialog`, `manager-dispatch-courier-dialog`.
 *
 *  - Qidiruv — yuklangan (≤ 100 ta) kuryerlar ichida, ism va telefon bo'yicha (so'rovsiz).
 *  - Bitta tanlov — `radiogroup` (oddiy radio: ← → ↑ ↓ bilan almashadi). Kuryer qatori: ism + «viloyat · telefon»
 *    (`GET /couriers` tumanni bermaydi — viloyat ko'rsatiladi).
 *  - «Biriktirish — N ta» kuryer tanlanguncha o'chiq; so'rov ketayotganda yuklanishda, oyna yopilmaydi.
 *    Xato bo'lsa oyna ochiq qoladi (xabar sahifada — `notify.error`).
 *
 * Oynaning ichki holati (qidiruv, tanlov) har ochilishda yangidan — sahifa `key` bilan qayta o'rnatadi.
 */
export const CourierPickerDialog = ({
  open,
  couriers,
  count,
  branchName,
  pending,
  onClose,
  onAssign,
}: CourierPickerDialogProps) => {
  const { t } = useTranslation("dispatch");
  const groupName = useId();
  const listLabelId = useId();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => filterCouriers(couriers, query), [couriers, query]);
  // Faqat ko'rinib turgan tanlov hisoblanadi: qidiruv tanlangan kuryerni yashirsa, «Biriktirish» o'chadi —
  // ko'rinmaydigan kuryerga adashib biriktirilmasin (qidiruv tozalansa tanlov qaytadi).
  const selected = visible.find((courier) => courier.id === selectedId) ?? null;
  const listLabel = branchName
    ? t("courierDialog.listBranch", { branch: branchName, count: couriers.length })
    : t("courierDialog.list", { count: couriers.length });

  const handleAssign = () => {
    if (!selected || pending) return;
    onAssign(selected);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      icon={Truck}
      title={t("courierDialog.title")}
      description={t("courierDialog.description", { count })}
      busy={pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t("courierDialog.cancel")}
          </Button>
          <Button
            leftIcon={Truck}
            disabled={!selected}
            loading={pending}
            loadingText={t("page.assigning")}
            onClick={handleAssign}
          >
            {t("courierDialog.assign", { count })}
          </Button>
        </>
      }
    >
      <div className="sticky top-0 z-10 -mx-1 bg-raised px-1 pb-1">
        <TextInput
          mode="search"
          value={query}
          onValueChange={setQuery}
          placeholder={t("courierDialog.search")}
          aria-label={t("courierDialog.searchLabel")}
        />
      </div>

      <div className="-mx-1 flex min-w-0 flex-col border-t border-border pt-2">
        <div id={listLabelId} className="px-3 pb-1 pt-1.5 text-xs font-semibold text-text-muted">
          {listLabel}
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={SearchX} title={t("courierDialog.empty")} description={t("courierDialog.emptyHint")} />
        ) : (
          <div role="radiogroup" aria-labelledby={listLabelId} className="flex min-w-0 flex-col gap-0.5">
            {visible.map((courier) => {
              const checked = courier.id === selectedId;
              const meta = [courier.region, courier.phone ? formatPhone(courier.phone) : null]
                .filter(Boolean)
                .join(" · ");
              return (
                <label
                  key={courier.id}
                  className={cx(
                    "flex min-h-14 cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2",
                    "transition-[background-color] duration-150 motion-reduce:transition-none",
                    checked ? "bg-action-soft" : "hover:bg-row-hover",
                  )}
                >
                  <input
                    type="radio"
                    name={groupName}
                    value={courier.id}
                    checked={checked}
                    onChange={() => setSelectedId(courier.id)}
                    className="size-5 shrink-0 cursor-pointer accent-action"
                  />
                  <span
                    aria-hidden="true"
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted max-md:hidden"
                  >
                    <Truck size={18} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-text">{courier.name}</span>
                    {meta ? <span className="truncate text-xs text-text-muted">{meta}</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
};
