import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ChartColumn, Compass, House, Plus, SearchX, ShoppingBag, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Button } from "../../../shared/ui/primitives/Button";
import { EmptyState } from "../../../shared/ui/primitives/EmptyState";
import { ErrorState } from "../../../shared/ui/primitives/ErrorState";
import { QueryBoundary, type QueryLike } from "../../../shared/ui/primitives/QueryBoundary";
import { SkeletonChart, SkeletonLines, SkeletonTable } from "../../../shared/ui/primitives/SkeletonPresets";
import { KitSection } from "../KitSection";
import { ThemePair } from "../ThemePair";

/**
 * «Yuklanish, bo'sh va xato holatlari» bo'limi (`?section=states`) — 3-bosqich: `EmptyState`, `ErrorState`,
 * skeletlar va `QueryBoundary`.
 *
 * Namunalar taxtalardan: `tizim-errors` 01 «Sahifa xatolari» (404, ilova xatosi) va 02 «Ro'yxat va karta ichidagi
 * holatlar» (aniq matnlari bilan), `tizim-loading` (kutish zinapoyasi, jadval skeleti, sekin izohi),
 * `tizim-charts` 05 «Holatlar» (grafik bo'sh / xato / yuklanmoqda). Oxirgi blok — jonli `QueryBoundary`:
 * tez javobda skelet chiqmaydi, sekin javobda 400 ms dan keyin chiqadi.
 */

const DemoBlock = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 flex-col gap-0.5">
      <h3 className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{title}</h3>
      {note ? <p className="text-[13px] text-text-muted">{note}</p> : null}
    </div>
    {children}
  </div>
);

/** Karta (maketdagi `.el-card` + `.el-card-head`): sarlavha, ostida holat. */
const DemoCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-surface">
    <div className="flex min-h-14 items-center border-b border-border px-5 max-md:px-4">
      <span className="text-base font-bold text-text">{title}</span>
    </div>
    <div className="flex flex-1 flex-col justify-center">{children}</div>
  </section>
);

