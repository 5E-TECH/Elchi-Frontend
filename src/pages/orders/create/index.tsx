// dizayn-v2: superadmin-neworders-create-manual-step1, superadmin-neworders-create-market-picker-dialog, superadmin-neworders-create-manual-step2, superadmin-neworders-create-ai-input, superadmin-neworders-create-ai-preview, superadmin-neworders-create-ai-confirm-dialog, admin-neworders-create-manual, admin-neworders-create-market-picker, admin-neworders-create-ai, admin-neworders-create-ai-confirm-dialog, manager-new-orders-create-manual-step1, manager-new-orders-create-manual-step2, manager-new-orders-create-ai, manager-new-orders-create-ai-confirm-dialog, registrator-new-orders-create-step1, registrator-new-orders-create-market-picker-dialog, registrator-new-orders-create-step2, registrator-new-orders-create-ai, registrator-new-orders-create-ai-confirm-dialog, market-new-orders-create-manual, market-new-orders-create-ai-input, market-new-orders-create-ai-preview, market-new-orders-create-ai-confirm-dialog, market_operator-new-orders-create-manual
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { useLocation } from "react-router-dom";
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
import { Trans, useTranslation } from "react-i18next";
import Step1Market from "./ui/Step1Market";
import Step2Combined from "./ui/Step2Combined";
import Step2Summary from "./ui/Step2Summary";
import OrderSourceCard from "./ui/OrderSourceCard";
import { useCanChooseOrderSource } from "./model/useOrderSource";
import OrderStepper from "./ui/OrderStepper";
import TodayOrdersCard from "./ui/TodayOrdersCard";
import CreateModeTabs, { type CreateMode } from "./ui/CreateModeTabs";
import { CreateAlert } from "./ui/CreateAlert";
import AiCreatePanel from "./ui/ai/AiCreatePanel";
import { isAiTabHidden, useAiAvailability } from "../../../entities/ai-order";
import { useOrders } from "../../../entities/order/api/orderApi";
import { useCreateOrderIdempotencyKeys } from "../../../entities/order/model/createIdempotency";
import type { RootState } from "../../../app/config/store";
import {
  buildCreateOrderPayload,
  createOrderSchema,
  ORDER_CREATE_DEFAULT_VALUES,
  type MarketOption,
  type OrderCreateFormValues,
} from "./model/orderCreateForm";
import { isInactiveMarketStatus } from "../../../shared/lib/marketStatus";
import { notify } from "../../../shared/lib/notify";
import { cx } from "../../../shared/lib/cx";
import { isMarketSideRole } from "../../../entities/user/lib/role";
import { PageHeader, useConfirm } from "../../../shared/ui/primitives";

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

/** «Orqaga» va havolalar manzili — «Qabul va yaratish». */
const BACK_TO = "/new-orders";
/** MO-3: market operatorining orqaga havolasi — o'z buyurtmalari. */
const OPERATOR_BACK_TO = "/orders";

/**
 * YANGI BUYURTMA — `/new-orders/create` (dizayn v2, maketlar `*-create-manual-step1|step2`,
 * `*-create-market-picker-dialog`, `market-new-orders-create-manual`).
 *
 * Tuzilma: `PageHeader` («← Qabul va yaratish», «Yangi buyurtma», holatga qarab izoh, o'ngda «Qo'lda | AI bilan»)
 * → ikki ustun (`flex-wrap`: asosiy 3 : yon 1; ~ 924 px dan tor ekranda ustma-ust):
 *  - asosiy: qadamlar, server xatosi, 1-qadam (market) yoki 2-qadam (mijoz va mahsulotlar); AI rejimida — AI paneli;
 *  - yon: 2-qadamda «Buyurtma xulosasi» (summa, operator, «Buyurtma yaratish»), market ma'lum bo'lsa — «Yangi buyurtmalar».
 * Market rolida 1-qadam yo'q (o'z marketi), forma darhol 2-qadamdan ochiladi.
 */
