import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, SendHorizontal, ListPlus } from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import OrderStepper from "./ui/OrderStepper";
import Step1Market from "./ui/Step1Market";
import Step2Combined from "./ui/Step2Combined";
import { useOrders } from "../../../entities/order/api/orderApi";
import type { CreateOrderRequest, DeliveryType } from "../../../entities/order/types/order";

// ── Step config ──────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "1-qadam", description: "Market tanlang" },
  { id: 2, label: "2-qadam", description: "Mijoz va buyurtma ma'lumotlari" },
];

// ── Types ─────────────────────────────────────────────────────
interface Market { id: number; name: string; phone?: string }

interface CustomerData {
  phone: string; extra_phone: string; name: string;
  region_id: string; district_id: string; address: string;
}

interface DetailsData {
  items: { product_id: string; quantity: number }[];
  total_price: string; to_be_paid: string;
  where_deliver: DeliveryType; operator: string; comment: string;
}

const INIT_CUSTOMER: CustomerData = {
  phone: "", extra_phone: "", name: "",
  region_id: "", district_id: "", address: "",
};

const INIT_DETAILS: DetailsData = {
  items: [], total_price: "", to_be_paid: "",
  where_deliver: "center", operator: "", comment: "",
};

// ── Validation ───────────────────────────────────────────────
const isStep1Valid = (market: Market | null) => !!market;

const isStep2Valid = (c: CustomerData, d: DetailsData) =>
  c.phone.trim().length >= 9 &&
  !!c.name.trim() &&
  !!c.district_id &&
  !!c.address.trim() &&
  d.items.length > 0 &&
  d.total_price !== "";

// ── Component ────────────────────────────────────────────────
const OrderCreate = () => {
  const navigate = useNavigate();
  const { createOrder } = useOrders();

  const [step, setStep] = useState(1);
  const [market, setMarket] = useState<Market | null>(null);
  const [customer, setCustomer] = useState<CustomerData>(INIT_CUSTOMER);
  const [details, setDetails] = useState<DetailsData>(INIT_DETAILS);

  const canNext =
    step === 1
      ? isStep1Valid(market)
      : isStep2Valid(customer, details);

  const handleBack = () => { if (step > 1) setStep((s) => s - 1); };
  const handleNext = () => { if (step < 2 && canNext) setStep((s) => s + 1); };

  const handleSubmit = async () => {
    if (!market || !canNext) return;

    const payload: CreateOrderRequest = {
      market_id: String(market.id),
      where_deliver: details.where_deliver,
      total_price: Number(details.total_price),
      to_be_paid: Number(details.to_be_paid),
      paid_amount: 0,
      status: "new",
      comment: details.comment,
      operator: details.operator,
      district_id: customer.district_id,
      address: customer.address,
      items: details.items,
      phone: `+998${customer.phone}`,
      extra_phone: customer.extra_phone ? `+998${customer.extra_phone}` : undefined,
      name: customer.name,
      region_id: customer.region_id,
    };

    createOrder.mutate(payload, {
      onSuccess: () => navigate("/orders"),
    });
  };

  return (
    <div className="flex flex-col gap-6 min-h-full">
      {/* ── Page header ── */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm px-4">
        <HeaderName
          name="Yangi buyurtma"
          description="Buyurtma yaratish uchun qadamlarni bajaring"
          icon={<ListPlus />}
        />
      </div>

      {/* ── Stepper ── */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm px-6 py-5">
        <OrderStepper steps={STEPS} currentStep={step} />
      </div>

      {/* ── Step content ── */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm p-6 flex-1">
        {step === 1 && (
          <Step1Market selectedMarket={market} onSelect={setMarket} />
        )}
        {step === 2 && market && (
          <Step2Combined
            marketId={String(market.id)}
            customer={customer}
            onCustomerChange={setCustomer}
            details={details}
            onDetailsChange={setDetails}
          />
        )}
      </div>

      {/* ── Navigation ── */}
      <div className="bg-primary dark:bg-maindark rounded-2xl border border-gray-200 dark:border-primarydark shadow-sm px-6 py-4 flex items-center justify-between">
        {/* Back */}
        <button
          onClick={step === 1 ? () => navigate("/orders") : handleBack}
          className="
            flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
            border-2 border-gray-200 dark:border-primarydark
            text-gray-500 dark:text-gray-400
            hover:border-main/40 hover:text-main
            transition-all duration-200
          "
        >
          <ChevronLeft size={16} />
          {step === 1 ? "Orqaga" : "Oldingi"}
        </button>

        {/* Step indicator */}
        <span className="text-xs text-gray-400 font-medium">
          {step} / {STEPS.length}
        </span>

        {/* Next / Submit */}
        {step < 2 ? (
          <button
            onClick={handleNext}
            disabled={!canNext}
            className="
              flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
              bg-main text-primary
              hover:bg-main/90 active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200 shadow-md shadow-main/20
            "
          >
            Keyingi
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canNext || createOrder.isPending}
            className="
              flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold
              bg-main text-primary
              hover:bg-main/90 active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200 shadow-md shadow-main/20
            "
          >
            {createOrder.isPending ? (
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
    </div>
  );
};

export default memo(OrderCreate);