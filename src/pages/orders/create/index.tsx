import { memo, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ListPlus, Package, SendHorizontal } from "lucide-react";
import { FormProvider, useForm, useWatch, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import HeaderName from "../../../shared/components/headerName";
import OrderStepper from "./ui/OrderStepper";
import Step1Market from "./ui/Step1Market";
import Step2Combined from "./ui/Step2Combined";
import { FormStateNote, getActionButtonClassName } from "./ui/formFieldStyles";
import { useOrders } from "../../../entities/order/api/orderApi";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import type { RootState } from "../../../app/config/store";
import {
  buildCreateOrderPayload,
  createOrderSchema,
  ORDER_CREATE_DEFAULT_VALUES,
  type MarketOption,
  type OrderCreateFormValues,
} from "./model/orderCreateForm";
import { useOrders as useIncomingOrders } from "../../../entities/orders";
import type { ApiOrder } from "../../new_orders/components/OrderCard";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import OrderStatusBadge from "../list/OrderStatusBadge";

type MarketNewOrdersTableProps = {
  marketId?: number;
  marketName?: string;
  onRowClick: (order: ApiOrder) => void;
};

const formatMoney = (value: number) => `${(value ?? 0).toLocaleString("uz-UZ")} so'm`;

const formatCreatedAt = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const MarketNewOrdersTable = ({
  marketId,
  marketName,
  onRowClick,
}: MarketNewOrdersTableProps) => {
  const { t } = useTranslation("orders");
  const { getTodayOrdersByMarket } = useIncomingOrders();
  const enabled = Boolean(marketId);
  const { data, isLoading } = getTodayOrdersByMarket(marketId ?? 0, undefined, enabled);
  const orders: ApiOrder[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

  const columns = useMemo<ColumnConfig<ApiOrder>[]>(
    () => [
      {
        key: "customer",
        label: t("customer"),
        render: (customer: ApiOrder["customer"]) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-maindark dark:text-primary">
              {customer?.name ?? "—"}
            </p>
            <p className="text-xs text-gray-400">{customer?.phone_number ?? ""}</p>
          </div>
        ),
      },
      {
        key: "address",
        label: `${t("filterRegion")} / ${t("district")}`,
        render: (_: ApiOrder["address"], order) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-maindark dark:text-primary">
              {order.customer?.district?.name ?? order.district?.name ?? "—"}
            </p>
            <p className="truncate text-xs text-gray-400">
              {order.customer?.region?.name ?? order.region?.name ?? order.address ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "where_deliver",
        label: t("deliveryType"),
        render: (whereDeliver: ApiOrder["where_deliver"]) => (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              whereDeliver === "center"
                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                : "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
            }`}
          >
            {whereDeliver === "center" ? t("deliveryCenter") : t("deliveryHome")}
          </span>
        ),
      },
      {
        key: "status",
        label: t("orderStatus"),
        render: (status: ApiOrder["status"]) => <OrderStatusBadge status={status as never} />,
      },
      {
        key: "total_price",
        label: t("sumLabel"),
        render: (totalPrice: ApiOrder["total_price"]) => (
          <span className="text-sm font-semibold text-maindark dark:text-primary">
            {formatMoney(totalPrice)}
          </span>
        ),
      },
      {
        key: "createdAt",
        label: t("date"),
        render: (createdAt: ApiOrder["createdAt"]) => (
          <span className="whitespace-nowrap text-xs text-gray-400">
            {formatCreatedAt(createdAt)}
          </span>
        ),
      },
    ],
    [t],
  );

  if (!marketId) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-primary p-4 shadow-sm dark:border-primarydark dark:bg-maindark sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-main/10 text-main">
              <Package size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-maindark dark:text-primary">
                {t("newOrders")}
              </h3>
              <p className="truncate text-xs text-gray-400">
                {marketName ?? "—"}
              </p>
            </div>
          </div>
        </div>
        <span className="rounded-full bg-main/10 px-3 py-1 text-xs font-bold text-main">
          {t("totalOrdersSummary", { count: orders.length })}
        </span>
      </div>

      <Table
        data={orders}
        columns={columns}
        keyExtractor={(order) => order.id}
        loading={isLoading}
        emptyMessage={t("ordersNotFound")}
        onRowClick={onRowClick}
        hoverable
        bordered
      />
    </section>
  );
};

const StepActions = ({
  step,
  canNext,
  isSubmitting,
  onBack,
  onNext,
  isMarketRole,
}: {
  step: number;
  canNext: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onNext: () => void;
  isMarketRole: boolean;
}) => {
  const { t } = useTranslation(["orders", "common"]);
  const stepsLength = 2;

  return (
    <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm px-4 py-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onBack}
        className={`${getActionButtonClassName({ variant: "secondary" })} w-full sm:w-auto`}
      >
        <ChevronLeft size={16} />
        {step === 1 || isMarketRole ? t("back", { ns: "common" }) : t("previous", { ns: "common" })}
      </button>

      <div className="flex w-full flex-col items-center gap-2 px-0 text-center sm:w-auto sm:px-4">
        <span className="text-xs text-gray-400 font-medium">
          {step} / {stepsLength}
        </span>
        {isSubmitting ? (
          <FormStateNote
            state="loading"
            message={t("createSubmitting")}
          />
        ) : canNext ? (
          <FormStateNote
            state="success"
            message={step < 2 ? t("stepReadyMessage") : t("orderReadyMessage")}
          />
        ) : (
          <FormStateNote
            state="info"
            message={step < 2 ? t("selectMarketFirst") : t("fillRequiredFields")}
          />
        )}
      </div>

      {step < 2 ? (
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className={getActionButtonClassName({
            variant: "primary",
            disabled: !canNext,
          }) + " w-full sm:w-auto"}
        >
          {t("next", { ns: "common" })}
          <ChevronRight size={16} />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canNext || isSubmitting}
          className={getActionButtonClassName({
            variant: "primary",
            disabled: !canNext || isSubmitting,
          }) + " w-full sm:w-auto"}
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              {t("submitting", { ns: "common" })}
            </>
          ) : (
            <>
              <SendHorizontal size={16} />
              {t("create")}
            </>
          )}
        </button>
      )}
    </div>
  );
};

const OrderCreateFormContent = () => {
  const { t } = useTranslation(["orders", "common"]);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { createOrder } = useOrders();
  const { api } = useAppNotification();
  const role = useSelector((state: RootState) => state.role.role);
  const isMarketRole = role === "market";
  const navigationState = location.state as { selectedMarket?: MarketOption } | null;
  const selectedMarketFromState = navigationState?.selectedMarket ?? null;
  const [step, setStep] = useState(
    isMarketRole || selectedMarketFromState ? 2 : 1,
  );
  const steps = useMemo(
    () => [
      { id: 1, label: t("stepOneLabel"), description: t("stepOneDescription") },
      { id: 2, label: t("stepTwoLabel"), description: t("stepTwoDescription") },
    ],
    [t],
  );

  const methods = useForm<OrderCreateFormValues>({
    resolver: yupResolver(
      createOrderSchema(!isMarketRole),
    ) as Resolver<OrderCreateFormValues>,
    mode: "onTouched",
    defaultValues: {
      ...ORDER_CREATE_DEFAULT_VALUES,
      market: selectedMarketFromState,
    },
  });

  const { control, handleSubmit, trigger, reset } = methods;

  const market = useWatch({ control, name: "market" });
  const customer = useWatch({ control, name: "customer" });
  const details = useWatch({ control, name: "details" });
  const selectedMarketId = market?.id ?? selectedMarketFromState?.id;

  const canNext = useMemo(() => {
    if (step === 1) {
      return isMarketRole || !!market;
    }

    return Boolean(
      (isMarketRole || market) &&
        customer?.phone?.trim() &&
        customer?.name?.trim() &&
        customer?.region_id &&
        customer?.district_id &&
        details?.items?.length &&
        details?.total_price?.trim(),
    );
  }, [customer, details, isMarketRole, market, step]);

  const handleBack = () => {
    if (step === 1 || isMarketRole) {
      navigate("/orders");
      return;
    }

    setStep((current) => current - 1);
  };

  const handleNext = async () => {
    if (isMarketRole) {
      setStep(2);
      return;
    }

    const isValid = await trigger("market");
    if (isValid) {
      setStep(2);
    }
  };

  const onSubmit = (values: OrderCreateFormValues) => {
    createOrder.mutate(buildCreateOrderPayload(values, { includeMarketId: !isMarketRole }), {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
        reset({
          ...ORDER_CREATE_DEFAULT_VALUES,
          market: isMarketRole ? null : values.market,
        });
        setStep(2);
        api.success({
          message: t("success", { ns: "common" }),
          description: isMarketRole
            ? t("orderCreatedMarketRole")
            : t("orderCreatedForMarket"),
          placement: "topRight",
          duration: 4,
        });
      },
    });
  };

  const handleFinalSubmit = async () => {
    const isValid = await trigger([
      "customer.phone",
      "customer.name",
      "customer.region_id",
      "customer.district_id",
      "details.items",
      "details.total_price",
      "details.where_deliver",
    ]);

    if (!isValid) return;

    await handleSubmit(onSubmit)();
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleFinalSubmit();
        }}
        className="p-3 sm:p-6 rounded-2xl bg-sidebar dark:bg-maindark flex flex-col gap-3 sm:gap-6 min-h-full"
      >
        <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm px-3 sm:px-4">
          <HeaderName
            name={t("newOrders")}
            description={t("createPageDescription")}
            icon={<ListPlus />}
          />
        </div>

        <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm p-2 sm:p-3">
          <OrderStepper
            steps={steps}
            currentStep={step}
            stepNotes={!isMarketRole && market?.name ? { 1: market.name } : undefined}
            hiddenDescriptions={step > 1 ? [1] : undefined}
          />
        </div>

        <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm p-3 sm:p-6 flex-1">
          {!isMarketRole && step === 1 && <Step1Market />}
          {step === 2 && <Step2Combined />}
        </div>

        <StepActions
          step={step}
          canNext={canNext}
          isSubmitting={createOrder.isPending}
          isMarketRole={isMarketRole}
          onBack={handleBack}
          onNext={() => {
            void handleNext();
          }}
        />

        <MarketNewOrdersTable
          marketId={selectedMarketId}
          marketName={market?.name ?? selectedMarketFromState?.name}
          onRowClick={(order) =>
            navigate(`/new-orders/${selectedMarketId}/edit/${order.id}`)
          }
        />
      </form>
    </FormProvider>
  );
};

const OrderCreate = () => <OrderCreateFormContent />;

export default memo(OrderCreate);
