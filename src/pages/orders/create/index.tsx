import { memo, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ListPlus, Package, SendHorizontal, Store } from "lucide-react";
import {
  FormProvider,
  useForm,
  useWatch,
  type Path,
  type Resolver,
  type UseFormSetError,
} from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import HeaderName from "../../../shared/components/headerName";
import Step1Market from "./ui/Step1Market";
import Step2Combined from "./ui/Step2Combined";
import { FormFieldError, getActionButtonClassName } from "./ui/formFieldStyles";
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
import OrdersTable from "../list/OrdersTable";
import type { OrderListItem } from "../../../entities/order/types/order";
import { isInactiveMarketStatus } from "../../../shared/lib/marketStatus";

type BackendErrorPayload = {
  message?: unknown;
  error?: unknown;
  detail?: unknown;
  errors?: unknown;
  data?: {
    message?: unknown;
    errors?: unknown;
  };
};

const normalizeBackendMessage = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(normalizeBackendMessage).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(normalizeBackendMessage)
      .filter(Boolean)
      .join(", ");
  }
  return String(value);
};

const getBackendPayload = (error: unknown): BackendErrorPayload | undefined =>
  (error as { response?: { data?: BackendErrorPayload } })?.response?.data;

const getOrderCreateErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  const data = getBackendPayload(error);

  return (
    normalizeBackendMessage(data?.message) ||
    normalizeBackendMessage(data?.data?.message) ||
    normalizeBackendMessage(data?.errors) ||
    normalizeBackendMessage(data?.data?.errors) ||
    normalizeBackendMessage(data?.detail) ||
    normalizeBackendMessage(data?.error) ||
    normalizeBackendMessage((error as { message?: unknown })?.message) ||
    fallback
  );
};

const orderCreateFieldErrorMap: Record<string, Path<OrderCreateFormValues>> = {
  phone: "customer.phone",
  phone_number: "customer.phone",
  "customer.phone": "customer.phone",
  "customer.phone_number": "customer.phone",
  extra_phone: "customer.extra_phone",
  "customer.extra_phone": "customer.extra_phone",
  name: "customer.name",
  "customer.name": "customer.name",
  region_id: "customer.region_id",
  "customer.region_id": "customer.region_id",
  district_id: "customer.district_id",
  "customer.district_id": "customer.district_id",
  address: "customer.address",
  "customer.address": "customer.address",
  total_price: "details.total_price",
  "details.total_price": "details.total_price",
  items: "details.items",
  "details.items": "details.items",
  order_item_info: "details.items",
};

const applyOrderCreateFieldErrors = (
  error: unknown,
  setError: UseFormSetError<OrderCreateFormValues>,
) => {
  const data = getBackendPayload(error);
  const errors = data?.errors ?? data?.data?.errors;

  if (!errors || typeof errors !== "object" || Array.isArray(errors)) {
    return;
  }

  Object.entries(errors as Record<string, unknown>).forEach(([key, value]) => {
    const fieldName = orderCreateFieldErrorMap[key];
    const message = normalizeBackendMessage(value);

    if (fieldName && message) {
      setError(fieldName, { type: "server", message });
    }
  });
};

type MarketNewOrdersTableProps = {
  marketId?: number;
  marketName?: string;
  onRowClick: (order: ApiOrder) => void;
};

