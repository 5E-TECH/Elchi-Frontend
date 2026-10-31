// dizayn-v2: superadmin-payments-shift-settings-receipts, superadmin-payments-shift-settings-receipts-photo-off-confirm
import { useCallback, useMemo, useState } from "react";
import { ArrowLeftRight, ArrowUpRight, CircleMinus, History, Info, Receipt, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  RECEIPT_SETTING_GROUPS,
  useReceiptSettings,
  useUpdateReceiptSettings,
  type ReceiptGroupSettings,
  type ReceiptSettingGroup,
} from "../../../entities/payments";
import { useUser } from "../../../entities/user/api/userApi";
import { resolveUserName } from "../components/lib/useCashboxShift";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { Card, DataTable, QueryBoundary, useConfirm, type DataTableColumn } from "../../../shared/ui/primitives";
import { CellSwitch } from "./CellSwitch";
import { diffReceiptSettings, type ReceiptDraft } from "./settingsDiff";

/**
 * «CHEK RASMI VA AI TAHLILI» KARTASI (QlLf33Ma, 6-bosqich; maketlar `superadmin-payments-shift-settings-receipts`,
 * `…-photo-off-confirm`). Sahifa faqat superadmin uchun, admin va menejer sozlamani ko'rmaydi (forma sozlamani
 * o'zi o'qiydi). Ikki operatsiya × ikki kalit. Qoidalar backend bilan bir xil: rasm o'chiq — AI kaliti bosilmaydi
 * («Avval chek rasmini yoqing»); rasm o'chirilsa AI ham o'chadi; rasm qayta yoqilsa AI o'chiq qoladi. Rasmni o'chirish —
 * tasdiq bilan; AI kaliti — tasdiqsiz. O'zgarish sahifadagi yagona «Saqlash» bilan ketadi: faqat o'zgarganlar.
 *
 * Qoralama sahifa darajasida (`useReceiptSettingsDraft`): smena sozlamalari saqlanganda forma qayta quriladi, chek
 * so'rovi yiqilsa ham kiritilgan qiymat yo'qolmasin.
 */

const GROUP_ICON: Record<ReceiptSettingGroup, LucideIcon> = {
  manual_expense: ArrowUpRight,
  hq_transfer: ArrowLeftRight,
};

export const useReceiptSettingsDraft = () => {
  const query = useReceiptSettings();
  const update = useUpdateReceiptSettings();
  const { mutateAsync } = update;
  const [edits, setEdits] = useState<Partial<ReceiptDraft>>({});
  const base = query.data ?? null;
  const draft = useMemo<ReceiptDraft | null>(
    () =>
      base
        ? {
            manual_expense: edits.manual_expense ?? base.manual_expense,
            hq_transfer: edits.hq_transfer ?? base.hq_transfer,
          }
        : null,
    [base, edits],
  );
  const body = useMemo(() => (base && draft ? diffReceiptSettings(base, draft) : {}), [base, draft]);
  const dirty = Object.keys(body).length > 0;

  const setGroup = useCallback((group: ReceiptSettingGroup, next: ReceiptGroupSettings) => {
    setEdits((current) => ({ ...current, [group]: next }));
  }, []);

  const save = useCallback(async () => {
    await mutateAsync(body);
    setEdits({});
  }, [body, mutateAsync]);

  return { query, draft, dirty, setGroup, save, isSaving: update.isPending };
};

export type ReceiptSettingsDraft = ReturnType<typeof useReceiptSettingsDraft>;

