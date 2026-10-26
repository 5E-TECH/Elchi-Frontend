// dizayn-v2: superadmin-orders-list-cancelled, manager-orders-list-cancelled
import { useTranslation } from "react-i18next";
import { CANCEL_RETURN_STAGE_ORDER, type CancelReturnStage } from "../../../entities/order";
import { Pressable } from "../../../shared/ui/primitives";

/** `.el-chip` (`aria-pressed`) — CODE-MAP 2.2; telefonda 44 px (`OrderFiltersSheet` bilan bir retsept). */
const CHIP =
  "inline-flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 " +
  "text-[13px] font-medium text-text transition-[background-color,border-color,color,box-shadow] duration-150 " +
  "motion-reduce:transition-none hover:border-text-subtle aria-pressed:border-action aria-pressed:bg-action-soft " +
  "aria-pressed:font-semibold aria-pressed:text-action-fg max-md:h-11";

type CancelStageChipsProps = {
  value: CancelReturnStage | "";
  onChange: (stage: CancelReturnStage | "") => void;
};

/**
 * «BEKOR QILINGAN» TABIDAGI BOSQICH CHIPLARI (maket `superadmin-orders-list-cancelled` / `manager-orders-list-cancelled`):
 * «Barchasi · Kuryerda · Yo'lda · Filialda · HQ'da · Topshirilgan» → server filtri `GET /orders?cancel_stage=` (BG4,
 * LFNLeSpu; ta'rif qatordagi bosqich belgisi bilan aynan bir xil). Maketdagi chip sonlari backendda yo'q
 * (`status-counts` bosqich bo'yicha bermaydi) — sonsiz. Telefonda qator gorizontal suriladi (skroll chizig'i yashirin,
 * `OrderFilters` chiplaridek).
 */
const CancelStageChips = ({ value, onChange }: CancelStageChipsProps) => {
  const { t } = useTranslation("orders");
  const items: Array<CancelReturnStage | ""> = ["", ...CANCEL_RETURN_STAGE_ORDER];
  return (
    <div className="flex min-w-0 px-5 pb-4 max-md:px-4">
      <div
        role="group"
        aria-label={t("ordersList.cancelStage.label")}
        data-testid="cancel-stage-chips"
        className="flex min-w-0 max-w-full flex-wrap gap-2 max-md:flex-nowrap max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
      >
        {items.map((stage) => (
          <Pressable
            key={stage || "all"}
            aria-pressed={value === stage}
            data-stage={stage || "all"}
            className={CHIP}
            onClick={() => onChange(stage)}
          >
            {t(`ordersList.cancelStage.${stage || "all"}`)}
          </Pressable>
        ))}
      </div>
    </div>
  );
};

export default CancelStageChips;
