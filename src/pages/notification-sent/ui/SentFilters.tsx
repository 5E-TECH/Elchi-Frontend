// dizayn-v2: superadmin-notifications-sent, admin-notifications-sent
import { useMemo, useState } from "react";
import { Funnel } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DISPATCH_HISTORY_STATUSES,
  DISPATCH_STATUS_META,
  useAudienceText,
} from "../../../entities/notification-dispatch";
import { useUsers } from "../../../entities/user";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Button, Dialog, Field, Select, type SelectOption } from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import { countSentFilters, EMPTY_SENT_FILTERS, type SentFilters as SentFilterValues } from "../model/sentSearch";

/** «Filtrlar 2» soni (`.el-tab-count` + `action-soft`; namuna — faoliyat jurnali). */
const COUNT_PILL =
  "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-action-soft px-1.5 text-xs font-semibold text-action-fg";

/** Qo'lda xabarni faqat superadmin va admin yuboradi (`canSendNotifications`). */
const AUTHOR_ROLES = ["superadmin", "admin"] as const;
const AUTHOR_LIMIT = 100;
const SEARCHABLE_FROM = 8;

type Props = {
  values: SentFilterValues;
  onChange: (patch: Partial<SentFilterValues>) => void;
  /** Ro'yxat hali yuklanmagan yoki xato — maketdagidek o'chiq. */
  disabled?: boolean;
  /** Ro'yxatdagi mualliflar (foydalanuvchilar ro'yxati kelmasa ham tanlangan muallif nomi chiqsin). */
  knownAuthors: ReadonlyMap<string, string>;
};

/**
 * FILTRLAR (maket `*-notifications-sent`): desktop/planshet — «Natija:» va «Kim yubordi:» `Select` lari (inline yorliq,
 * 640 px gacha), o'zgarish darhol qo'llanadi. Telefon (< 768, DOM'da bitta nusxa): «Filtrlar» tugmasi + pastki varaqa
 * (qoralama; «Natijalarni ko'rsatish» bir marta qo'llaydi; eng yaqin namuna `superadmin-orders-filters-mobile`).
 * «Kim yubordi» variantlari — `GET /users?role=superadmin|admin` (backend `created_by` — foydalanuvchi id'si).
 */
export const SentFilters = ({ values, onChange, disabled = false, knownAuthors }: Props) => {
  const { t, i18n } = useTranslation(["notifications", "ui"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();
  const { roleLabel } = useAudienceText();
  const allLabel = t("sent.filters.all");

  const usersQuery = useUsers({ role: [...AUTHOR_ROLES], limit: AUTHOR_LIMIT });

  const statusOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: allLabel },
      ...DISPATCH_HISTORY_STATUSES.map((status) => ({
        value: status,
        label: t(DISPATCH_STATUS_META[status].labelKey),
      })),
    ],
    [allLabel, t],
  );

  const authorOptions = useMemo<SelectOption[]>(() => {
    const users = (usersQuery.data ?? [])
      .filter((user) => user.id)
      .map((user) => ({
        value: user.id,
        label: user.fullName || knownAuthors.get(user.id) || user.username || user.id,
        description: roleLabel(user.role) ?? undefined,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, language));
    const listed = new Set(users.map((user) => user.value));
    // Ro'yxatda yo'q, lekin tarixda bor muallif (nofaol qilingan, ro'yxat kelmadi) — nomi tarix qatoridan.
    const extra = [...knownAuthors]
      .filter(([id]) => !listed.has(id))
      .map(([id, name]) => ({ value: id, label: name }));
    const selected =
      values.author && !listed.has(values.author) && !knownAuthors.has(values.author)
        ? [{ value: values.author, label: `#${values.author}` }]
        : [];
    return [{ value: "", label: allLabel }, ...users, ...extra, ...selected];
  }, [allLabel, knownAuthors, language, roleLabel, usersQuery.data, values.author]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<SentFilterValues>(values);
  const activeCount = countSentFilters(values);
  const openSheet = () => {
    setDraft(values);
    setSheetOpen(true);
  };
  const applySheet = () => {
    onChange(draft);
    setSheetOpen(false);
  };

  const statusSelect = (value: string, onValue: (next: string) => void, inline: boolean) => (
    <Select
      options={statusOptions}
      value={value}
      onChange={(next) => onValue(next ?? "")}
      inlineLabel={inline ? t("sent.filters.status") : undefined}
      aria-label={inline ? t("sent.filters.status") : undefined}
      listLabel={t("sent.filters.status")}
      disabled={disabled}
    />
  );
  const authorSelect = (value: string, onValue: (next: string) => void, inline: boolean) => (
    <Select
      options={authorOptions}
      value={value}
      onChange={(next) => onValue(next ?? "")}
      inlineLabel={inline ? t("sent.filters.author") : undefined}
      aria-label={inline ? t("sent.filters.author") : undefined}
      listLabel={t("sent.filters.author")}
      loading={usersQuery.isLoading}
      loadingText={t("sent.filters.authorsLoading")}
      searchable={authorOptions.length > SEARCHABLE_FROM}
      disabled={disabled}
    />
  );

  if (isPhone) {
    return (
      <>
        <Button
          variant="secondary"
          leftIcon={Funnel}
          className="w-full"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          disabled={disabled}
          onClick={openSheet}
        >
          {t("ui:filters.button")}
          {activeCount > 0 ? <span className={COUNT_PILL}>{formatNumberLocalized(activeCount, { language })}</span> : null}
        </Button>
        <Dialog
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={t("ui:filters.sheetTitle")}
          description={t("ui:filters.sheetSelected", { count: countSentFilters(draft) })}
          closeLabel={t("ui:filters.sheetClose")}
          footerDivider
          footer={
            <>
              <Button variant="secondary" size="lg" className="max-md:flex-none!" onClick={() => setDraft(EMPTY_SENT_FILTERS)}>
                {t("ui:filters.reset")}
              </Button>
              <Button size="lg" onClick={applySheet}>
                {t("ui:filters.apply")}
              </Button>
            </>
          }
        >
          <Field label={t("sent.filters.status")} labelAs="span">
            {statusSelect(draft.status, (status) => setDraft((current) => ({ ...current, status: status as SentFilterValues["status"] })), false)}
          </Field>
          <Field label={t("sent.filters.author")} labelAs="span">
            {authorSelect(draft.author, (author) => setDraft((current) => ({ ...current, author })), false)}
          </Field>
        </Dialog>
      </>
    );
  }

  return (
    <div role="group" aria-label={t("sent.filters.label")} className="flex max-w-[640px] flex-wrap items-center gap-3">
      <div className="min-w-0 flex-[1_1_220px]">
        {statusSelect(values.status, (status) => onChange({ status: status as SentFilterValues["status"] }), true)}
      </div>
      <div className="min-w-0 flex-[1_1_220px]">
        {authorSelect(values.author, (author) => onChange({ author }), true)}
      </div>
    </div>
  );
};