const State = ({ name, children }: { name: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-2.5">
    <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{name}</span>
    {children}
  </div>
);

const GRID = "grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(360px,100%),1fr))] gap-x-4 gap-y-6";

const noop = () => {};

/** Namuna xatolari (axios shaklida). */
const SERVER_ERROR = { isAxiosError: true, response: { status: 500 } };
const OFFLINE_ERROR = { isAxiosError: true, code: "ERR_NETWORK", request: {} };
const FORBIDDEN_ERROR = { isAxiosError: true, response: { status: 403 } };

const APP_ERROR_DETAILS = "TypeError: Cannot read properties of undefined (reading 'map')\n    at OrdersTable (OrdersTable.tsx:465:31)";

type DemoRow = { id: number; name: string; amount: number };
const DEMO_ROWS: readonly DemoRow[] = [
  { id: 10241, name: "Dilnoza Karimova", amount: 185_000 },
  { id: 10240, name: "Aziz Rahimov", amount: 232_500 },
  { id: 10238, name: "Javohir Toshmatov", amount: 1_280_000 },
];

type DemoMode = "fast" | "slow" | "empty" | "error";
const DEMO_DELAY: Record<DemoMode, number> = { fast: 200, slow: 2500, empty: 600, error: 1200 };

/** Jonli `QueryBoundary`: tugma — yangi so'rov (oldingi ma'lumotsiz), javob vaqti va natijasi tanlanadi. */
const BoundaryDemo = () => {
  const { t } = useTranslation("ui");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState<QueryLike<readonly DemoRow[]>>({ data: DEMO_ROWS, isLoading: false });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const run = (mode: DemoMode) => {
    if (timer.current) clearTimeout(timer.current);
    setQuery({ data: undefined, isLoading: true, isFetching: true });
    timer.current = setTimeout(() => {
      if (mode === "error") {
        setQuery({ data: undefined, isLoading: false, isError: true, error: SERVER_ERROR, refetch: () => run("fast") });
        return;
      }
      setQuery({ data: mode === "empty" ? [] : DEMO_ROWS, isLoading: false });
    }, DEMO_DELAY[mode]);
  };

  const modes: readonly DemoMode[] = ["fast", "slow", "empty", "error"];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {modes.map((mode) => (
          <Button key={mode} variant="secondary" size="sm" onClick={() => run(mode)}>
            {t(`statesKit.demo.boundary.${mode}`)}
          </Button>
        ))}
      </div>
      <DemoCard title={t("statesKit.demo.boundary.title")}>
        <QueryBoundary
          query={query}
          skeleton="list"
          keepPreviousData={false}
          loadingLabel={t("statesKit.demo.boundary.loadingLabel")}
          empty={<EmptyState icon={ShoppingBag} title={t("statesKit.demo.boundary.emptyTitle")} />}
          className="min-h-[288px]"
        >
          {(rows) => (
            <ul className="flex flex-col">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-5 py-2 last:border-b-0 max-md:px-4"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-text">№{row.id}</span>
                    <span className="truncate text-[13px] text-text-muted">{row.name}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-text tabular-nums">
                    {formatMoneyLocalized(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </DemoCard>
    </div>
  );
};

export const StatesSection = () => {
  const { t } = useTranslation("ui");
  const columns = (["order", "customer", "region", "market", "status", "delivery", "amount"] as const).map((key) =>
    t(`statesKit.demo.columns.${key}`),
  );

  return (
    <KitSection id="states" title={t("kit.sections.states.title")} description={t("kit.sections.states.description")}>
      <ThemePair layout="stack">
        <div className="flex min-w-0 flex-col gap-8">
          <DemoBlock title={t("statesKit.groups.empty")} note={t("statesKit.groups.emptyNote")}>
            <div className={GRID}>
              <DemoCard title={t("statesKit.demo.boundary.title")}>
                <EmptyState
                  icon={ShoppingBag}
                  title={t("statesKit.demo.emptyOrders.title")}
                  description={t("statesKit.demo.emptyOrders.text")}
                  action={<Button leftIcon={Plus}>{t("statesKit.demo.emptyOrders.action")}</Button>}
                />
              </DemoCard>
              <DemoCard title={t("statesKit.demo.boundary.title")}>
                <EmptyState
                  icon={SearchX}
                  title={t("statesKit.demo.emptyFilter.title")}
                  description={t("statesKit.demo.emptyFilter.text")}
                  action={<Button variant="secondary">{t("statesKit.demo.emptyFilter.action")}</Button>}
                />
              </DemoCard>
            </div>
          </DemoBlock>

          <DemoBlock title={t("statesKit.groups.error")} note={t("statesKit.groups.errorNote")}>
            <div className={GRID}>
              <State name={t("statesKit.kinds.server")}>
                <ErrorState framed error={SERVER_ERROR} onRetry={noop} />
              </State>
              <State name={t("statesKit.kinds.offline")}>
                <ErrorState framed error={OFFLINE_ERROR} onRetry={noop} />
              </State>
              <State name={t("statesKit.kinds.forbidden")}>
                <ErrorState framed error={FORBIDDEN_ERROR} onRetry={noop} />
              </State>
              <State name={t("statesKit.kinds.section")}>
                <ErrorState framed kind="section" onRetry={noop} />
              </State>
            </div>
          </DemoBlock>

          <DemoBlock title={t("statesKit.groups.chart")} note={t("statesKit.groups.chartNote")}>
            <div className={GRID}>
              <EmptyState
                size="chart"
                icon={ChartColumn}
                title={t("statesKit.demo.chartEmpty.title")}
                description={t("statesKit.demo.chartEmpty.text")}
                action={
                  <Button variant="secondary" size="sm">
                    {t("statesKit.demo.chartEmpty.action")}
                  </Button>
                }
              />
              <ErrorState size="chart" kind="generic" description={t("statesKit.demo.chartError.text")} onRetry={noop} />
              {/* Ixcham — kichik reyting kartasida bo'sh joyni cho'zmaydi (dashboard «Top filiallar»). */}
              <EmptyState size="inline" icon={Trophy} title={t("statesKit.demo.inlineEmpty.title")} />
            </div>
          </DemoBlock>

          <DemoBlock title={t("statesKit.groups.page")} note={t("statesKit.groups.pageNote")}>
            <div className={GRID}>
              <EmptyState
                framed
                size="page"
                titleAs="h4"
                icon={Compass}
                overline={t("statesKit.demo.notFound.overline")}
                title={t("statesKit.demo.notFound.title")}
                description={t("statesKit.demo.notFound.text")}
                action={
                  <>
                    <Button leftIcon={House}>{t("statesKit.demo.notFound.home")}</Button>
                    <Button variant="secondary" leftIcon={ArrowLeft}>
                      {t("statesKit.demo.notFound.back")}
                    </Button>
                  </>
                }
              />
              <ErrorState
                framed
                size="page"
                titleAs="h4"
                kind="generic"
                overline={t("statesKit.demo.appError.overline")}
                title={t("statesKit.demo.appError.title")}
                description={t("statesKit.demo.appError.text")}
                onRetry={noop}
                actions={
                  <Button variant="secondary" leftIcon={House}>
                    {t("statesKit.demo.appError.home")}
                  </Button>
                }
                details={APP_ERROR_DETAILS}
              />
            </div>
          </DemoBlock>

          <DemoBlock title={t("statesKit.groups.loading")} note={t("statesKit.groups.loadingNote")}>
            <State name={t("statesKit.kinds.table")}>
              <SkeletonTable columns={columns} rows={4} mobileRows={3} slow />
            </State>
            <div className={GRID}>
              <State name={t("statesKit.kinds.lines")}>
                <div className="rounded-[14px] border border-border bg-surface p-5">
                  <SkeletonLines />
                </div>
              </State>
              <State name={t("statesKit.kinds.chart")}>
                <div className="rounded-[14px] border border-border bg-surface pb-5 pt-1">
                  <SkeletonChart />
                </div>
              </State>
            </div>
          </DemoBlock>

          <DemoBlock title={t("statesKit.groups.boundary")} note={t("statesKit.groups.boundaryNote")}>
            <BoundaryDemo />
          </DemoBlock>
        </div>
      </ThemePair>
    </KitSection>
  );
};
