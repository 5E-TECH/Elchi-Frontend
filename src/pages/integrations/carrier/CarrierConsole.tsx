// dizayn-v2: superadmin-integrations-carrier-console, admin-integrations-carrier-console
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, PackageCheck, Plus, RefreshCw } from "lucide-react";
import { useHqBranch } from "../../../entities/branch";
import { useCarrierAccounts, type CarrierAccount } from "../../../entities/integrations/carriers";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatPhone } from "../../../shared/lib/formatPhone";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  IconButton,
  Pressable,
  SkeletonTable,
  TextInput,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { InlineAlert } from "../ui";
import { CarrierAccountDetail } from "./CarrierAccountDetail";
import { CarrierCreateDialog, type CarrierCreated } from "./CarrierCreateDialog";
import { CarrierEditDialog } from "./CarrierEditDialog";
import { CarrierKeyDialog, type CarrierKeyReveal } from "./CarrierKeyDialog";
import { CarrierRotateDialog } from "./CarrierRotateDialog";
import { CarrierStatusDialog } from "./CarrierStatusDialog";
import { accountState, keyBlocked, type CourierInfo } from "./carrierModel";
import { useCourierName } from "./carrierFormat";
import { CarrierStateBadge, NumberedSteps } from "./carrierParts";
import { useLinkedCouriers } from "./useCarrierCouriers";

/**
 * «TASHQI YETKAZUVCHILAR» — Integratsiyalar konsolining 4-tabi (maket `*-carrier-console`; faqat superadmin va
 * admin — `canManageCarrierAccounts`). Boshqa tablardan farqi: KPI bloki yo'q (Carrier API metrikasi API'da yo'q);
 * ro'yxat kartasi (tablar, izoh, qidiruv, jadval / telefonda kartalar) + tanlangan akkaunt kartasi.
 *
 * URL: `?scope=carrier&c=carrier:<id>` — tanlangan akkaunt (havola va yangilash tanlovni saqlaydi);
 * `&new=1` — «Yangi tashqi yetkazuvchi» oynasini ochish so'rovi (katalog kartasi, sarlavha tugmasi): ro'yxat
 * yuklangach BIR MARTA o'qiladi — oyna mahalliy holatga o'tadi, parametr URL'dan olinadi. Oyna ochiq-yopiqligi URL'ga
 * bog'liq emas (yopish — oddiy holat o'zgarishi; react-router URL yangilanishini `startTransition` da beradi).
 * Yaratish faqat ro'yxat yuklangach: aks holda band kuryerlar «Bog'lash mumkin» bo'lib ko'rinardi.
 * O'chirish yo'q (backendda yo'q) — ish tugasa akkaunt to'xtatiladi.
 */
const CARRIER_PREFIX = "carrier:";

type DialogState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; id: string }
  | { kind: "rotate"; id: string }
  | { kind: "status"; id: string };

