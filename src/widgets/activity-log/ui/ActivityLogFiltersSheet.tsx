// dizayn-v2: (maket yo'q) superadmin-activity-logs-list, superadmin-orders-filters-mobile
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, Field, Select, TextInput, type SelectOption } from "../../../shared/ui/primitives";
import { countSheetFilters, type LogFilters } from "../lib/logView";

/**
 * «Filtrlar» pastki varaqasi — telefon (< 768). Maketda jurnal varaqasi alohida chizilmagan: naqsh
 * `superadmin-orders-filters-mobile` (qoralama → «Natijalarni ko'rsatish» bir marta qo'llaydi; ×/fon — bekor;
 * «Tozalash» — faqat qoralamani). Ichida: Xizmat, Amal, Obyekt turi, Foydalanuvchi ID (qidiruv va sana —
 * asboblar qatorida).
 */
export const ActivityLogFiltersSheet = ({
  open,
  onClose,
  initial,
  serviceOptions,
  actionOptions,
  actionsLoading,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  initial: LogFilters;
  serviceOptions: SelectOption<string>[];
  actionOptions: SelectOption<string>[];
  actionsLoading: boolean;
  onApply: (filters: LogFilters) => void;
}) => {
  const { t } = useTranslation(["activityLogs", "ui"]);
  const [draft, setDraft] = useState<LogFilters>(initial);
  const [prevOpen, setPrevOpen] = useState(open);
  // Har ochilishda qoralama joriy filtrlardan boshlanadi.
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setDraft(initial);
  }

  const patch = (next: Partial<LogFilters>) => setDraft((current) => ({ ...current, ...next }));
  const all = t("filters.all");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("filters.sheetTitle", { ns: "ui" })}
      description={t("filters.sheetSelected", { ns: "ui", count: countSheetFilters(draft) })}
      closeLabel={t("filters.sheetClose", { ns: "ui" })}
      footerDivider
      footer={
        <>
          <Button
            variant="secondary"
            size="lg"
            className="max-md:flex-none!"
            onClick={() => patch({ service: "", action: "", entityType: "", userId: "" })}
          >
            {t("filters.reset", { ns: "ui" })}
          </Button>
          <Button
            size="lg"
            compact
            className="min-w-0"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {t("filters.apply", { ns: "ui" })}
          </Button>
        </>
      }
    >
      <Field label={t("filters.service")} labelAs="span">
        <Select
          options={[{ value: "", label: all }, ...serviceOptions]}
          value={draft.service}
          onChange={(next) => patch({ service: next ?? "" })}
          placeholder={all}
        />
      </Field>
      <Field label={t("filters.action")} labelAs="span">
        <Select
          options={[{ value: "", label: all }, ...actionOptions]}
          value={draft.action}
          onChange={(next) => patch({ action: next ?? "" })}
          placeholder={all}
          loading={actionsLoading}
        />
      </Field>
      <Field label={t("filters.entityTypeLabel")}>
        <TextInput
          value={draft.entityType}
          onValueChange={(entityType) => patch({ entityType })}
          placeholder={t("filters.entityType")}
        />
      </Field>
      <Field label={t("filters.userId")}>
        <TextInput
          inputMode="numeric"
          value={draft.userId}
          onValueChange={(userId) => patch({ userId })}
          placeholder={t("filters.userId")}
        />
      </Field>
    </Dialog>
  );
};