const OrderCreateFormContent = () => {
  const { t } = useTranslation(["orders", "common", "newOrders"]);
  const location = useLocation();
  const queryClient = useQueryClient();
  const { createOrder } = useOrders();
  // gpCIsGjH: `Idempotency-Key` tarkibga bog'langan — javobi kelmagan urinishni (20 s timeout, tarmoq) qayta bosish
  // AYNI kalit bilan ketadi va ikkinchi buyurtma yaratilmaydi; forma o'zgarsa — yangi kalit, muvaffaqiyatdan keyin —
  // hammasi yangilanadi.
  const createKeys = useCreateOrderIdempotencyKeys();
  // Ikki marta tez bosish: tugma `isPending` bilan o'chguncha (qayta chizilish) ikkinchi yuborish ketmasin.
  const submittingRef = useRef(false);
  const role = useSelector((state: RootState) => state.role.role);
  const roleState = useSelector((state: RootState) => state.role);
  const profile = useSelector((state: RootState) => state.user.user);
  // MO-3: market operatori — market tomoni (1-qadamsiz, market serverda tokendan, katalog `my-products`), faqat
  // «AI bilan»: `POST /orders` unga hali yopiq (qo'lda — MO-7, OfRSoRUX). Maket `market_operator-new-orders-create-manual`
  // (faqat AI qismi; holatlar `market-new-orders-create-ai-*`).
  const isMarketOperator = role === "market_operator";
  const isMarketRole = isMarketSideRole(role);
  // 6kHnNH9j: «Qayerdan yuboriladi» bloki (superadmin, admin, registrator; market — kalit bilan) va `fulfillment`.
  const canChooseSource = useCanChooseOrderSource();
  const navigationState = location.state as { selectedMarket?: MarketOption } | null;
  const selectedMarketFromState = navigationState?.selectedMarket ?? null;
  const [step, setStep] = useState<1 | 2>(
    isMarketRole || selectedMarketFromState ? 2 : 1,
  );
  const [serverError, setServerError] = useState("");
  // "Qo'lda" (asosiy, hech qachon olib tashlanmaydi) yoki "AI bilan".
  const [selectedMode, setMode] = useState<CreateMode>("manual");
  // AI o'chiq bo'lsa «AI bilan» tabi UMUMAN ko'rinmaydi (ega Ops S3, CS-B 6-band): konfiguratsiya kaliti o'chiq
  // (`enabled:false`) yoki `state === "disabled"` (ai-service'da kalit yo'q / noto'g'ri). `unknown`,
  // `cap_exceeded` va so'rov xatosida tab qoladi — panel sababini o'zi tushuntiradi.
  const aiAvailability = useAiAvailability();
  const aiHidden = isAiTabHidden(aiAvailability.data);
  const mode: CreateMode = isMarketOperator ? "ai" : aiHidden ? "manual" : selectedMode;
  // Operatorda AI o'chiq bo'lsa yaratish usuli umuman yo'q — sabab ogohlantirishda (qo'lda rejim chizilmaydi).
  const operatorAiOff = isMarketOperator && aiHidden;

  // Bitta sxema — formaning tekshiruvi ham, «Buyurtma yuborishga tayyor» holati ham shundan (D-06).
  const createSchema = useMemo(() => createOrderSchema(!isMarketRole), [isMarketRole]);
  const methods = useForm<OrderCreateFormValues>({
    resolver: yupResolver(createSchema) as Resolver<OrderCreateFormValues>,
    mode: "onTouched",
    defaultValues: {
      ...ORDER_CREATE_DEFAULT_VALUES,
      market: selectedMarketFromState,
    },
  });

  const { control, handleSubmit, trigger, reset, setError, getValues, setValue } = methods;
  // Katalog mahsulotlari qaysi marketga tegishli: «O'zgartirish»/«Oldingi» bilan boshqa market tanlansa, eski
  // marketning `product_id` lari yangi market buyurtmasiga ketmasin. Butun market saqlanadi — almashtirish
  // tasdig'i bekor qilinsa, shu market qaytariladi.
  const itemsMarketRef = useRef<MarketOption | null>(selectedMarketFromState ?? null);
  const confirm = useConfirm();
  // «Keyingi» / «Oldingi» / «O'zgartirish» bosilgach bosilgan tugma yo'qoladi — fokus «Qadamlar» ga o'tadi
  // (klaviatura va ekran o'quvchi joyini yo'qotmasin; telefonda sahifa yangi qadam boshiga keladi).
  const stepsRef = useRef<HTMLDivElement>(null);
  const focusStepsRef = useRef(false);
  useEffect(() => {
    if (!focusStepsRef.current) return;
    focusStepsRef.current = false;
    stepsRef.current?.focus();
  }, [step]);

  const market = useWatch({ control, name: "market" });
  const customer = useWatch({ control, name: "customer" });
  const details = useWatch({ control, name: "details" });
  const marketRoleId = roleState.id ?? profile?.id;
  const marketRoleName = roleState.name ?? profile?.name;
  // Operatorning `id`/`name` i — o'zi, market emas (market nomi `my-profile` da yo'q, N13): market ma'lum emas.
  const selectedMarketId = isMarketOperator
    ? undefined
    : isMarketRole
      ? marketRoleId
      : market?.id ?? selectedMarketFromState?.id;
  const selectedMarketName = isMarketOperator
    ? undefined
    : isMarketRole
      ? marketRoleName
      : market?.name ?? selectedMarketFromState?.name;
  const isInactiveSelectedMarket = isMarketRole
    ? isInactiveMarketStatus(profile?.status)
    : isInactiveMarketStatus(market?.status ?? selectedMarketFromState?.status);

  const canNext = useMemo(() => {
    // AI rejimida qo'lda forma bo'sh — "Maydonlarni to'ldiring" chalg'itmasin.
    if (mode !== "manual") {
      return false;
    }

    if (step === 1) {
      return isMarketRole || !!market;
    }

    // «Tayyor» — faqat forma haqiqatan yuboriladigan bo'lsa (D-06): yuborishdagi sxema bilan bir xil qoida —
    // telefon 9 raqam, «Uygacha» da manzil majburiy, mahsulot va summa. Ilgari faqat «bo'sh emas» tekshirilib,
    // «Uygacha» + bo'sh manzilda ham tugma faol va «Buyurtma yuborishga tayyor» ko'rinardi.
    if (!(isMarketRole || market) || isInactiveSelectedMarket) return false;
    return createSchema.isValidSync({ market: isMarketRole ? null : market, customer, details });
  }, [createSchema, customer, details, isInactiveSelectedMarket, isMarketRole, market, mode, step]);

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
      const nextMarket = getValues("market") ?? null;
      const previousMarket = itemsMarketRef.current;
      // Market almashgan: faqat katalogsiz («Katalogda yo'q») mahsulotlar qoladi — ular marketga bog'liq emas.
      // Katalog mahsulotlari o'chishidan oldin tasdiq so'raladi (ega qarori 2026-10-17); bekor qilinsa market
      // almashmaydi — eski market (mahsulotlar egasi) qaytariladi va 1-qadamda qolinadi.
      if (previousMarket != null && nextMarket?.id !== previousMarket.id) {
        const items = getValues("details.items");
        const kept = items.filter((item) => item.product_id == null);
        const removed = items.length - kept.length;
        if (removed > 0) {
          const confirmed = await confirm({
            tone: "danger",
            icon: Store,
            title: t("createMarketChangeTitle"),
            description: t("createMarketChangeDescription", {
              count: removed,
              from: previousMarket.name,
              to: nextMarket?.name ?? "",
            }),
            confirmLabel: t("createMarketChangeConfirm"),
            cancelLabel: t("createMarketChangeCancel"),
          });
          if (!confirmed) {
            setValue("market", previousMarket, { shouldDirty: true, shouldValidate: true });
            return;
          }
          setValue("details.items", kept, { shouldDirty: true });
        }
        // Mavjud mijoz bog'lanishi eski market doirasida (buyurtmalar soni, «yangi buyurtma bor» ogohlantirishi va
        // havolalar shu marketniki) — uziladi; maydonlar qoladi, telefon yangi market bo'yicha qayta qidiriladi.
        setValue("existingCustomer", null, { shouldDirty: true });
      }
      itemsMarketRef.current = nextMarket;
      focusStepsRef.current = true;
      setStep(2);
    }
  };

  // «Oldingi» / «O'zgartirish» — 1-qadamga, tanlangan market saqlanadi.
  const handlePrevious = () => {
    setServerError("");
    focusStepsRef.current = true;
    setStep(1);
  };

  const onSubmit = (values: OrderCreateFormValues) => {
    setServerError("");

    if (isInactiveSelectedMarket) {
      setServerError(t("inactiveMarketOrderBlocked"));
      notify.warning(t("inactiveMarketOrderBlocked"));
      return;
    }

    if (submittingRef.current) return;

    const payload = buildCreateOrderPayload(values, {
      includeMarketId: !isMarketRole,
      includeFulfillment: canChooseSource,
    });
    submittingRef.current = true;
    createOrder.mutate({ data: payload, idempotencyKey: createKeys.take(payload) }, {
      onSettled: () => {
        submittingRef.current = false;
      },
      onSuccess: () => {
        // Takroriy kalit javobi (`idempotent_replay`) ham shu yerga keladi: buyurtma avvalgi (javobi yo'qolgan)
        // urinishda yaratilgan — bitta, forma tozalanadi. Keyingi buyurtma — yangi kalit.
        createKeys.reset();
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
        reset({
          ...ORDER_CREATE_DEFAULT_VALUES,
          market: isMarketRole ? null : values.market,
        });
        setStep(2);
        notify.success(t("success", { ns: "common" }), {
          description: isMarketRole
            ? t("orderCreatedMarketRole")
            : t("orderCreatedForMarket"),
        });
      },
      onError: (error) => {
        const message = getOrderCreateErrorMessage(
          error,
          t("orderCreateErrorFallback"),
        );

        applyOrderCreateFieldErrors(error, setError);
        setServerError(message);
        notify.error(t("orderCreateErrorTitle"), { description: message });
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
      notify.warning(t("inactiveMarketOrderBlocked"));
      return;
    }

    await handleSubmit(onSubmit)();
  };

  const isManual = mode === "manual";
  const showStep1 = isManual && !isMarketRole && step === 1;
  const showSummary = isManual && step === 2;
  const showToday = Boolean(selectedMarketId);
  const hasAside = showSummary || showToday;

  // Sarlavha izohi: market ma'lum bo'lsa (market roli yoki AI) — «Tanlangan market: …»; 2-qadamda — majburiy
  // maydonlar belgisi; qolganida — «Buyurtma yaratish uchun qadamlarni bajaring».
  // Operator: AI o'chiq bo'lsa izoh yo'q — «AI bilan yaratiladi» ogohlantirish «AI o'chiq» ga zid.
  const description = isMarketOperator ? (
    operatorAiOff ? undefined : t("operatorCreate.description")
  ) : selectedMarketName && (isMarketRole || !isManual) ? (
      <Trans
        t={t}
        i18nKey="createSelectedMarket"
        values={{ name: selectedMarketName }}
        components={{ strong: <strong className="font-semibold text-text" /> }}
      />
    ) : isManual && step === 2 ? (
      <Trans t={t} i18nKey="createRequiredHint" components={{ req: <span className="text-danger-fg" /> }} />
    ) : (
      t("createPageDescription")
    );

  return (
    <FormProvider {...methods}>
      <form
        aria-label={t("createFormLabel")}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          // ⚠️ AI paneli ham shu `<form>` ichida — AI rejimida qo'lda buyurtma
          // hech qachon yaratilmasin.
          if (mode !== "manual") return;
          void handleFinalSubmit();
        }}
        className="flex min-w-0 flex-col gap-6 max-md:gap-4"
      >
        <PageHeader
          // Operatorda «Qabul va yaratish» yo'q (`/new-orders` shu sahifaga qaytaradi) — orqaga «Buyurtmalar».
          back={isMarketOperator ? OPERATOR_BACK_TO : BACK_TO}
          backLabel={isMarketOperator ? t("title") : t("pageTitle", { ns: "newOrders" })}
          title={t("createPageTitle")}
          description={description}
          actions={aiHidden || isMarketOperator ? undefined : <CreateModeTabs mode={mode} onChange={setMode} />}
        />

        <div className="flex min-w-0 flex-wrap items-start gap-6 max-md:gap-4">
          <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-6 max-md:gap-4">
            {/*
              Ikkala rejim ham MOUNT bo'lib qoladi, faqat yashiriladi: tab
              almashganda qo'lda forma qiymatlari ham, AI matni/rasmlari ham
              yo'qolmaydi.
            */}
            {operatorAiOff ? (
              <CreateAlert tone="warning" title={t("operatorCreate.aiOffTitle")}>
                {t("operatorCreate.aiOffText")}
              </CreateAlert>
            ) : null}
            {/* Operatorda qo'lda forma umuman yo'q (yashirin holda ham): u viloyatlarni so'raydi — `GET /region` 403. */}
            {isMarketOperator ? null : (
              <div
                data-testid="manual-mode-panel"
                className={isManual ? "flex min-w-0 flex-col gap-6 max-md:gap-4" : "hidden"}
              >
                {!isMarketRole ? (
                  <div ref={stepsRef} tabIndex={-1} className="min-w-0 scroll-mt-6 outline-none">
                    <OrderStepper
                      step={step}
                      marketName={selectedMarketName}
                      onChangeMarket={handlePrevious}
                    />
                  </div>
                ) : null}

                {serverError ? (
                  <CreateAlert tone="danger" title={t("orderCreateErrorTitle")}>
                    {serverError}
                  </CreateAlert>
                ) : null}

                {showStep1 ? (
                  <Step1Market
                    canNext={canNext}
                    backTo={BACK_TO}
                    onNext={() => {
                      void handleNext();
                    }}
                  />
                ) : null}
                {step === 2 ? <Step2Combined /> : null}
                {step === 2 && canChooseSource ? <OrderSourceCard /> : null}
              </div>
            )}

            {!aiHidden ? (
              <div data-testid="ai-mode-panel" className={isManual ? "hidden" : "flex min-w-0 flex-col gap-4"}>
                <AiCreatePanel
                  key={market ? String(market.id) : "no-market"}
                  active={mode === "ai"}
                  isMarketRole={isMarketRole}
                  market={isMarketRole ? null : market}
                  onSwitchToManual={isMarketOperator ? undefined : () => setMode("manual")}
                  areaLists={!isMarketOperator}
                  // Operator maydoni — o'zi (maket «Siz — avtomatik yoziladi»); matn yuborilmaydi, backend ismni o'zi yozadi.
                  selfOperator={isMarketOperator ? { name: marketRoleName ?? null } : undefined}
                  onChangeMarket={
                    isMarketRole
                      ? undefined
                      : () => {
                          methods.setValue("market", null);
                          setStep(1);
                        }
                  }
                />
              </div>
            ) : null}
          </div>

          {hasAside ? (
            <aside
              aria-label={showSummary ? t("createSummaryTitle") : t("createTodayAside")}
              className={cx(
                "flex min-w-0 flex-[1_1_300px] gap-6 max-md:gap-4",
                // Market maketi: yon ustun planshetda ikki karta yonma-yon (`flex-wrap`); xodimlarda — ustma-ust.
                isMarketRole ? "flex-wrap content-start [&>*]:flex-[1_1_300px]" : "flex-col",
                showSummary && "lg:sticky lg:top-6",
              )}
            >
              {showSummary ? (
                <Step2Summary
                  isMarketRole={isMarketRole}
                  ready={canNext}
                  submitting={createOrder.isPending}
                  onPrevious={handlePrevious}
                  backTo={BACK_TO}
                />
              ) : null}
              {showToday && selectedMarketId ? (
                <TodayOrdersCard
                  marketId={selectedMarketId}
                  marketName={selectedMarketName}
                  isMarketRole={isMarketRole}
                />
              ) : null}
            </aside>
          ) : null}
        </div>
      </form>
    </FormProvider>
  );
};

const OrderCreate = () => <OrderCreateFormContent />;

export default memo(OrderCreate);
