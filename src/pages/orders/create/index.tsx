import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ListPlus, SendHorizontal } from "lucide-react";
import { FormProvider, useForm, useWatch, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useSelector } from "react-redux";
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
  type OrderCreateFormValues,
} from "./model/orderCreateForm";

const STEPS = [
  { id: 1, label: "1-qadam", description: "Market tanlang" },
  { id: 2, label: "2-qadam", description: "Mijoz va buyurtma ma'lumotlari" },
];

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
}) => (
  <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm px-4 py-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <button
      type="button"
      onClick={onBack}
      className={`${getActionButtonClassName({ variant: "secondary" })} w-full sm:w-auto`}
    >
      <ChevronLeft size={16} />
      {step === 1 || isMarketRole ? "Orqaga" : "Oldingi"}
    </button>

    <div className="flex w-full flex-col items-center gap-2 px-0 text-center sm:w-auto sm:px-4">
      <span className="text-xs text-gray-400 font-medium">
        {step} / {STEPS.length}
      </span>
      {isSubmitting ? (
        <FormStateNote
          state="loading"
          message="Buyurtma saqlanmoqda, iltimos kuting"
        />
      ) : canNext ? (
        <FormStateNote
          state="success"
          message={
            step < 2
              ? "Keyingi bosqichga o'tish uchun ma'lumotlar tayyor"
              : "Buyurtma yuborishga tayyor"
          }
        />
      ) : (
        <FormStateNote
          state="info"
          message={
            step < 2
              ? "Avval market tanlang"
              : "Majburiy maydonlarni to'ldirib, mahsulot tanlang"
          }
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
        Keyingi
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
            Saqlanmoqda...
          </>
        ) : (
          <>
            <SendHorizontal size={16} />
            Buyurtma yaratish
          </>
        )}
      </button>
    )}
  </div>
);

const OrderCreateFormContent = () => {
  const navigate = useNavigate();
  const { createOrder } = useOrders();
  const { api } = useAppNotification();
  const role = useSelector((state: RootState) => state.role.role);
  const isMarketRole = role === "market";
  const [step, setStep] = useState(isMarketRole ? 2 : 1);

  const methods = useForm<OrderCreateFormValues>({
    resolver: yupResolver(
      createOrderSchema(!isMarketRole),
    ) as Resolver<OrderCreateFormValues>,
    mode: "onTouched",
    defaultValues: ORDER_CREATE_DEFAULT_VALUES,
  });

  const { control, handleSubmit, trigger, reset } = methods;

  const market = useWatch({ control, name: "market" });
  const customer = useWatch({ control, name: "customer" });
  const details = useWatch({ control, name: "details" });

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
        reset({
          ...ORDER_CREATE_DEFAULT_VALUES,
          market: isMarketRole ? null : values.market,
        });
        setStep(2);
        api.success({
          message: "Muvaffaqiyatli",
          description: isMarketRole
            ? "Buyurtma yaratildi. Mahsulotlaringiz uchun yangi buyurtma kiritishda davom etishingiz mumkin."
            : "Buyurtma yaratildi. Shu market uchun yangi buyurtma kiritishingiz mumkin.",
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
            name="Yangi buyurtma"
            description="Buyurtma yaratish uchun qadamlarni bajaring"
            icon={<ListPlus />}
          />
        </div>

        <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm px-3 py-3 sm:px-6 sm:py-5">
          <OrderStepper
            steps={STEPS}
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
      </form>
    </FormProvider>
  );
};

const OrderCreate = () => <OrderCreateFormContent />;

export default memo(OrderCreate);