export const CarrierConsole = ({ tabs }: { tabs: ReactNode }) => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  /** Bir martalik kalit — faqat shu holatda; oyna yopilishi bilan `null`. */
  const [reveal, setReveal] = useState<CarrierKeyReveal | null>(null);

  const accountsQuery = useCarrierAccounts({ silentError: true });
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  /**
   * Ro'yxat bor (keshda). Qayta so'rash yiqilsa ham (`isError`, lekin `data` bor — React Query v5) ko'rsatilgan
   * ro'yxat, tanlangan akkaunt va yaratish qoladi (`QueryBoundary` qoidasi); xato holati — faqat ma'lumot yo'q bo'lsa.
   */
  const listReady = accountsQuery.data !== undefined;
  /** Oynalar yopilgach fokus qaytadigan joylar (tafsilot kartasida). */
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rotateRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLButtonElement>(null);
  const couriers = useLinkedCouriers(
    accounts.map((account) => account.courier_user_id),
    accounts.length > 0,
  );
  const hq = useHqBranch(true);
  const courierName = useCourierName();
  const infoOf = (account: CarrierAccount): CourierInfo | undefined =>
    couriers.get(account.courier_user_id);

  const selectedParam = searchParams.get("c") ?? "";
  const selectedId = selectedParam.startsWith(CARRIER_PREFIX)
    ? selectedParam.slice(CARRIER_PREFIX.length)
    : "";
  const selected = accounts.find((account) => account.id === selectedId) ?? accounts[0];

  const setParams = (update: (params: URLSearchParams) => void) =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        update(params);
        return params;
      },
      { replace: true },
    );

  const select = (id: string) => setParams((params) => params.set("c", `${CARRIER_PREFIX}${id}`));

  /**
   * Ro'yxat yuklangach URL birinchi akkaunt bilan to'ldiriladi (havola nusxasi tanlovni saqlasin).
   * Ro'yxat yangilanayotganda kutiladi: yangi yaratilgan akkaunt tanlangan, lekin eski ro'yxatda hali
   * yo'q — birinchisiga «qaytib ketmasin».
   */
  const listFetching = accountsQuery.isFetching;
  useEffect(() => {
    if (!listFetching && selected && selectedId !== selected.id) {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("c", `${CARRIER_PREFIX}${selected.id}`);
          return params;
        },
        { replace: true },
      );
    }
  }, [listFetching, selected, selectedId, setSearchParams]);

  /**
   * Katalogdan yoki sarlavha tugmasidan `?new=1`: ro'yxat yuklangach yaratish oynasi ochiladi (render paytida, bir
   * marta — `newTaken`), keyin effekt parametrni URL'dan oladi. Ro'yxat yiqilgan bo'lsa — kutadi («Qayta urinish»).
   */
  const wantsNew = searchParams.get("new") === "1";
  const [newTaken, setNewTaken] = useState(false);
  if (wantsNew && listReady && !newTaken) {
    setNewTaken(true);
    setDialog({ kind: "create" });
  } else if (!wantsNew && newTaken) {
    setNewTaken(false);
  }
  useEffect(() => {
    if (!newTaken || !wantsNew) return;
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete("new");
        return params;
      },
      { replace: true },
    );
  }, [newTaken, wantsNew, setSearchParams]);
  const createOpen = dialog.kind === "create";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    // Telefon bo'yicha — faqat raqamli so'rovda (aks holda «FastPost 1» dagi «1» har telefonga mos kelardi).
    const digits = /^[\d\s+()-]+$/.test(q) ? q.replace(/\D/g, "") : "";
    return accounts.filter((account) => {
      const info = couriers.get(account.courier_user_id);
      const courier = info?.state === "ready" ? info.courier : null;
      return (
        account.name.toLowerCase().includes(q) ||
        Boolean(courier?.name.toLowerCase().includes(q)) ||
        Boolean(digits && courier?.phone.replace(/\D/g, "").includes(digits))
      );
    });
  }, [accounts, couriers, query]);

  const byId = (id: string) => accounts.find((account) => account.id === id) ?? null;
  const dialogAccount = (kind: DialogState["kind"]) =>
    dialog.kind === kind && "id" in dialog ? byId(dialog.id) : null;
  /** Oynani yopadi; `selectId` — shu bilan birga tanlanadigan akkaunt (yaratilgan yoki «X»ni ochish). */
  const closeDialog = (selectId?: string) => {
    setDialog({ kind: "none" });
    if (selectId) select(selectId);
  };
  const openCreate = () => {
    if (listReady) setDialog({ kind: "create" });
  };

  const onCreated = ({ accountId, reveal: next }: CarrierCreated) => {
    closeDialog(accountId || undefined);
    setReveal(next);
  };

  const ipLabel = (account: CarrierAccount, long: boolean) => {
    const count = account.ip_allowlist?.length ?? 0;
    return count
      ? t(long ? "carrier.ipRulesLong" : "carrier.ipRules", { count })
      : t(long ? "carrier.ipNoneLong" : "carrier.ipNone");
  };

  const nameButton = (account: CarrierAccount, stretched = false) => (
    <Pressable
      onClick={() => select(account.id)}
      aria-current={account.id === selected?.id ? "true" : undefined}
      className={cx(
        "text-left text-sm font-semibold text-text hover:text-action-fg hover:underline [overflow-wrap:anywhere]",
        stretched && "after:absolute after:inset-0 after:content-['']",
      )}
    >
      {account.name}
    </Pressable>
  );

  const courierCell = (account: CarrierAccount) => {
    const info = infoOf(account);
    if (info?.state === "ready") {
      const sub = [
        info.courier.phone ? formatPhone(info.courier.phone) : "",
        info.courier.branch?.name ?? "",
      ]
        .filter(Boolean)
        .join(" · ");
      return (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-text [overflow-wrap:anywhere]">
            {info.courier.name || courierName(account, info)}
          </span>
          {sub ? <span className="text-[13px] text-text-muted">{sub}</span> : null}
        </div>
      );
    }
    return (
      <span className="text-[13px] text-text-muted">
        {info?.state === "missing"
          ? t("carrier.courierMissingRow", { id: account.courier_user_id })
          : t("carrier.courierIdOnly", { id: account.courier_user_id })}
      </span>
    );
  };

  const columns: DataTableColumn<CarrierAccount>[] = [
    {
      id: "company",
      header: t("carrier.colCompany"),
      cell: (account) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          {nameButton(account)}
          <span className="text-[13px] text-text-muted">
            {t("carrier.idLabel", { id: account.id })}
          </span>
          <span className="hidden text-[13px] text-text-muted max-lg:block">
            {ipLabel(account, true)}
          </span>
        </div>
      ),
    },
    { id: "courier", header: t("carrier.colCourier"), cell: courierCell },
    {
      id: "status",
      header: t("carrier.colStatus"),
      cell: (account) => {
        const state = accountState(account, infoOf(account));
        return (
          <div className="flex flex-col items-start gap-1">
            <CarrierStateBadge state={state} />
            {account.is_active && keyBlocked(state) ? (
              <span className="text-[13px] text-text-muted">{t("carrier.keyBlocked")}</span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "ip",
      header: t("carrier.colIp"),
      hideBelow: "lg",
      cell: (account) =>
        account.ip_allowlist?.length ? (
          <span className="font-semibold text-text">{ipLabel(account, false)}</span>
        ) : (
          <span className="text-text-muted">{ipLabel(account, false)}</span>
        ),
    },
    {
      id: "created",
      header: t("carrier.colCreated"),
      hideBelow: "lg",
      className: "whitespace-nowrap",
      cell: (account) => (
        <span className={account.is_active ? "text-text" : "text-text-muted"}>
          {formatDateTimeLocalized(account.createdAt, { language })}
        </span>
      ),
    },
    {
      id: "open",
      header: <span className="sr-only">{t("carrier.colActions")}</span>,
      className: "w-16",
      cell: (account) => (
        <IconButton
          size="sm"
          icon={ChevronRight}
          label={t("carrier.openAccount", { name: account.name })}
          onClick={() => select(account.id)}
        />
      ),
    },
  ];

  const renderCard = (account: CarrierAccount) => {
    const info = infoOf(account);
    const state = accountState(account, info);
    const courier = info?.state === "ready" ? info.courier : null;
    return (
      <div
        className={cx(
          "flex min-w-0 flex-col gap-1 px-4 py-3",
          account.id === selected?.id && "bg-action-soft",
        )}
      >
        {nameButton(account, true)}
        <span className="text-[13px] text-text-muted [overflow-wrap:anywhere]">
          {courier
            ? [courier.name, courier.phone ? formatPhone(courier.phone) : ""]
                .filter(Boolean)
                .join(" · ")
            : info?.state === "missing"
              ? t("carrier.courierMissingRow", { id: account.courier_user_id })
              : t("carrier.courierIdOnly", { id: account.courier_user_id })}
        </span>
        <span className="text-[13px] text-text-muted">
          {[courier?.branch?.name, ipLabel(account, true)].filter(Boolean).join(" · ")}
        </span>
        <span className="flex flex-wrap gap-1.5">
          <CarrierStateBadge state={state} />
          {account.is_active && keyBlocked(state) ? (
            // O'chirilgan kuryerda xavfli «Kuryer topilmadi» yonida — neytral (maket).
            <Badge tone={state === "courierMissing" ? "neutral" : "warning"}>
              {t("carrier.keyBlocked")}
            </Badge>
          ) : null}
        </span>
      </div>
    );
  };

  const loading = accountsQuery.isPending;
  const loadError = accountsQuery.isError && !listReady;
  /** Ro'yxat ko'rinib turibdi, lekin yangilab bo'lmadi: `silentError` — umumiy xabar yo'q, izoh shu yerda. */
  const refreshError = accountsQuery.isError && listReady && !accountsQuery.isFetching;
  const hqLabel = hq?.name || t("carrier.hqFallback");

  return (
    <>
      <Card padding="none" aria-label={t("carrier.listAria")}>
        {tabs}
        <div className="flex flex-col gap-3 px-5 py-4 max-md:px-4">
          <p className="text-[13px] leading-[18px] text-text-muted">{t("carrier.subtitle")}</p>
          {!loading && !loadError && accounts.length > 0 ? (
            <TextInput
              mode="search"
              value={query}
              onValueChange={setQuery}
              placeholder={t("carrier.searchPlaceholder")}
              aria-label={t("carrier.searchAria")}
            />
          ) : null}
          {!loading && accounts.length > 0 && filtered.length === 0 ? (
            <p className="text-[13px] text-text-muted">{t("searchEmpty", { q: query.trim() })}</p>
          ) : null}
          {loadError || refreshError ? (
            <InlineAlert
              tone={loadError ? "danger" : "warning"}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={RefreshCw}
                  onClick={() => void accountsQuery.refetch()}
                  className="max-md:min-h-11"
                >
                  {t("retry")}
                </Button>
              }
            >
              {t(loadError ? "carrier.loadError" : "carrier.refreshError")}
            </InlineAlert>
          ) : null}
        </div>
        {loading ? (
          <SkeletonTable
            framed={false}
            rows={3}
            columns={[
              t("carrier.colCompany"),
              t("carrier.colCourier"),
              t("carrier.colStatus"),
              t("carrier.colIp"),
              t("carrier.colCreated"),
            ]}
            className="border-t border-border"
          />
        ) : loadError ? null : accounts.length === 0 ? (
          <EmptyState
            className="border-t border-border"
            icon={PackageCheck}
            title={t("carrier.empty.title")}
            description={t("carrier.empty.text")}
            footer={
              <>
                <NumberedSteps
                  className="mx-auto mt-2 max-w-[380px]"
                  steps={[
                    t("carrier.empty.step1", { hq: hqLabel }),
                    t("carrier.empty.step2"),
                    t("carrier.empty.step3"),
                  ]}
                />
                <div className="mt-3 flex justify-center">
                  <Button variant="secondary" leftIcon={Plus} onClick={openCreate}>
                    {t("carrier.newButton")}
                  </Button>
                </div>
              </>
            }
          />
        ) : filtered.length > 0 ? (
          <DataTable
            rows={filtered}
            columns={columns}
            getRowKey={(account) => account.id}
            label={t("carrier.listAria")}
            cardsLabel={t("carrier.listAria")}
            density="tablet-tight"
            onRowClick={(account) => select(account.id)}
            rowClassName={(account) =>
              account.id === selected?.id ? "bg-action-soft hover:bg-action-soft" : null
            }
            renderCard={renderCard}
            busy={accountsQuery.isFetching && !accountsQuery.isPending}
            className="border-t border-border"
          />
        ) : null}
      </Card>

      {selected && !loadError ? (
        <CarrierAccountDetail
          account={selected}
          info={infoOf(selected)}
          hqBranchId={hq?.id ?? null}
          onEdit={() => setDialog({ kind: "edit", id: selected.id })}
          onRotate={() => setDialog({ kind: "rotate", id: selected.id })}
          onStatus={() => setDialog({ kind: "status", id: selected.id })}
          onCreate={openCreate}
          headingRef={headingRef}
          rotateRef={rotateRef}
          statusRef={statusRef}
        />
      ) : null}

      <CarrierCreateDialog
        open={createOpen}
        accounts={accounts}
        hqBranchId={hq?.id ?? null}
        hqName={hqLabel}
        onClose={() => closeDialog()}
        onCreated={onCreated}
        onOpenAccount={(id) => closeDialog(id)}
        onRefreshList={() => void accountsQuery.refetch()}
      />
      <CarrierEditDialog
        account={dialogAccount("edit")}
        couriers={couriers}
        onClose={() => closeDialog()}
      />
      <CarrierRotateDialog
        account={dialogAccount("rotate")}
        couriers={couriers}
        returnFocus={rotateRef}
        onClose={() => closeDialog()}
        onRotated={(next) => {
          closeDialog();
          setReveal(next);
        }}
      />
      <CarrierStatusDialog
        account={dialogAccount("status")}
        couriers={couriers}
        returnFocus={statusRef}
        onClose={() => closeDialog()}
      />
      <CarrierKeyDialog
        reveal={reveal}
        returnFocus={headingRef}
        onClose={() => setReveal(null)}
      />
    </>
  );
};
