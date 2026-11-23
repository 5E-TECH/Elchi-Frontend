// dizayn-v2: superadmin-ai-assistant-access-dialog
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, KeyRound, Lock } from "lucide-react";
import type { RootState } from "../../../../app/config/store";
import { updateAiAccess, useAiAccessList } from "../../../../entities/ai-advisor";
import { NoticeAlert } from "../../../../entities/notification/ui/NoticeAlert";
import { getUsers } from "../../../../entities/user/api/useUsers";
import { getBackendErrorMessage } from "../../../../shared/lib/backendError";
import { cx } from "../../../../shared/lib/cx";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { notify } from "../../../../shared/lib/notify";
import { queryKeys } from "../../../../shared/config/queryKeys";
import {
  Badge,
  Button,
  Dialog,
  ErrorState,
  Pressable,
  SkeletonLines,
  TextInput,
} from "../../../../shared/ui/primitives";
import {
  applyAccessUpdate,
  buildAccessRows,
  diffAccessRows,
  validateAccessRows,
  type AccessAdmin,
  type AccessLimitError,
  type AccessRow,
} from "../../model/accessForm";

/**
 * Adminlar ro'yxati — bitta sahifa (adminlar soni kichik; backend `limit` chegarasi 100). Kalit `users` ildizida
 * (`queryKeys.users.list`): foydalanuvchi yaratilsa / o'zgarsa `useUser` uni ham eskirtiradi.
 */
const ADMINS_QUERY = { role: "admin", page: 1, limit: 100 } as const;

const toAdmin = (user: { id: string; fullName: string; phone?: string }): AccessAdmin | null =>
  user.id
    ? {
        id: user.id,
        name: user.fullName.trim() || "—",
        phone: user.phone ? formatPhone(user.phone) : "",
      }
    : null;

export type AccessDialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  «KIRISH HUQUQI» — maket `superadmin-ai-assistant-access-dialog` (F7PWp6cK, ega qarori 2026-11-23)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Faqat superadmin (sahifa sarlavhasidagi «Kirish huquqi»). Superadmin doim kiradi — birinchi qator (o'zi, «Doim
 *  kiradi»). Adminlar — `GET users?role=admin`, ruxsatlari — `GET ai/assistant/access`. Har adminda kalit; yoqilgan
 *  bo'lsa «Kunlik limit» (bo'sh — sukut). Saqlash — faqat o'zgargan qatorlar, har biri `PATCH ai/assistant/access`
 *  (ketma-ket; biri yiqilsa to'xtaydi, saqlanganlari yangi asos bo'ladi, xato oynada).
 *
 *  Maketdan farq: «Kunlik limit (sukut)» faqat ko'rsatiladi — sukut serverda (env), uni o'zgartiradigan API yo'q.
 */
