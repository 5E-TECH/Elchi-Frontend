// dizayn-v2: (maket yo'q) superadmin-orders-detail — «Operator biriktirish» oynasi (MarkReturnedModal namunasi)
import { memo, useState, type FormEvent } from "react";
import { UserCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelectableMarketOperators } from "../../../entities/market-operator";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, Field, Select, type SelectOption } from "../../../shared/ui/primitives";
import { useAssignOrderOperator } from "../api/useAssignOrderOperator";
import { isOwnMarketRole } from "../model/assignOperatorRules";

interface Props {
  open: boolean;
  orderId: string;
  /** Mijozga ko'rinadigan raqam (sarlavhada) — berilmasa `orderId`. */
  orderNumber?: string;
  /** Buyurtma marketi — operatorlar ro'yxati shu market bo'yicha. */
  marketId: string;
  role: string | null | undefined;
  onClose: () => void;
  onDone?: () => void;
}

/**
 * «OPERATOR BIRIKTIRISH» — operatori yo'q buyurtmaga keyin operator (2026-11-16). Ro'yxat — yaratish formasidagi
 * «Operator» bilan AYNI (`GET /market-operators/selectable`, buyurtma marketining faol operatorlari). Bo'sh bo'lsa
 * tushuntiriladi, saqlash tugmasi o'chiq. Backend xatosi (400 operator faol emas, 409 operator allaqachon bor /
 * integratsiya / market o'zgardi) oyna ichida ko'rsatiladi.
 */
const AssignOperatorDialog = ({ open, orderId, orderNumber, marketId, role, onClose, onDone }: Props) => {
  const { t } = useTranslation("orders");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const operatorsQuery = useSelectableMarketOperators(marketId, { ownMarket: isOwnMarketRole(role) });
  const assign = useAssignOrderOperator();

  const operators = operatorsQuery.data ?? [];
  const loading = operatorsQuery.isPending;
  const loadFailed = operatorsQuery.isError && !operatorsQuery.data;
  const empty = !loading && !loadFailed && operators.length === 0;
  const options: SelectOption[] = operators.map((item) => ({ value: item.id, label: item.name }));

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!selectedId) {
      setError(t("operatorAssign.required"));
      return;
    }
    setError("");
    assign.mutate(
      { orderId, operatorId: selectedId },
      {
        onSuccess: (result) => {
          notify.success(
            result?.earning_recorded ? t("operatorAssign.successEarning") : t("operatorAssign.success"),
            { duration: 3000 },
          );
          onDone?.();
          onClose();
        },
        onError: (mutationError) => setError(getBackendErrorMessage(mutationError) ?? t("orderActionError")),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={assign.isPending}
      size="sm"
      className="md:max-w-[460px]"
      title={t("operatorAssign.title", { id: orderNumber ?? orderId })}
      description={t("operatorAssign.hint")}
      icon={UserCheck}
      iconTone="info"
      onSubmit={handleSubmit}
      formProps={{ noValidate: true }}
      data-testid="assign-operator-dialog"
      footer={
        <>
          <Button variant="secondary" disabled={assign.isPending} onClick={onClose}>
            {t("cancel", { ns: "common" })}
          </Button>
          <Button
            type="submit"
            leftIcon={UserCheck}
            loading={assign.isPending}
            disabled={!selectedId || empty || loadFailed}
            data-testid="assign-operator-submit"
          >
            {t("operatorAssign.submit")}
          </Button>
        </>
      }
    >
      {empty ? (
        <p data-testid="assign-operator-empty" className="m-0 rounded-xl bg-sunken px-3 py-2.5 text-[13px] text-text">
          {t("operatorAssign.empty")}
        </p>
      ) : loadFailed ? (
        <p role="alert" data-testid="assign-operator-load-failed" className="m-0 text-[13px] font-semibold text-danger-fg">
          {t("operatorAssign.loadFailed")}
        </p>
      ) : (
        <Field label={t("operator")} labelAs="span" hint={t("operatorSelect.pickedHint")}>
          <Select
            options={options}
            value={selectedId}
            loading={loading}
            placeholder={t("operatorAssign.placeholder")}
            searchable={options.length > 8}
            onChange={(next) => {
              setError("");
              setSelectedId(next ?? null);
            }}
            aria-label={t("operator")}
          />
        </Field>
      )}

      {error ? (
        <p role="alert" data-testid="assign-operator-error" className="m-0 text-[13px] font-semibold text-danger-fg">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
};

export default memo(AssignOperatorDialog);
