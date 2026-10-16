// dizayn-v2: superadmin-neworders-create-manual-step1, superadmin-neworders-create-manual-step2, superadmin-neworders-create-ai-input, market-new-orders-create-manual
import { memo, useMemo } from "react";
import { Pencil, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SegmentedControl, type SegmentedOption } from "../../../../shared/ui/primitives";

export type CreateMode = "manual" | "ai";

/**
 * «Qo'lda» / «AI bilan» — sarlavha o'ngidagi segment (maket `.el-seg` «Yaratish usuli», CODE-MAP 2.5).
 * Telefonda (< 768) sarlavha ostida to'liq enli, har variant ≥ 44 px (`SegmentedControl` sukuti).
 * ⚠️ Variantlar `type="button"` (primitivda) — sahifa `<form>` ichida, bosish formani yubormaydi.
 */
const CreateModeTabs = ({ mode, onChange }: { mode: CreateMode; onChange: (mode: CreateMode) => void }) => {
  const { t } = useTranslation("orders");
  const options = useMemo<SegmentedOption<CreateMode>[]>(
    () => [
      { value: "manual", label: t("aiModeManual"), icon: Pencil },
      { value: "ai", label: t("aiModeAi"), icon: Sparkles },
    ],
    [t],
  );

  return (
    <div data-testid="create-mode-tabs" className="flex min-w-0 max-md:w-full">
      <SegmentedControl ariaLabel={t("createModeLabel")} options={options} value={mode} onValueChange={onChange} />
    </div>
  );
};

export default memo(CreateModeTabs);
