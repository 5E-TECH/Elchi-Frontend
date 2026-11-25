import { Banknote, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Field, Select, type SelectOption } from "../../../shared/ui/primitives";
import { usePaymentMethodFilterOptions, type MethodCardFilters } from "./lib/historyMethodCardFilter";

type HistoryMethodCardFiltersProps = {
  filters: MethodCardFilters;
  onChange: (patch: Partial<MethodCardFilters>) => void;
  /** «To'lov usuli» — `showsPaymentMethod` (P0 63HO6cBU). */
  showMethod: boolean;
  /** «Karta» — `useCardFilterOptions` (`available` bo'lsa). */
  card?: { options: readonly SelectOption[]; loading: boolean; onOpen?: () => void } | null;
  /** Guruh joylashuvi (sukut `flex flex-wrap items-center gap-3`) — berilsa, sukut o'rniga. */
  className?: string;
  itemClassName?: string;
};

/**
 * KRN902pg — kassa tarixidagi «To'lov usuli» va «Karta» tanlovlari (`/payments/main-cashbox`,
 * `/payments/cash-detail/:id`). Qiymat URL'da — ota sahifa `useQueryParams` bilan yozadi va 1-sahifaga qaytaradi.
 * Hech biri ko'rinmasa — hech narsa chizilmaydi.
 */
const HistoryMethodCardFilters = ({
  filters,
  onChange,
  showMethod,
  card,
  className,
  itemClassName,
}: HistoryMethodCardFiltersProps) => {
  const { t } = useTranslation(["payments", "ui"]);
  const methodOptions = usePaymentMethodFilterOptions();
  if (!showMethod && !card) return null;
  const all = t("ui:select.all");
  const methodLabel = t("historyFilters.paymentMethod");
  const cardLabel = t("historyFilters.card");

  return (
    <div role="group" aria-label={t("historyFilters.group")} className={className ?? "flex flex-wrap items-center gap-3"}>
      {showMethod ? (
        <Field label={methodLabel} hideLabel labelAs="span" className={itemClassName}>
          <Select
            options={[{ value: "", label: all }, ...methodOptions]}
            value={filters.payment_method}
            onChange={(next) => onChange({ payment_method: next ?? "" })}
            placeholder={all}
            inlineLabel={methodLabel}
            icon={Banknote}
          />
        </Field>
      ) : null}
      {card ? (
        <Field label={cardLabel} hideLabel labelAs="span" className={itemClassName}>
          <Select
            options={[{ value: "", label: all }, ...card.options]}
            value={filters.card_id}
            onChange={(next) => onChange({ card_id: next ?? "" })}
            placeholder={all}
            inlineLabel={cardLabel}
            icon={CreditCard}
            loading={card.loading}
            onOpenChange={(open) => {
              if (open) card.onOpen?.();
            }}
            searchable={card.options.length > 8}
          />
        </Field>
      ) : null}
    </div>
  );
};

export default HistoryMethodCardFilters;