export const ReceiptSettingsCard = ({ receipts }: { receipts: ReceiptSettingsDraft }) => {
  const { t } = useTranslation("payments");
  const confirm = useConfirm();
  const { useGetUserById } = useUser();
  const { query, draft, setGroup } = receipts;
  // Javobda `updated_by` — ID: ism alohida o'qiladi (o'qilmasa — faqat sana).
  const authorQuery = useGetUserById(query.data?.updated_by ?? "", undefined, { silentError: true });
  const author = resolveUserName(authorQuery.data);

  const groupTitle = (group: ReceiptSettingGroup) => t(`receipt.settings.groups.${group}.title`);

  const togglePhoto = async (group: ReceiptSettingGroup, next: boolean) => {
    if (!draft) return;
    if (next) {
      // Rasm qayta yoqilsa AI o'chiq qoladi (backend qoidasi) — AI ni alohida yoqish kerak.
      setGroup(group, { ...draft[group], photo_required: true });
      return;
    }
    const ok = await confirm({
      tone: "danger",
      title: t("receipt.settings.photoOff.title"),
      description: t(`receipt.settings.groups.${group}.offDescription`),
      consequences: [
        { text: t("receipt.settings.photoOff.ai"), icon: CircleMinus },
        { text: t(`receipt.settings.groups.${group}.offField`), icon: Receipt },
        { text: t("receipt.settings.photoOff.kept"), icon: History },
      ],
      confirmLabel: t("receipt.settings.photoOff.confirm"),
    });
    if (ok) setGroup(group, { photo_required: false, ai_enabled: false });
  };

  const photoSwitch = (group: ReceiptSettingGroup) => (
    <CellSwitch
      checked={Boolean(draft?.[group].photo_required)}
      label={t("receipt.settings.switchPhoto", { group: groupTitle(group) })}
      onToggle={(next) => void togglePhoto(group, next)}
    />
  );

  const aiSwitch = (group: ReceiptSettingGroup) => {
    const value = draft?.[group];
    return (
      <span className="inline-flex items-center gap-2">
        <CellSwitch
          checked={Boolean(value?.ai_enabled)}
          disabled={!value?.photo_required}
          label={t("receipt.settings.switchAi", { group: groupTitle(group) })}
          onToggle={(next) => value && setGroup(group, { ...value, ai_enabled: next })}
        />
        {value?.photo_required ? null : (
          <span className="text-[13px] text-text-muted">{t("receipt.settings.needsPhoto")}</span>
        )}
      </span>
    );
  };

  const resultText = (group: ReceiptSettingGroup) => {
    const value = draft?.[group];
    if (!value?.photo_required) return t("receipt.settings.resultText.none");
    return value.ai_enabled ? t("receipt.settings.resultText.photoAi") : t("receipt.settings.resultText.photo");
  };

  const groupName = (group: ReceiptSettingGroup) => {
    const Icon = GROUP_ICON[group];
    return (
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-sunken text-text-muted max-md:hidden">
          <Icon aria-hidden="true" size={18} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold text-text">{groupTitle(group)}</span>
          <span className="text-[13px] text-text-muted">{t(`receipt.settings.groups.${group}.hint`)}</span>
        </span>
      </span>
    );
  };

  const columns: DataTableColumn<ReceiptSettingGroup>[] = [
    { id: "operation", header: t("receipt.settings.operation"), cell: groupName },
    { id: "photo", header: t("receipt.settings.photo"), cell: photoSwitch },
    { id: "ai", header: t("receipt.settings.ai"), cell: aiSwitch },
    {
      id: "result",
      header: t("receipt.settings.result"),
      hideBelow: "lg",
      cell: (group) => <span className="text-[13px] text-text-muted">{resultText(group)}</span>,
    },
  ];

  const updatedAt = query.data?.updated_at;
  const updated = [author, updatedAt ? formatDateTimeLocalized(updatedAt) : null].filter(Boolean).join(" · ");

  return (
    <Card
      padding="none"
      title={
        <span className="inline-flex items-center gap-2">
          <Receipt aria-hidden="true" size={18} className="text-text-muted" />
          {t("receipt.settings.title")}
        </span>
      }
      description={t("receipt.settings.subtitle")}
      divided
      footer={
        <div className="flex flex-col gap-1.5">
          <span className="flex items-start gap-2 text-[13px] text-text-muted">
            <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0">{t("receipt.settings.note")}</span>
          </span>
          {updated ? (
            <span className="pl-6 text-xs text-text-muted">{t("receipt.settings.updated", { value: updated })}</span>
          ) : null}
        </div>
      }
    >
      <QueryBoundary query={query} skeleton="lines" isEmpty={() => false}>
        {() => (
          <DataTable
            rows={[...RECEIPT_SETTING_GROUPS]}
            columns={columns}
            getRowKey={(group) => group}
            label={t("receipt.settings.tableLabel")}
            cardsLabel={t("receipt.settings.tableLabel")}
            renderCard={(group) => (
              <div className="flex flex-col gap-1 px-4 py-3">
                {groupName(group)}
                <span className="flex min-w-0 items-center justify-between gap-3 text-[13px] text-text">
                  {t("receipt.settings.photo")}
                  {photoSwitch(group)}
                </span>
                <span className="flex min-w-0 items-center justify-between gap-3 text-[13px] text-text">
                  {t("receipt.settings.ai")}
                  {aiSwitch(group)}
                </span>
              </div>
            )}
          />
        )}
      </QueryBoundary>
    </Card>
  );
};
