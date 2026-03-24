import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ListPlus, SendHorizontal } from "lucide-react";
import { FormProvider, useForm, useWatch, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import HeaderName from "../../../shared/components/headerName";
import OrderStepper from "./ui/OrderStepper";
import Step1Market from "./ui/Step1Market";
import Step2Combined from "./ui/Step2Combined";
import { FormStateNote, getActionButtonClassName } from "./ui/formFieldStyles";
import { useOrders } from "../../../entities/order/api/orderApi";
import {
  buildCreateOrderPayload,
  ORDER_CREATE_DEFAULT_VALUES,
  orderCreateSchema,
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
}: {
  step: number;
  canNext: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onNext: () => void;
}) => (
  <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm px-4 py-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <button
      type="button"
      onClick={onBack}
      className={`${getActionButtonClassName({ variant: "secondary" })} w-full sm:w-auto`}
    >
      <ChevronLeft size={16} />
      {step === 1 ? "Orqaga" : "Oldingi"}
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
  const [step, setStep] = useState(1);

  const methods = useForm<OrderCreateFormValues>({
    resolver: yupResolver(orderCreateSchema) as Resolver<OrderCreateFormValues>,
    mode: "onTouched",
    defaultValues: ORDER_CREATE_DEFAULT_VALUES,
  });

  const { control, handleSubmit, trigger } = methods;

  const market = useWatch({ control, name: "market" });
  const customer = useWatch({ control, name: "customer" });
  const details = useWatch({ control, name: "details" });

  const canNext = useMemo(() => {
    if (step === 1) {
      return !!market;
    }

    return Boolean(
      market &&
        customer?.phone?.trim() &&
        customer?.name?.trim() &&
        customer?.region_id &&
        customer?.district_id &&
        details?.items?.length &&
        details?.total_price?.trim(),
    );
  }, [customer, details, market, step]);

  const handleBack = () => {
    if (step === 1) {
      navigate("/orders");
      return;
    }

    setStep((current) => current - 1);
  };

  const handleNext = async () => {
    const isValid = await trigger("market");
    if (isValid) {
      setStep(2);
    }
  };

  const onSubmit = (values: OrderCreateFormValues) => {
    createOrder.mutate(buildCreateOrderPayload(values), {
      onSuccess: () => navigate("/orders"),
    });
  };

  const handleFinalSubmit = async () => {
    const isValid = await trigger([
      "customer.phone",
      "customer.name",
      "customer.region_id",
      "customer.district_id",
      "customer.address",
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
          <OrderStepper steps={STEPS} currentStep={step} />
        </div>

        <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm p-3 sm:p-6 flex-1">
          {step === 1 && <Step1Market />}
          {step === 2 && <Step2Combined />}
        </div>

        <StepActions
          step={step}
          canNext={canNext}
          isSubmitting={createOrder.isPending}
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
