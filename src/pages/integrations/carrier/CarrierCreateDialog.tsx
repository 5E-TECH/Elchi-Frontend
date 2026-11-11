// dizayn-v2: superadmin-integrations-carrier-create-dialog, admin-integrations-carrier-create-dialog
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  CircleCheck,
  Clock,
  Info,
  KeyRound,
  PackageCheck,
  RefreshCw,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import {
  useCarrierAccountActions,
  type CarrierAccount,
  type CreateCarrierAccountDto,
} from "../../../entities/integrations/carriers";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { cx } from "../../../shared/lib/cx";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { notify } from "../../../shared/lib/notify";
import {
  Button,
  Dialog,
  Field,
  Select,
  TextInput,
  buttonClasses,
  type SelectOption,
} from "../../../shared/ui/primitives";
import { InlineAlert } from "../ui";
import {
  classifyCarrierError,
  courierEligibility,
  initialsOf,
  type CarrierCourier,
  type CourierEligibility,
} from "./carrierModel";
import { courierSubline } from "./carrierFormat";
import { useLeaveGuard, useOpenCount } from "./carrierHooks";
import { NumberedSteps } from "./carrierParts";
import type { CarrierKeyReveal } from "./CarrierKeyDialog";
import { IpAllowlistField } from "./IpAllowlistField";
import { checkIpAllowlist } from "./ipAllowlist";
import { invalidateCarrierCourier, useCourierCandidates } from "./useCarrierCouriers";

/**
 * YANGI TASHQI YETKAZUVCHI (maket `*-carrier-create-dialog`): nom, kuryer (guruhlangan tanlov: «Bog'lash mumkin» /
 * «Bog'lab bo'lmaydi» — sababi bilan), IP ro'yxati (qatorma-qator) → `POST admin/carriers` → kalit oynasi.
 *
 * Server rad etsa — xato forma tepasida (409 kuryer band: akkaunt nomi va havolasi YUKLANGAN ro'yxatdan
 * `courier_user_id` bo'yicha — har chizishda, shuning uchun xatodan keyingi ro'yxat yangilanishi (`onSettled`)
 * poyga holatidagi nomsiz matnni nomli «X»ni ochish» ga almashtiradi; 400/404 kuryer; 503). Natija noma'lum bo'lsa (javob kelmadi,
 * 502/504/500, javobda kalit yo'q) — «Javob kelmadi» (akkaunt yaratilgan bo'lishi mumkin: qayta yaratish o'rniga
 * ro'yxatni yangilash). So'rov ketayotganda sahifani yangilash / yopish brauzer tasdig'ini so'raydi, «Orqaga» bekor
 * qilinadi (`useLeaveGuard`) va «Kuryer qo'shish» havolasi chizilmaydi — javobdagi kalit yo'qolmasin.
 *
 * Har ochilishda forma toza (`useOpenCount` → `key`); yopilganda o'sha nusxa so'nadi (qiymatlar joyida).
 */
type ServerError = { kind: "busy"; courierId: string } | { kind: "courier" } | { kind: "unavailable" };

export type CarrierCreated = { accountId: string; reveal: CarrierKeyReveal };

type CarrierCreateDialogProps = {
  open: boolean;
  accounts: readonly CarrierAccount[];
  hqBranchId: string | null;
  hqName: string;
  onClose: () => void;
  onCreated: (created: CarrierCreated) => void;
  onOpenAccount: (id: string) => void;
  onRefreshList: () => void;
};

const SEARCH_DEBOUNCE_MS = 300;

export const CarrierCreateDialog = (props: CarrierCreateDialogProps) => {
  const openCount = useOpenCount(props.open);
  return <CreateForm key={openCount} {...props} />;
};

