// dizayn-v2: (maket yo'q) market-operators-list
import { memo, useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  suggestOperator,
  useAssignUnlinkedOrders,
  useSelectableMarketOperators,
  useUnlinkedOperatorOrders,
  type SelectableMarketOperator,
  type UnlinkedOperatorGroup,
} from "../../../entities/market-operator";
import { operatorPaymentKeys } from "../../../entities/operator-payment";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { Button, Card, Field, Select, useConfirm, type SelectOption } from "../../../shared/ui/primitives";

/** Sukut bo'yicha ko'rinadigan guruhlar (qolgani — «Hammasini ko'rsatish»). */
const VISIBLE_GROUPS = 5;

/**
 * «OPERATORGA BOG'LANMAGAN BUYURTMALAR» (2026-11-20; maket yo'q — eng yaqini `market-operators-list` ogohlantirish
 * kartasi). Ega: «operator nomidan yaratilgan buyurtmalarga xizmat haqqi yozilmayapti». Eski buyurtmalarda operator
 * ismi faqat MATN bo'lib qolgan (`operator_id` yo'q) — sotuvda komissiya yozilmagan. Har ism guruhiga market operatorni
 * O'ZI tanlaydi (ism ro'yxatdagi yagona operatorga mos kelsa — oldindan tanlangan taklif) va «Biriktirish» → tasdiq →
 * `POST market-operators/unlinked-orders/assign` (100 tadan). Sotilganlariga ulush darhol yoziladi; biriktirish
 * qaytarilmaydi (backend operatori bor buyurtmani almashtirmaydi). Guruh yo'q yoki xato — karta chiqmaydi.
 */
export const UnlinkedOrdersCard = memo(() => {
  const { t, i18n } = useTranslation("marketOperators");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const unlinked = useUnlinkedOperatorOrders();
  const groups = unlinked.data?.groups ?? [];
  const operatorsQuery = useSelectableMarketOperators(null, { ownMarket: true, enabled: groups.length > 0 });
  const operators = operatorsQuery.data;
  const assign = useAssignUnlinkedOrders();
  /** Guruh kaliti → tanlangan operator; yo'q — taklif (bo'lsa). */
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const options = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("unlinked.pickOperator") },
      ...(operators ?? []).map((operator) => ({ value: operator.id, label: operator.name })),
    ],
    [operators, t],
  );

  if (groups.length === 0 || !operators?.length) return null;

  const count = (value: number) => formatNumberLocalized(value, { language });
  const chosenFor = (group: UnlinkedOperatorGroup): SelectableMarketOperator | null => {
    const id = picked[group.key] ?? suggestOperator(group.name, operators)?.id ?? "";
    return operators.find((operator) => operator.id === id) ?? null;
  };

  const run = async (group: UnlinkedOperatorGroup) => {
    const operator = chosenFor(group);
    if (!operator || busyKey) return;
    const ok = await confirm({
      tone: "primary",
      icon: Link2,
      title: t("unlinked.confirmTitle", { operator: operator.name }),
      description: t("unlinked.confirmText", {
        name: group.name,
        value: count(group.orderIds.length),
        sold: count(group.soldOrders),
      }),
      confirmLabel: t("unlinked.assign"),
      cancelLabel: t("unlinked.cancel"),
    });
    if (!ok) return;
    setBusyKey(group.key);
    try {
      const result = await assign.mutateAsync({ operatorId: operator.id, orderIds: group.orderIds });
      void queryClient.invalidateQueries({ queryKey: operatorPaymentKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (result.failed > 0) {
        notify.warning(t("unlinked.partial", { assigned: count(result.assigned), failed: count(result.failed) }), {
          description: t("unlinked.partialText"),
        });
      } else {
        notify.success(t("unlinked.done", { value: count(result.assigned), operator: operator.name }), {
          description:
            result.earningsRecorded > 0
              ? t("unlinked.doneEarnings", { value: count(result.earningsRecorded) })
              : t("unlinked.doneNoEarnings"),
        });
      }
    } catch {
      notify.error(t("unlinked.failed"), { description: t("unlinked.failedText") });
    } finally {
      setBusyKey(null);
    }
  };

  const visible = showAll ? groups : groups.slice(0, VISIBLE_GROUPS);

  return (
    <Card
      as="section"
      title={t("unlinked.title", { value: count(unlinked.data?.totalOrders ?? 0) })}
      description={t("unlinked.description")}
      aria-label={t("unlinked.label")}
    >
      <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
        {visible.map((group) => {
          const operator = chosenFor(group);
          const selectId = `unlinked-${group.key.replace(/[^\p{L}\p{N}]+/gu, "-")}`;
          return (
            <li key={group.key} className="flex flex-wrap items-end gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                <span className="font-semibold text-text [overflow-wrap:anywhere]">
                  {t("unlinked.groupName", { name: group.name })}
                </span>
                <span className="text-[13px] text-text-muted tabular-nums">
                  {t("unlinked.counts", { total: count(group.totalOrders), sold: count(group.soldOrders) })}
                </span>
              </div>
              <div className="min-w-0 flex-[1_1_220px]">
                <Field id={selectId} label={t("unlinked.operator", { name: group.name })} labelAs="span" hideLabel>
                  <Select
                    name={selectId}
                    options={options}
                    value={operator?.id ?? ""}
                    onChange={(next) => setPicked((prev) => ({ ...prev, [group.key]: next ?? "" }))}
                    disabled={busyKey !== null}
                  />
                </Field>
              </div>
              <Button
                variant="secondary"
                leftIcon={Link2}
                disabled={!operator || (busyKey !== null && busyKey !== group.key)}
                loading={busyKey === group.key}
                aria-label={t("unlinked.assignFor", { name: group.name })}
                onClick={() => void run(group)}
              >
                {t("unlinked.assign")}
              </Button>
            </li>
          );
        })}
      </ul>
      {groups.length > VISIBLE_GROUPS ? (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll((value) => !value)}>
          {showAll ? t("unlinked.showLess") : t("unlinked.showAll", { value: count(groups.length) })}
        </Button>
      ) : null}
    </Card>
  );
});
UnlinkedOrdersCard.displayName = "UnlinkedOrdersCard";
