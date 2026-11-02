// dizayn-v2: superadmin-users-list, admin-users-list, manager-users-list, superadmin-users-list-telegram, admin-users-list-telegram, superadmin-users-list-roles, superadmin-users-list-role-select, superadmin-users-delete-dialog, admin-users-delete-dialog
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { CircleCheck, Plus, SearchX, Send, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../app/config/store";
import { useUser, type IUserFilter } from "../../../entities/user/api/userApi";
import { readViewerBranch } from "../../../features/user/lib/viewerBranch";
import { cx } from "../../../shared/lib/cx";
import { usePagination } from "../../../shared/lib/usePagination";
import {
  Button,
  buttonClasses,
  Card,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Pagination,
  Pressable,
  QueryBoundary,
  Select,
  SkeletonTable,
  Tabs,
  TextInput,
  type SelectOption,
  type TabItem,
} from "../../../shared/ui/primitives";
import { UserListKpi } from "../../../widgets/user-list/ui/UserListKpi";
import { UserListTable } from "../../../widgets/user-list/ui/UserListTable";
import { EXTERNAL_ROLES, MANAGER_TABS, STAFF_ROLES, STAFF_TABS } from "./roleTabs";

/** Qidiruv URL'ga yozilishidan oldin kutish (avvalgi `FilterSearch` kabi). */
const SEARCH_DEBOUNCE_MS = 500;
const PAGE_SIZES = [10, 25, 50, 100] as const;

/** Tab nomi kaliti: `v2.list.tabs.<kalit>` (`market_operator` → `marketOperator`). */
const tabLabelKey = (value: string) => (value === "market_operator" ? "marketOperator" : value || "all");
const STATUS_VALUES = ["active", "inactive"] as const;
/**
 * yA31z7Rr / td89SKXQ — «Telegram boti: Barchasi · Ulangan · Ulanmagan» (maket `*-users-list-telegram`, ega qarori
 * 2026-10-19 tg-link S4). URL kaliti `telegram` (`linked` · `unlinked`; «Barchasi» — kalitsiz) → server filtri
 * `GET /users?telegram_linked=true|false` (sahifalash va sonlar to'g'ri; joriy sahifa frontendda filtrlanmaydi).
 */
const TELEGRAM_VALUES = ["linked", "unlinked"] as const;
type TelegramFilter = (typeof TELEGRAM_VALUES)[number];
const isTelegramFilter = (value: string): value is TelegramFilter =>
  (TELEGRAM_VALUES as readonly string[]).includes(value);

/** `.el-chip` (CODE-MAP §2): `aria-pressed` — tanlangan. */
const CHIP =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 " +
  "text-[13px] font-medium text-text hover:border-text-subtle aria-pressed:border-action aria-pressed:bg-action-soft " +
  "aria-pressed:font-semibold aria-pressed:text-action-fg max-md:h-11";

/** Eski URL kalitlari (`userRole`, `userStatus`, `userSearch`) — yangi `role/status/search` ga ko'chiriladi. */
const LEGACY_KEYS = { role: "userRole", status: "userStatus", search: "userSearch" } as const;

/** Eski `marketing` qiymati — «Marketlar» tabi (avvalgi `UserFilters` normalizatsiyasi). */
const normalizeRole = (value: string) => (value === "marketing" ? "market" : value);

/**
 * FOYDALANUVCHILAR — `/all-users` (dizayn v2).
 *
 * Maketlar: `superadmin-users-list` (= admin): sarlavha + «Foydalanuvchi qo'shish», KPI (jami, marketlar,
 * xodimlar), karta: rol tablari, qidiruv «Ism yoki telefon raqami» + «Holat: Barchasi», jadval, sahifalash;
 * `manager-users-list`: sarlavha «{filial} xodimlari va marketlari», KPI yo'q, 4 ta tab, amallar o'rnida «Ochish».
 *
 * FY-1 (`superadmin-users-list-roles`, `-role-select`): superadmin/admin — 9 ta rol tabi (FY-S1); telefonda tablar
 * o'rnida «Rol: Hammasi» `Select` (guruhlar «Xodimlar» / «Tashqi hisoblar»), URL kaliti o'sha `role`. Ko'rinuvchi
 * uchun tabda yo'q rol (eski `operator`, menejerdagi `admin` …) — «Hammasi» (so'rovga ham ketmaydi).
 * Market operatori qatorida market nomi (FY-S3) chizilmaydi — `GET /users` da yo'q (backend kerak).
 *
 * Holat URL'da (yagona manba): `role` (tab), `status`, `search`, `page`, `limit`. Filtr o'zgarsa — sahifa 1.
 * Eski `userRole/userStatus/userSearch` kalitlari o'qiladi va yangisiga ko'chiriladi. Avvalgi redux sinxroni
 * (`filter.userRole/userStatus`, `search.userSearch`) olib tashlandi — ularni boshqa hech kim o'qimaydi (grep).
 * So'rov: `GET /users?role&status&search&telegram_linked&page&limit` (`useUser().useGetUser`) — bitta so'rov, server
 * sahifalashi (avvalgi `market` + `marketing` birlashtirish olib tashlandi, FY-1).
 *
 * Tab sonlari (2CBnPAeg, maket `manager-users-list` — «Barchasi 16 · Kuryerlar 8 …»): faqat menejerda, `meta.countsByRole`
 * dan (backend endi filial ko'lamida, sahifalashdan oldin sanaydi; «Barchasi» — `meta.totalUsers`). Sonlar `role`
 * dan boshqa filtrlarga (qidiruv, holat) bo'ysunadi — ro'yxat bilan bir xil. Superadmin/admin maketida tab soni yo'q.
 *
 * «Telegram boti» chiplari (yA31z7Rr / td89SKXQ) — superadmin/admin (ustun ham faqat ularda), URL `telegram`.
 */
const UserListPage = memo(() => {
  const { t } = useTranslation(["users", "common", "ui"]);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewerRole = useSelector((state: RootState) => state.role.role);
  const branchName = useSelector((state: RootState) => readViewerBranch(state.user.user).name);
  // fix3 RBAC-16: holat almashtirish, tahrirlash va o'chirish faqat superadmin/admin
  // (backend boshqalarga doim 403) — menejer jadvalda ko'rmaydi.
  const canManageUsers = viewerRole === "superadmin" || viewerRole === "admin";
  const isManager = viewerRole === "manager";

  const { page, limit, setPage, setLimit } = usePagination({ key: "users", defaultLimit: 10 });
  const telegramLabelId = useId();

  const read = (key: keyof typeof LEGACY_KEYS) => searchParams.get(key) ?? searchParams.get(LEGACY_KEYS[key]) ?? "";
  const tabValues: readonly string[] = isManager ? MANAGER_TABS : STAFF_TABS;
  const urlRole = normalizeRole(read("role"));
  // Ko'rinuvchida tabi yo'q rol — «Hammasi» (URL o'zgartirilmaydi, so'rovga ham ketmaydi).
  const role = tabValues.includes(urlRole) ? urlRole : "";
  const status = read("status");
  const search = read("search");
  const telegramParam = searchParams.get("telegram") ?? "";
  // Ustun va chiplar faqat superadmin/admin'da — boshqa rol uchun URL kaliti so'rovga ketmaydi.
  const telegram: TelegramFilter | "" = canManageUsers && isTelegramFilter(telegramParam) ? telegramParam : "";

  // Eski kalitlar — bir marta yangisiga ko'chiriladi (havola va xatcho'plar ishlayveradi).
  const hasLegacyKeys = Object.values(LEGACY_KEYS).some((key) => searchParams.has(key));
  useEffect(() => {
    if (!hasLegacyKeys) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        (Object.keys(LEGACY_KEYS) as Array<keyof typeof LEGACY_KEYS>).forEach((key) => {
          const legacy = next.get(LEGACY_KEYS[key]);
          next.delete(LEGACY_KEYS[key]);
          if (legacy && !next.get(key)) next.set(key, key === "role" ? normalizeRole(legacy) : legacy);
        });
        return next;
      },
      { replace: true },
    );
  }, [hasLegacyKeys, setSearchParams]);

  /** Filtrni yozadi va sahifani 1 ga qaytaradi (avvalgi `resetPagination` xulqi). */
  const writeFilter = useCallback(
    (key: "role" | "status" | "search" | "telegram", value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          if (key !== "telegram") next.delete(LEGACY_KEYS[key]);
          if (next.has("page")) next.set("page", "1");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // ─── Qidiruv: maydon darhol, URL — kechikib ─────────────────────────────
  const [searchText, setSearchText] = useState(search);
  const [prevSearch, setPrevSearch] = useState(search);
  if (prevSearch !== search) {
    // URL tashqaridan o'zgardi (tozalash, orqaga/oldinga) — maydon ham.
    setPrevSearch(search);
    setSearchText(search);
  }
  const searchTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(searchTimer.current), []);
  const commitSearch = (value: string) => {
    window.clearTimeout(searchTimer.current);
    setSearchText(value);
    if (value.trim() !== search) writeFilter("search", value.trim());
  };
  const handleSearchInput = (value: string) => {
    setSearchText(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      if (value.trim() !== search) writeFilter("search", value.trim());
    }, SEARCH_DEBOUNCE_MS);
  };

  // ─── So'rovlar ─────────────────────────────────────────────────────────────
  const apiParams = useMemo(() => {
    const params: IUserFilter = { page, limit };
    if (role) params.role = role;
    if (status) params.status = status;
    if (search) params.search = search;
    if (telegram) params.telegram_linked = telegram === "linked" ? "true" : "false";
    return params;
  }, [limit, page, role, search, status, telegram]);

  const { useGetUser } = useUser();
  // Ikkala so'rov xatosi sahifada (`ErrorState`) — global xabar takrorlanmaydi.
  const listQuery = useGetUser(apiParams, !hasLegacyKeys, { silentError: true });
  // KPI — filtrsiz jami (qidiruv/holat o'zgarsa ham «Barcha foydalanuvchilar» o'zgarmaydi); faqat superadmin/admin.
  const kpiQuery = useGetUser({ page: 1, limit: 1 }, canManageUsers, { silentError: true });
  const kpiMeta = kpiQuery.data?.data?.meta;

  const listData = listQuery.data?.data;
  const meta = listData?.meta;
  const items = listData?.items;

  // ─── Ko'rinish ─────────────────────────────────────────────────────────────
  // 2CBnPAeg: menejer tablari sonlari — `countsByRole` (filial ko'lamida); «Barchasi» — `totalUsers`. Javobda yo'q
  // (eski backend) — son chizilmaydi (taxmin qilinmaydi).
  const countsByRole = meta?.countsByRole;
  const totalUsers = meta?.totalUsers;
  const tabs = useMemo<TabItem[]>(
    () =>
      tabValues.map((value) => {
        const count = !isManager || !countsByRole ? undefined : value ? (countsByRole[value] ?? 0) : totalUsers;
        return { value, label: t(`v2.list.tabs.${tabLabelKey(value)}`), ...(count === undefined ? {} : { count }) };
      }),
    [countsByRole, isManager, tabValues, t, totalUsers],
  );
  // Telefon (maket `superadmin-users-list-role-select`): «Hammasi», so'ng «Xodimlar» va «Tashqi hisoblar» guruhlari.
  const roleOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("v2.list.tabs.all") },
      ...STAFF_ROLES.map((value) => ({
        value,
        label: t(`v2.list.tabs.${tabLabelKey(value)}`),
        group: t("v2.list.roleGroups.staff"),
      })),
      ...EXTERNAL_ROLES.map((value) => ({
        value,
        label: t(`v2.list.tabs.${tabLabelKey(value)}`),
        group: t("v2.list.roleGroups.external"),
      })),
    ],
    [t],
  );
  const statusOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("v2.list.statusAll") },
      ...STATUS_VALUES.map((value) => ({ value, label: t(`v2.common.status.${value}`) })),
    ],
    [t],
  );

  const activeFilters = (status ? 1 : 0) + (search ? 1 : 0) + (telegram ? 1 : 0);
  const clearFilters = () => {
    window.clearTimeout(searchTimer.current);
    setSearchText("");
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        ["status", "search", "telegram", ...Object.values(LEGACY_KEYS)].forEach((key) => next.delete(key));
        if (next.has("page")) next.set("page", "1");
        return next;
      },
      { replace: true },
    );
  };

  const description = isManager
    ? branchName
      ? t("v2.list.descriptionBranch", { branch: branchName })
      : t("v2.list.descriptionOwnBranch")
    : t("v2.list.descriptionAll");

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("title")}
        description={description}
        actions={
          <Link to="/all-users/create-user" className={buttonClasses({ variant: "primary" })}>
            <Plus aria-hidden="true" size={18} strokeWidth={2} />
            {t("addUser")}
          </Link>
        }
      />

      {canManageUsers ? (
        // KPI so'rovi yiqilsa (va oldingi ma'lumot yo'q) — skelet abadiy aylanmasin: xato holati + «Qayta urinish».
        kpiQuery.isError && !kpiMeta ? (
          <Card as="section" aria-label={t("v2.list.kpiLabel")}>
            <ErrorState
              error={kpiQuery.error}
              onRetry={() => void kpiQuery.refetch()}
              retrying={kpiQuery.isFetching}
            />
          </Card>
        ) : (
          <UserListKpi
            totalUsers={kpiMeta ? (kpiMeta.totalUsers ?? kpiMeta.total) : undefined}
            totalMarkets={kpiMeta?.totalMarket}
            totalEmployees={kpiMeta?.totalEmployees}
            loading={kpiQuery.isLoading}
          />
        )
      ) : null}

      <Card
        as="section"
        padding="none"
        aria-label={t("v2.list.listLabel")}
        footer={
          meta && meta.total > 0 ? (
            <Pagination
              page={page}
              pageSize={limit}
              total={meta.total}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
              pageSizeOptions={PAGE_SIZES}
              summary={(range) => t("v2.list.pagination", range)}
            />
          ) : undefined
        }
      >
        {/* Superadmin/admin: 9 ta tab telefonga sig'maydi — u yerda «Rol» `Select` (pastda). Menejerda 4 ta — hamma joyda. */}
        <Tabs
          items={tabs}
          value={role}
          onValueChange={(next) => writeFilter("role", next)}
          ariaLabel={t("v2.list.tabsLabel")}
          listClassName="px-3"
          className={isManager ? undefined : "max-md:hidden"}
          countBusy={listQuery.isFetching}
        />

        <div
          role="group"
          aria-label={t("v2.list.filtersLabel")}
          className={cx(
            "flex flex-wrap items-center gap-3 px-5 py-4 max-md:px-4",
            isManager ? "border-t border-border" : "md:border-t md:border-border",
          )}
        >
          {isManager ? null : (
            <Field
              label={t("v2.list.roleFilter")}
              hideLabel
              labelAs="span"
              className="min-w-0 basis-full md:hidden"
            >
              <Select
                options={roleOptions}
                value={role || null}
                onChange={(next) => writeFilter("role", next ?? "")}
                placeholder={t("v2.list.tabs.all")}
                inlineLabel={t("v2.list.roleFilter")}
                listLabel={t("v2.list.tabsLabel")}
              />
            </Field>
          )}
          <TextInput
            mode="search"
            value={searchText}
            onValueChange={handleSearchInput}
            onClear={() => commitSearch("")}
            onSearch={commitSearch}
            placeholder={t("v2.list.searchPlaceholder")}
            aria-label={t("v2.list.searchLabel")}
            className="min-w-0 flex-[1_1_320px]"
          />
          <Field
            label={t("v2.list.statusFilter")}
            hideLabel
            labelAs="span"
            className="min-w-0 flex-[0_1_260px] max-md:basis-full"
          >
            <Select
              options={statusOptions}
              value={status || null}
              onChange={(next) => writeFilter("status", next ?? "")}
              placeholder={t("v2.list.statusAll")}
              inlineLabel={t("v2.list.statusFilter")}
              icon={CircleCheck}
            />
          </Field>
          {/* TG-B (`*-users-list-telegram`): «Telegram boti: Barchasi · Ulangan · Ulanmagan» chiplari (yA31z7Rr —
              server filtri) va ustun izohi ko'rinadigan qator (sarlavhadagi `title` faqat sichqonchada). */}
          {canManageUsers ? (
            <div
              role="group"
              aria-labelledby={telegramLabelId}
              className="flex basis-full flex-wrap items-center gap-2"
            >
              <span
                id={telegramLabelId}
                className="inline-flex flex-none items-center gap-1.5 text-[13px] text-text-muted"
              >
                <Send size={16} aria-hidden="true" />
                {t("tgBot.filterLabel")}
              </span>
              <span className="inline-flex flex-wrap gap-2">
                {(["", ...TELEGRAM_VALUES] as const).map((value) => (
                  <Pressable
                    key={value || "all"}
                    aria-pressed={telegram === value}
                    className={CHIP}
                    onClick={() => writeFilter("telegram", value)}
                  >
                    {value ? t(`tgBot.${value}`) : t("tgBot.filterAll")}
                  </Pressable>
                ))}
              </span>
              <p className="m-0 basis-full text-[13px] leading-[18px] text-text-muted">{t("tgBot.listHint")}</p>
            </div>
          ) : null}
        </div>

        <QueryBoundary
          query={{
            data: items,
            isLoading: listQuery.isLoading || hasLegacyKeys,
            isError: listQuery.isError,
            error: listQuery.error,
            refetch: listQuery.refetch,
          }}
          loading={
            <SkeletonTable
              framed={false}
              columns={[
                t("v2.list.columns.user"),
                t("v2.list.columns.phone"),
                t("v2.list.columns.role"),
                t("v2.list.columns.status"),
                // TG-B: «Telegram boti» ustuni (superadmin/admin) — skelet ham shu tartibda.
                ...(canManageUsers ? [t("tgBot.column")] : []),
                t("v2.list.columns.joined"),
              ]}
              rows={6}
            />
          }
          empty={
            activeFilters ? (
              <EmptyState
                icon={SearchX}
                title={t("v2.list.filteredEmpty")}
                description={t("v2.list.filteredEmptyDescription")}
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    {t("v2.list.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={Users} title={t("v2.list.empty")} description={t("v2.list.emptyDescription")} />
            )
          }
          error={(queryError, retry) => (
            <ErrorState error={queryError} title={t("v2.list.loadError")} onRetry={retry} />
          )}
          className="border-t border-border"
        >
          {(list, { isRefetching }) => (
            <UserListTable users={list} canManage={canManageUsers} busy={isRefetching} />
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
});

UserListPage.displayName = "UserListPage";

export default UserListPage;