const CreateForm = ({
  open,
  accounts,
  hqBranchId,
  hqName,
  onClose,
  onCreated,
  onOpenAccount,
  onRefreshList,
}: CarrierCreateDialogProps) => {
  const { t } = useTranslation("integrations");
  const client = useQueryClient();
  const { create } = useCarrierAccountActions();
  const [name, setName] = useState("");
  const [courier, setCourier] = useState<CarrierCourier | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [ipText, setIpText] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<ServerError | null>(null);
  const [unknownName, setUnknownName] = useState<string | null>(null);
  /** Ochilganda fokus nom maydonida (birinchi fokuslanadigan element — «Kuryer qo'shish» havolasi emas). */
  const nameRef = useRef<HTMLInputElement>(null);
  /**
   * Oynani ochgan element — «Javob kelmadi» yopilgach fokus shunga qaytadi (u forma yopilayotganda ochiladi:
   * sukut «ochgan element» formaning DOM'dan olinadigan «Yaratish» tugmasi bo'lardi).
   */
  const openerRef = useRef<HTMLElement | null>(null);
  /** Ikki marta bosilsa ikki so'rov ketmasin (`isPending` keyingi chizishda yangilanadi). */
  const inFlightRef = useRef(false);
  const check = useMemo(() => checkIpAllowlist(ipText), [ipText]);
  useLeaveGuard(create.isPending);

  useLayoutEffect(() => {
    if (open && !openerRef.current && document.activeElement instanceof HTMLElement) {
      openerRef.current = document.activeElement;
    }
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const candidates = useCourierCandidates(search, open);

  const close = () => {
    if (create.isPending) return;
    onClose();
  };

  /** Tanlangan kuryer qidiruv natijasida bo'lmasa ham ro'yxatda qoladi (maydonda nomi ko'rinsin). */
  const pool = useMemo(() => {
    const list = [...candidates.couriers];
    if (courier && !list.some((item) => item.id === courier.id)) list.unshift(courier);
    return list;
  }, [candidates.couriers, courier]);

  const eligibility = useMemo(() => {
    const map = new Map<string, CourierEligibility>();
    for (const item of pool) map.set(item.id, courierEligibility(item, accounts));
    return map;
  }, [pool, accounts]);

  const okCount = pool.filter((item) => eligibility.get(item.id)?.ok).length;
  const blockedCount = pool.length - okCount;
  const groupOk = t("carrier.create.groupOk", { count: okCount });
  const groupBlocked = t("carrier.create.groupBlocked", { count: blockedCount });

  const options = useMemo<SelectOption[]>(() => {
    const toOption = (item: CarrierCourier): SelectOption => {
      const ok = Boolean(eligibility.get(item.id)?.ok);
      return {
        value: item.id,
        // Yopiq maydondagi matn (maket: «Shahar Kargo kuryeri · +998 93 555 18 20»).
        label: [item.name, item.phone ? formatPhone(item.phone) : ""].filter(Boolean).join(" · ") || item.id,
        disabled: !ok,
        group: ok ? groupOk : groupBlocked,
      };
    };
    const ok = pool.filter((item) => eligibility.get(item.id)?.ok).map(toOption);
    const blocked = pool.filter((item) => !eligibility.get(item.id)?.ok).map(toOption);
    return [...ok, ...blocked];
  }, [eligibility, groupBlocked, groupOk, pool]);

  const byId = useMemo(() => new Map(pool.map((item) => [item.id, item])), [pool]);

  const reasonOf = (item: CarrierCourier) => {
    const result = eligibility.get(item.id);
    if (!result || result.ok) {
      return hqBranchId && item.branch && item.branch.id !== hqBranchId
        ? { text: t("carrier.create.reasonNotHq"), warn: false }
        : null;
    }
    if (result.reason === "inactive")
      return { text: t("carrier.create.reasonInactive"), warn: true };
    return {
      text: t(
        result.account.is_active
          ? "carrier.create.reasonBound"
          : "carrier.create.reasonBoundStopped",
        {
          name: result.account.name,
        },
      ),
      warn: true,
    };
  };

  const nameError = touched && !name.trim() ? t("carrier.create.nameEmpty") : undefined;
  const courierError = touched && !courier ? t("carrier.create.courierRequired") : undefined;
  const canSubmit = Boolean(name.trim()) && Boolean(courier) && check.valid;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setTouched(true);
    if (!canSubmit || !courier || inFlightRef.current) return;
    inFlightRef.current = true;
    setServerError(null);
    const dto: CreateCarrierAccountDto = {
      name: name.trim(),
      courier_id: courier.id,
      ...(check.rules.length ? { ip_allowlist: check.rules } : {}),
    };
    try {
      const result = await create.mutateAsync(dto);
      const created: CarrierCreated = {
        accountId: result.id,
        reveal: {
          variant: "created",
          accountName: result.name || dto.name,
          courierName: result.courier_name ?? courier.name,
          apiKey: result.api_key,
        },
      };
      // Kalit mutatsiya holatida qolmasin (`gcTime: 0`): endi u faqat kalit oynasida.
      create.reset();
      onCreated(created);
    } catch (error) {
      const kind = classifyCarrierError(error, { serverErrorUnknown: true });
      if (kind === "busy") {
        setServerError({ kind, courierId: courier.id });
      } else if (kind === "courier") {
        invalidateCarrierCourier(client, courier.id);
        setServerError({ kind });
      } else if (kind === "unavailable") {
        setServerError({ kind });
      } else if (kind === "unknown") {
        setUnknownName(dto.name);
      } else {
        notify.error(getBackendErrorMessage(error) || t("carrier.create.failed"));
      }
    } finally {
      inFlightRef.current = false;
    }
  };

  const hqLabel = hqName || t("carrier.hqFallback");
  const selectedNotHq = Boolean(
    courier && hqBranchId && courier.branch && courier.branch.id !== hqBranchId,
  );
  const selectedHq = Boolean(courier && hqBranchId && courier.branch?.id === hqBranchId);

  const busyAccount =
    serverError?.kind === "busy"
      ? (accounts.find((item) => item.courier_user_id === serverError.courierId) ?? null)
      : null;

  const serverAlert = serverError ? (
    serverError.kind === "busy" ? (
      <InlineAlert
        tone="danger"
        title={t("carrier.create.busyTitle")}
        actionPlacement="below"
        action={
          busyAccount ? (
            <Button
              variant="secondary"
              size="sm"
              className="max-md:min-h-11"
              onClick={() => onOpenAccount(busyAccount.id)}
            >
              {t("carrier.create.busyOpen", { name: busyAccount.name })}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={RefreshCw}
              className="max-md:min-h-11"
              onClick={onRefreshList}
            >
              {t("carrier.create.refreshList")}
            </Button>
          )
        }
      >
        {busyAccount
          ? t("carrier.create.busyKnown", { name: busyAccount.name, id: busyAccount.id })
          : t("carrier.create.busyRace")}
      </InlineAlert>
    ) : serverError.kind === "courier" ? (
      <InlineAlert tone="danger" title={t("carrier.create.courierFailTitle")}>
        {t("carrier.create.courierFailText")}
      </InlineAlert>
    ) : (
      <InlineAlert tone="danger" title={t("carrier.create.unavailableTitle")}>
        {t("carrier.create.unavailableText")}
      </InlineAlert>
    )
  ) : null;

  return (
    <>
      <Dialog
        open={open && unknownName === null}
        onClose={close}
        busy={create.isPending}
        title={t("carrier.create.title")}
        description={t("carrier.create.desc")}
        icon={PackageCheck}
        size="lg"
        initialFocus={nameRef}
        onSubmit={(event) => void submit(event)}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={create.isPending}>
              {t("carrier.cancel")}
            </Button>
            <Button
              type="submit"
              leftIcon={KeyRound}
              // IP xatosi — darhol (maket «Tekshiruv: HQ tavsiyasi va IP xatolari»); nom / kuryer — birinchi
              // bosishdan keyin (bosish bo'sh majburiy maydonlarni ko'rsatadi).
              disabled={!check.valid || (touched && !canSubmit)}
              loading={create.isPending}
            >
              {t("carrier.create.submit")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {serverAlert ?? (
            <InlineAlert
              tone="info"
              title={t("carrier.create.introTitle")}
              actionPlacement="below"
              action={
                // So'rov ketayotganda havola yo'q (`<a>` o'chirilmaydi — yashiriladi): sahifa almashsa javobdagi bir
                // martalik kalit hech kimga ko'rinmay yo'qolardi, akkaunt esa yaratilgan bo'lardi (qayta urinish — 409).
                create.isPending ? undefined : (
                  <Link
                    to="/all-users/create-user"
                    className={buttonClasses({
                      variant: "secondary",
                      size: "sm",
                      className: "max-md:min-h-11",
                    })}
                  >
                    <UserPlus size={16} aria-hidden="true" />
                    {t("carrier.create.addCourier")}
                  </Link>
                )
              }
            >
              {t("carrier.create.introText", { hq: hqLabel })}
            </InlineAlert>
          )}
          <Field
            label={t("carrier.create.name")}
            required
            hint={t("carrier.create.nameHint")}
            error={nameError}
          >
            <TextInput
              ref={nameRef}
              value={name}
              onValueChange={setName}
              maxLength={200}
              autoComplete="off"
            />
          </Field>
          <Field
            label={t("carrier.create.courier")}
            labelAs="span"
            required
            error={courierError}
            hint={courier ? undefined : t("carrier.create.courierHint")}
          >
            <Select
              searchable
              filter={false}
              value={courier?.id ?? null}
              onChange={(value) => {
                setCourier(value ? (byId.get(value) ?? null) : null);
                setServerError(null);
              }}
              onSearchChange={setQuery}
              onOpenChange={setPickerOpen}
              options={options}
              placeholder={t(
                pickerOpen ? "carrier.create.courierSearch" : "carrier.create.courierPlaceholder",
              )}
              loading={candidates.isLoading || (candidates.isFetching && options.length === 0)}
              loadingText={t("carrier.create.courierLoading")}
              noOptionsText={candidates.isError ? t("carrier.create.courierLoadError") : undefined}
              renderOption={(option, { selected }) => {
                const item = byId.get(option.value);
                if (!item) return option.label;
                const reason = reasonOf(item);
                return (
                  <span className="flex min-w-0 items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className={cx(
                        "inline-flex size-8 flex-none items-center justify-center rounded-full text-xs font-semibold",
                        selected ? "bg-surface text-action-fg" : "bg-sunken text-text-muted",
                      )}
                    >
                      {initialsOf(item.name || item.phone)}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span>{item.name || item.phone}</span>
                      <span className="text-xs font-medium text-text-muted">
                        {courierSubline(item)}
                      </span>
                      {reason ? (
                        <span
                          className={cx(
                            "text-xs",
                            reason.warn
                              ? "flex items-start gap-1 font-semibold text-warning-fg"
                              : "font-medium text-text-muted",
                          )}
                        >
                          {reason.warn ? (
                            <TriangleAlert size={14} aria-hidden="true" className="mt-px flex-none" />
                          ) : null}
                          <span>{reason.text}</span>
                        </span>
                      ) : null}
                    </span>
                  </span>
                );
              }}
            />
          </Field>
          {courier && selectedNotHq ? (
            <InlineAlert
              tone="warning"
              title={t("carrier.create.notHqTitle", { branch: courier.branch?.name ?? "" })}
            >
              {t("carrier.create.notHqText", { branch: courier.branch?.name ?? "", hq: hqLabel })}
            </InlineAlert>
          ) : courier && selectedHq ? (
            <p className="-mt-2 flex items-start gap-2 text-[13px] leading-[18px] text-success-fg">
              <CircleCheck size={16} aria-hidden="true" className="mt-px flex-none" />
              <span>{t("carrier.create.hqOk", { hq: hqLabel })}</span>
            </p>
          ) : !courier && hqBranchId ? (
            <p className="-mt-2 flex items-start gap-1.5 text-xs text-text-muted">
              <Info size={16} aria-hidden="true" className="flex-none" />
              <span>{t("carrier.create.hqTip", { hq: hqLabel })}</span>
            </p>
          ) : null}
          <IpAllowlistField
            value={ipText}
            onValueChange={setIpText}
            check={check}
            hint={t(check.lines.length ? "carrier.create.ipHintChecked" : "carrier.create.ipHint")}
          />
        </div>
      </Dialog>

      <Dialog
        open={open && unknownName !== null}
        onClose={onClose}
        role="alertdialog"
        closable={false}
        returnFocus={openerRef}
        title={t("carrier.create.unknownTitle")}
        description={t("carrier.create.unknownDesc", { name: unknownName ?? "" })}
        icon={Clock}
        iconTone="warning"
        iconShape="circle"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t("carrier.close")}
            </Button>
            <Button
              leftIcon={RefreshCw}
              onClick={() => {
                onRefreshList();
                onClose();
              }}
            >
              {t("carrier.create.refreshList")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <InlineAlert tone="warning" role="alert" title={t("carrier.create.unknownAlertTitle")}>
            {t("carrier.create.unknownAlertText")}
          </InlineAlert>
          <NumberedSteps
            steps={[
              t("carrier.create.unknownStep1"),
              t("carrier.create.unknownStep2", { name: unknownName ?? "" }),
              t("carrier.create.unknownStep3"),
            ]}
          />
        </div>
      </Dialog>
    </>
  );
};