const mapMarketOrderToListItem = (
  order: ApiOrder,
  marketId?: number,
  marketName?: string,
): OrderListItem => ({
  id: order.id,
  market_id: marketId ? String(marketId) : "",
  customer_id: order.customer?.id ?? "",
  product_quantity: order.items?.reduce((total, item) => total + (item.quantity ?? 0), 0) ?? 0,
  status: order.status as OrderListItem["status"],
  where_deliver: order.where_deliver === "center" ? "center" : "address",
  total_price: order.total_price ?? 0,
  to_be_paid: order.to_be_paid ?? 0,
  paid_amount: order.paid_amount ?? 0,
  district_id: null,
  region_id: null,
  address: order.address,
  operator: null,
  comment: order.comment,
  post_id: null,
  createdAt: order.createdAt,
  updatedAt: order.createdAt,
  deleted: false,
  items: (order.items ?? []).map((item) => ({
    id: item.id,
    product_id: item.product?.id ?? "",
    order_id: order.id,
    quantity: item.quantity,
    createdAt: order.createdAt,
    updatedAt: order.createdAt,
  })),
  customer: {
    id: order.customer?.id ?? "",
    name: order.customer?.name ?? "",
    phone_number: order.customer?.phone_number ?? "",
  },
  market: {
    id: marketId ? String(marketId) : "",
    name: marketName ?? "—",
  },
  district: {
    id: "",
    name: order.customer?.district?.name ?? order.district?.name ?? "—",
    region: {
      id: "",
      name: order.customer?.region?.name ?? order.region?.name ?? order.address ?? "—",
    },
  },
});

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
  const orderListItems = useMemo(
    () => orders.map((order) => mapMarketOrderToListItem(order, marketId, marketName)),
    [marketId, marketName, orders],
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

      <OrdersTable
        data={orderListItems}
        isLoading={isLoading}
        onRowClick={(order) => {
          const originalOrder = orders.find((item) => item.id === order.id);
          if (originalOrder) onRowClick(originalOrder);
        }}
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

      <div className="hidden text-center text-xs font-semibold text-[color:var(--color-text-muted)] sm:block">
        {isSubmitting
          ? t("createSubmitting")
          : canNext
            ? t("orderReadyMessage")
            : step < 2
              ? t("selectMarketFirst")
              : t("fillRequiredFields")}
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
  const profile = useSelector((state: RootState) => state.user.user);
  const isMarketRole = role === "market";
  const navigationState = location.state as { selectedMarket?: MarketOption } | null;
  const selectedMarketFromState = navigationState?.selectedMarket ?? null;
  const [step, setStep] = useState(
    isMarketRole || selectedMarketFromState ? 2 : 1,
  );
  const [serverError, setServerError] = useState("");

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

  const { control, handleSubmit, trigger, reset, setError } = methods;

  const market = useWatch({ control, name: "market" });
  const customer = useWatch({ control, name: "customer" });
  const details = useWatch({ control, name: "details" });
  const selectedMarketId = market?.id ?? selectedMarketFromState?.id;
  const selectedMarketName = market?.name ?? selectedMarketFromState?.name;
  const isInactiveSelectedMarket = isMarketRole
    ? isInactiveMarketStatus(profile?.status)
    : isInactiveMarketStatus(market?.status ?? selectedMarketFromState?.status);

  const canNext = useMemo(() => {
    if (step === 1) {
      return isMarketRole || !!market;
    }

      return Boolean(
      (isMarketRole || market) &&
        !isInactiveSelectedMarket &&
        customer?.phone?.trim() &&
        customer?.name?.trim() &&
        customer?.region_id &&
        customer?.district_id &&
        details?.items?.length &&
        details?.total_price?.trim(),
    );
  }, [customer, details, isInactiveSelectedMarket, isMarketRole, market, step]);

  const handleBack = () => {
    navigate("/orders");
  };

  const handleNext = async () => {
    setServerError("");

    if (isMarketRole) {
      if (isInactiveSelectedMarket) {
        setServerError(t("inactiveMarketOrderBlocked"));
        return;
      }
      setStep(2);
      return;
    }

    if (isInactiveSelectedMarket) {
      setServerError(t("inactiveMarketOrderBlocked"));
      return;
    }

    const isValid = await trigger("market");
    if (isValid) {
      setStep(2);
    }
  };

  const onSubmit = (values: OrderCreateFormValues) => {
    setServerError("");

    if (isInactiveSelectedMarket) {
      setServerError(t("inactiveMarketOrderBlocked"));
      api.warning({
        message: t("inactiveMarketOrderBlocked"),
        placement: "topRight",
      });
      return;
    }

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
      onError: (error) => {
        const message = getOrderCreateErrorMessage(
          error,
          t("orderCreateErrorFallback"),
        );

        applyOrderCreateFieldErrors(error, setError);
        setServerError(message);
        api.error({
          message: t("orderCreateErrorTitle"),
          description: message,
          placement: "topRight",
          duration: 5,
        });
      },
    });
  };

  const handleFinalSubmit = async () => {
    setServerError("");

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

    if (isInactiveSelectedMarket) {
      setServerError(t("inactiveMarketOrderBlocked"));
      api.warning({
        message: t("inactiveMarketOrderBlocked"),
        placement: "topRight",
      });
      return;
    }

    await handleSubmit(onSubmit)();
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleFinalSubmit();
        }}
        className="flex min-h-full flex-col gap-3 sm:gap-6"
      >
        <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <HeaderName
              name={t("newOrders")}
              description={selectedMarketName ? t("selectedMarket") : t("createPageDescription")}
              icon={<ListPlus />}
            />

            {selectedMarketName && (
              <div className="inline-flex max-w-full items-center gap-2 self-start rounded-2xl border border-main/15 bg-main/8 px-4 py-2.5 text-sm font-bold text-main dark:bg-main/12 md:self-center">
                <Store size={16} />
                <span className="truncate">{selectedMarketName}</span>
              </div>
            )}
          </div>
        </div>

        <FormFieldError message={serverError} />

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