export const AccessDialog = ({ open, onClose }: AccessDialogProps) => {
  const { t } = useTranslation("aiAdvisor");
  const queryClient = useQueryClient();
  const me = useSelector((state: RootState) => state.user.user);
  const listQuery = useAiAccessList({ enabled: open });
  const adminsQuery = useQuery({
    queryKey: queryKeys.users.list(ADMINS_QUERY),
    queryFn: () => getUsers(ADMINS_QUERY),
    enabled: open,
    meta: { silentError: true },
  });
  const list = listQuery.data ?? null;
  const admins = adminsQuery.data
    ? adminsQuery.data.map(toAdmin).filter((item): item is AccessAdmin => item !== null)
    : null;

  const [wasOpen, setWasOpen] = useState(false);
  const [base, setBase] = useState<AccessRow[] | null>(null);
  const [rows, setRows] = useState<AccessRow[] | null>(null);
  const [errors, setErrors] = useState<Record<string, AccessLimitError>>({});
  const [failedName, setFailedName] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Har ochilishda serverdagi holatdan toza forma (so'rovlar ochilganda qayta o'qiladi).
  if (open !== wasOpen) {
    setWasOpen(open);
    setBase(null);
    setRows(null);
    setErrors({});
    setFailedName(null);
    setFailedText(null);
  } else if (open && !base && list && admins && !listQuery.isFetching && !adminsQuery.isFetching) {
    const initial = buildAccessRows(admins, list);
    setBase(initial);
    setRows(initial);
  }

  const idPrefix = useId();
  const limitInputId = (userId: string) => `${idPrefix}-limit-${userId}`;

  const failed = listQuery.isError || adminsQuery.isError;
  const retry = () => {
    if (listQuery.isError) void listQuery.refetch();
    if (adminsQuery.isError) void adminsQuery.refetch();
  };

  const updateRow = (userId: string, patch: Partial<AccessRow>) => {
    setRows(
      (current) =>
        current?.map((row) => (row.userId === userId ? { ...row, ...patch } : row)) ?? current,
    );
    if ("limit" in patch || patch.enabled === false) {
      setErrors((current) => {
        if (!current[userId]) return current;
        const next = { ...current };
        delete next[userId];
        return next;
      });
    }
  };

  const submit = async () => {
    if (!base || !rows || saving) return;
    setFailedName(null);
    setFailedText(null);
    const nextErrors = validateAccessRows(rows);
    setErrors(nextErrors);
    const firstInvalid = rows.find((row) => nextErrors[row.userId]);
    if (firstInvalid) {
      document.getElementById(limitInputId(firstInvalid.userId))?.focus();
      return;
    }
    const updates = diffAccessRows(base, rows);
    if (!updates.length) {
      onClose();
      return;
    }
    setSaving(true);
    let current = base;
    try {
      for (const update of updates) {
        try {
          await updateAiAccess(update);
        } catch (error) {
          setFailedName(rows.find((row) => row.userId === update.userId)?.name ?? null);
          setFailedText(getBackendErrorMessage(error) || null);
          return;
        }
        current = applyAccessUpdate(current, update);
        setBase(current);
      }
      notify.success(t("accessDialog.saved"));
      onClose();
    } finally {
      setSaving(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiAssistant.access });
    }
  };

  const granted = rows?.filter((row) => row.enabled).length ?? 0;
  const defaultLimit = list?.defaultDailyLimit ?? 100;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      icon={KeyRound}
      title={t("accessDialog.title")}
      description={t("accessDialog.description")}
      busy={saving}
      initialFocus="panel"
      data-testid="ai-access-dialog"
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            {t("accessDialog.cancel")}
          </Button>
          <Button
            leftIcon={Check}
            loading={saving}
            loadingText={t("accessDialog.saving")}
            disabled={!rows}
            onClick={() => void submit()}
          >
            {t("accessDialog.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <NoticeAlert tone="warning" title={t("accessDialog.warningTitle")}>
          {t("accessDialog.warningText")}
        </NoticeAlert>

        {list && !list.featureEnabled ? (
          <NoticeAlert tone="info" title={t("accessDialog.featureOffTitle")}>
            {t("accessDialog.featureOffText")}
          </NoticeAlert>
        ) : null}

        {failed ? (
          <ErrorState
            framed
            title={t("accessDialog.loadError")}
            error={listQuery.error ?? adminsQuery.error}
            onRetry={retry}
          />
        ) : rows ? (
          <section className="flex flex-col gap-2" aria-labelledby={`${idPrefix}-list`}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 id={`${idPrefix}-list`} className="m-0 text-base font-semibold text-text">
                {t("accessDialog.listTitle")}
              </h3>
              <span className="text-[13px] text-text-muted">
                {t("accessDialog.granted", { granted, total: rows.length })}
              </span>
            </div>
            <ul
              aria-labelledby={`${idPrefix}-list`}
              className="m-0 flex list-none flex-col overflow-hidden rounded-xl border border-border p-0"
            >
              <li className="flex items-center gap-3 bg-sunken px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-text">
                    {me?.name || t("accessDialog.superadminRole")}
                  </span>
                  <span className="text-[13px] text-text-muted">
                    {[
                      t("accessDialog.superadminRole"),
                      me?.phone_number ? formatPhone(me.phone_number) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <Badge tone="neutral" icon={Lock}>
                  {t("accessDialog.always")}
                </Badge>
              </li>
              {rows.map((row) => (
                <AccessRowItem
                  key={row.userId}
                  row={row}
                  defaultLimit={defaultLimit}
                  error={errors[row.userId]}
                  disabled={saving}
                  inputId={limitInputId(row.userId)}
                  onChange={(patch) => updateRow(row.userId, patch)}
                />
              ))}
            </ul>
            {rows.length === 0 ? (
              <p className="m-0 text-[13px] text-text-muted">{t("accessDialog.empty")}</p>
            ) : null}
          </section>
        ) : (
          <div role="status" aria-label={t("accessDialog.loading")} className="flex flex-col gap-4">
            <SkeletonLines lines={3} />
            <SkeletonLines lines={3} />
          </div>
        )}

        {rows ? (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">{t("accessDialog.defaultLabel")}</span>
            <span className="text-sm text-text">
              {t("accessDialog.defaultValue", { count: defaultLimit })}
            </span>
            <span className="text-[13px] text-text-muted">{t("accessDialog.defaultHint")}</span>
          </div>
        ) : null}

        {failedName !== null || failedText !== null ? (
          <NoticeAlert tone="danger" title={t("accessDialog.saveFailedTitle")}>
            {failedName
              ? t("accessDialog.saveFailed", { name: failedName })
              : t("accessDialog.saveFailedGeneric")}
            {failedText ? ` ${failedText}` : null}
          </NoticeAlert>
        ) : null}
      </div>
    </Dialog>
  );
};

type AccessRowItemProps = {
  row: AccessRow;
  defaultLimit: number;
  error?: AccessLimitError;
  disabled: boolean;
  inputId: string;
  onChange: (patch: Partial<AccessRow>) => void;
};

/**
 * Bitta admin (maket qatori): ism + telefon, «Ruxsat bor / yo'q» (telefonda yashirin, faqat ko'rinish uchun), kalit
 * (`Pressable role="switch"`, nomi — admin ismi). Yoqilgan bo'lsa «Kunlik limit» (raqamlar, bo'sh — sukut).
 */
const AccessRowItem = ({
  row,
  defaultLimit,
  error,
  disabled,
  inputId,
  onChange,
}: AccessRowItemProps) => {
  const { t } = useTranslation("aiAdvisor");
  const nameId = useId();
  const hintId = useId();
  return (
    <li className="flex flex-col gap-2.5 border-t border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span id={nameId} className="truncate text-sm font-semibold text-text">
            {row.name}
          </span>
          <span className="text-[13px] text-text-muted">{row.phone}</span>
        </span>
        <span aria-hidden="true" className="text-[13px] text-text-muted max-md:hidden">
          {t(row.enabled ? "accessDialog.on" : "accessDialog.off")}
        </span>
        <Pressable
          role="switch"
          aria-checked={row.enabled}
          aria-labelledby={nameId}
          disabled={disabled}
          onClick={() => onChange({ enabled: !row.enabled })}
          className="group inline-flex shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed max-md:-mr-1 max-md:min-h-11 max-md:min-w-11"
        >
          <span
            aria-hidden="true"
            className={cx(
              "relative h-5 w-9 rounded-full bg-border-strong transition-colors duration-150 motion-reduce:transition-none",
              "group-aria-checked:bg-action group-disabled:opacity-45",
            )}
          >
            <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 group-aria-checked:translate-x-4 motion-reduce:transition-none" />
          </span>
        </Pressable>
      </div>
      {row.enabled ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label htmlFor={inputId} className="text-[13px] text-text-muted">
            {t("accessDialog.limitLabel")}
          </label>
          <span className="flex items-center gap-2">
            {/* Maket: maydon 88 px (`TextInput` qutisi `w-full` — kenglik o'ramdan). */}
            <span className="w-[88px] shrink-0">
              <TextInput
                id={inputId}
                mode="number"
                value={row.limit}
                placeholder={String(defaultLimit)}
                autoComplete="off"
                disabled={disabled}
                invalid={Boolean(error)}
                aria-describedby={hintId}
                inputClassName="text-right"
                onValueChange={(next) => onChange({ limit: next })}
              />
            </span>
            <span className="text-[13px] text-text-muted">{t("accessDialog.limitUnit")}</span>
          </span>
          <span
            id={hintId}
            role={error ? "alert" : undefined}
            className={cx("text-xs", error ? "text-danger" : "text-text-muted")}
          >
            {error
              ? t("accessDialog.limitError")
              : row.limit.trim()
                ? null
                : t("accessDialog.limitEmptyHint", { count: defaultLimit })}
          </span>
        </div>
      ) : null}
    </li>
  );
};

export default AccessDialog;
