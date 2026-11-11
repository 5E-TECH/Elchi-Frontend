// dizayn-v2: superadmin-payments-main-cashbox-fill-dialog, superadmin-payments-cash-detail-courier, superadmin-payments-cash-detail-market, superadmin-payments-cash-detail-branch, manager-payments-cashbox-form-dialog, manager-payments-cash-detail-courier
import { forwardRef, useCallback, useEffect, useMemo } from "react";
import { CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized, resolveMoneyLanguage } from "../../../../shared/lib/formatMoney";
import { Button, Field, Select, type SelectOption } from "../../../../shared/ui/primitives";
import { CARD_KIND_ICON } from "./cardMeta";
import type { CardDirection, CashboxCardPicker } from "./useCashboxCardPicker";

/** Maydon — `useCashboxCardPicker` izohiga qarang (cards1111b). */
type CashboxCardSelectFieldProps = {
  picker: CashboxCardPicker;
  value: string;
  onChange: (id: string) => void;
  onBlur?: () => void;
  name?: string;
  direction: CardDirection;
  /** Sukut: «Qaysi kartaga» / «Qaysi kartadan». */
  label?: string;
  /** Chiqimda — kartadagi qoldiqdan oshsa maydon ostida ogohlantirish. */
  amount?: number;
  /** Qoldiqlar yashirilgan (`••••••`). */
  balanceVisible?: boolean;
};

const MASK = "••••••";

export const CashboxCardSelectField = forwardRef<HTMLElement, CashboxCardSelectFieldProps>(
  function CashboxCardSelectField(
    { picker, value, onChange, onBlur, name, direction, label, amount = 0, balanceVisible = true },
    ref,
  ) {
    const { t, i18n } = useTranslation("payments");
    const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
    const money = useCallback(
      (sum: number) => (balanceVisible ? formatMoneyLocalized(sum, { language }) : MASK),
      [balanceVisible, language],
    );
    const { cards, loading, failed, retry } = picker;
    const selected = picker.resolve(value);

    // Tanlangan karta ro'yxatdan ketdi (arxivlandi / o'chirildi) — eskirgan ID yuborilmasin, sukutga qaytadi.
    useEffect(() => {
      if (value && cards.length > 0 && !cards.some((card) => card.id === value)) onChange("");
    }, [cards, onChange, value]);

    const options = useMemo<SelectOption[]>(
      () =>
        cards.map((card) => ({
          value: card.id,
          label: card.is_default ? t("cashboxCards.picker.defaultName", { name: card.name }) : card.name,
          icon: card.kind ? CARD_KIND_ICON[card.kind] : CreditCard,
          description: [card.last4 ? `•••• ${card.last4}` : null, t("cashboxCards.money.available", { amount: money(card.balance) })]
            .filter(Boolean)
            .join(" · "),
          searchText: [card.bank_name, card.last4, card.holder_name].filter(Boolean).join(" "),
        })),
      [cards, money, t],
    );

    if (!picker.available) return null;

    // Faqat NOMLI karta: Asosiy karta tanlansa `card_id` ketmaydi va backend kartani tekshirmaydi (avvalgidek).
    const shortOf = direction === "out" && selected && !selected.is_default && amount > 0 && amount > selected.balance;
    const hint = failed ? (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{t("cashboxCards.picker.loadError")}</span>
        <Button variant="link" size="sm" onClick={retry} className="max-md:min-h-11">
          {t("cashboxCards.picker.retry")}
        </Button>
      </span>
    ) : undefined;

    return (
      <Field
        labelAs="span"
        label={label ?? t(direction === "in" ? "cashboxCards.picker.labelIn" : "cashboxCards.picker.labelOut")}
        hint={hint}
        error={
          shortOf && selected
            ? t("cashboxCards.picker.notEnough", { name: selected.name, amount: money(Math.max(0, selected.balance)) })
            : undefined
        }
        disabled={failed}
      >
        <Select
          ref={ref}
          searchable={cards.length > 6}
          name={name}
          value={selected?.id ?? null}
          onChange={(next) => onChange(next ?? "")}
          onBlur={onBlur}
          options={options}
          placeholder={t("cashboxCards.money.selectCard")}
          listLabel={t("cashboxCards.money.cardsList")}
          loading={loading}
          loadingText={t("cashboxCards.picker.loading")}
        />
      </Field>
    );
  },
);
