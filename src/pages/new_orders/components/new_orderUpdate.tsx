import { memo, useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  Package,
  User,
  Phone,
  MapPin,
  Building,
  Map,
  Home,
  ShoppingBag,
  CreditCard,
  Banknote,
  Edit2,
  ChevronDown,
  Minus,
  Plus, 
  Trash2,
  MessageSquare,
  Truck,
  RotateCcw,
  LockKeyhole,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import BackButton from "../../../shared/ui/BackButton";
import { useOrders } from "../../../entities/orders";
import { useUser } from "../../../entities/user/api/userApi";
import { useLogistics } from "../../../entities/logistics/api/logisticsApi";
import UpdatePopup from "../../../shared/components/popupUpdate";
import { OrderTracking } from "../../../widgets/order-tracking";
import { resolveAssetUrl } from "../../../shared/lib/assetUrl";
import type { RootState } from "../../../app/config/store";
import SellModal from "../../orders/list/courier/list/SellModal";
import CancelModal from "../../orders/list/courier/list/CancelModal";
import PopupConfirm from "../../../shared/components/popupConfirm";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import {
  buildAddressUpdatePayload,
  buildCustomerUpdatePayload,
  buildOrderUpdatePayload,
  getBackend400Message,
  isOrderReceivedOrLater,
  isOrderSentToBranch,
  type EditableOrderSnapshot,
} from "./newOrderUpdateRules";

// ─── Types ────────────────────────────────────────────────────────────────────
interface District {
  id: string;
  name: string;
  region_id?: string;
  region?: { id: string; name: string };
}
interface Region {
  id: string;
  name: string;
  districts?: District[];
}
interface Customer {
  id: string;
  name: string;
  phone_number: string;
  district?: District;
  region?: Region;
}
interface OrderItem {
  id: string;
  quantity: number;
  image?: string | null;
  image_url?: string | null;
  product: {
    id: string;
    name: string;
    image?: string | null;
    image_url?: string | null;
    imageUrl?: string | null;
    photo?: string | null;
    photo_url?: string | null;
    file?: string | null;
    url?: string | null;
  } | null;
}

const getProductImageUrl = (item: OrderItem) =>
  resolveAssetUrl(
    item.product?.image_url ??
    item.product?.imageUrl ??
    item.product?.image ??
    item.product?.photo_url ??
    item.product?.photo ??
    item.product?.file ??
    item.product?.url ??
    item.image_url ??
    item.image,
  );

const ProductThumbnail = ({
  item,
  alt,
  className,
}: {
  item: OrderItem;
  alt: string;
  className: string;
}) => {
  const imageUrl = getProductImageUrl(item);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const hasImageError = failedImageUrl === imageUrl;

  return (
    <div className={className}>
      {imageUrl && !hasImageError ? (
        <img
          src={imageUrl}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailedImageUrl(imageUrl)}
        />
      ) : (
        <Package size={18} className="text-gray-300 dark:text-white/20" />
      )}
    </div>
  );
};
interface OrderDetail extends EditableOrderSnapshot {
  id: string;
  where_deliver: "center" | "address";
  total_price: number;
  to_be_paid: number;
  paid_amount: number;
  status: string;
  comment: string | null;
  address: string | null;
  district_id?: string;
  items: OrderItem[];
  customer: Customer;
  district?: District;
  region?: Region;
  [key: string]: unknown;
}

interface AddressForm {
  region_id: string;
  district_id: string;
  address: string;
}
interface CustomerForm {
  name: string;
  phone: string;
}
interface OrderForm {
  where_deliver: string;
  total_price: string;
  comment: string;
  items: OrderItem[];
}

// ─── Constants (module-level — re-render da qayta yaratilmaydi) ───────────────
const fmt = (n: number) => n.toLocaleString("uz-UZ") + " so'm";

const DELIVER_LABELS: Record<string, string> = {
  center: "deliverCenter",
  address: "deliverAddress",
};

const DELIVER_OPTIONS = [
  { value: "center", labelKey: "deliverCenter" },
  { value: "address", labelKey: "deliverAddress" },
] as const;
const BRANCH_TYPES = new Set(["HQ", "PICKUP", "REGIONAL", "HYBRID"]);
const ACTIONABLE_STATUSES = new Set(["waiting", "on the road", "new", "received"]);
const DEFAULT_STATUS_CLS = "bg-slate-500/20 text-slate-300 border border-slate-500/30";
const PRODUCTS_LOCK_REASON =
  "HQ qabul qilgandan keyin summa va mahsulotlarni o‘zgartirib bo‘lmaydi.";
const DESTINATION_LOCK_REASON =
  "Branchga jo‘natilgandan keyin mijoz va manzilni o‘zgartirib bo‘lmaydi.";

const getOrderPageBranchType = (
  user: RootState["user"]["user"],
): "HQ" | "PICKUP" | "REGIONAL" | "HYBRID" | null => {
  const rawUser = user as
    | (RootState["user"]["user"] & {
        branch_type?: string | null;
        branch?: {
          type?: string | null;
          branch_type?: string | null;
          branch?: {
            type?: string | null;
            branch_type?: string | null;
          } | null;
        } | null;
      })
    | null
    | undefined;

  const normalize = (value: unknown) => {
    if (typeof value !== "string") return null;
    const upper = value.toUpperCase();
    return BRANCH_TYPES.has(upper)
      ? (upper as "HQ" | "PICKUP" | "REGIONAL" | "HYBRID")
      : null;
  };

  return (
    normalize(rawUser?.branch?.branch?.type) ??
    normalize(rawUser?.branch?.branch?.branch_type) ??
    normalize(rawUser?.branch?.type) ??
    normalize(rawUser?.branch?.branch_type) ??
    normalize(rawUser?.branch_type) ??
    null
  );
};

const STATUS_CONFIG: Record<string, { labelKey: string; cls: string; ns?: "newOrders" | "orders" }> = {
  created: {
    labelKey: "statusCreated",
    ns: "orders",
    cls: "bg-sky-500/20 text-sky-400 border border-sky-500/30",
  },
  received: {
    labelKey: "statusReceived",
    ns: "orders",
    cls: "bg-violet-500/20 text-violet-400 border border-violet-500/30",
  },
  "on the road": {
    labelKey: "statusOnTheRoad",
    ns: "orders",
    cls: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  },
  waiting: {
    labelKey: "statusWaiting",
    ns: "orders",
    cls: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  },
  new: {
    labelKey: "statusNew",
    ns: "newOrders",
    cls: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  },
  processing: {
    labelKey: "statusProcessing",
    ns: "newOrders",
    cls: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  },
  completed: {
    labelKey: "statusCompleted",
    ns: "newOrders",
    cls: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  },
  sold: {
    labelKey: "statusSold",
    ns: "orders",
    cls: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  },
  paid: {
    labelKey: "statusPaid",
    ns: "orders",
    cls: "bg-teal-500/20 text-teal-400 border border-teal-500/30",
  },
  partly_paid: {
    labelKey: "statusPartlyPaid",
    ns: "orders",
    cls: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
  },
  cancelled: {
    labelKey: "statusCancelled",
    ns: "orders",
    cls: "bg-rose-500/20 text-rose-400 border border-rose-500/30",
  },
  closed: {
    labelKey: "statusClosed",
    ns: "orders",
    cls: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
  },
};

const FIELD_CLS =
  "w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 text-gray-800 dark:text-white text-sm font-medium focus:outline-none focus:border-main focus:ring-1 focus:ring-main/30 transition-all";
const ICON_CLS =
  "absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white pointer-events-none";

const PAYMENT_ROWS = (order: OrderDetail) => [
  { labelKey: "total", value: fmt(order.total_price), cls: "text-gray-900 dark:text-white font-bold" },
  { labelKey: "toBePaid", value: fmt(order.to_be_paid), cls: "text-amber-500 font-bold" },
  { labelKey: "paid", value: fmt(order.paid_amount), cls: "text-emerald-500 font-bold" },
];

// ─── Pure UI Subcomponents (memo ile — props o'zgarmasa re-render bo'lmaydi) ──
const Card = memo(({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl bg-white dark:bg-white/4 border border-gray-200 dark:border-white/8 ${className}`}>
    {children}
  </div>
));

const SectionHead = memo(({
  icon, title, sub, iconCls: ic = "bg-main/20 text-main", action,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  iconCls?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${ic}`}>{icon}</div>
      <div>
        <p className="font-semibold text-sm text-gray-900 dark:text-white">{title}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-white">{sub}</p>}
      </div>
    </div>
    {action}
  </div>
));

const InfoRow = memo(({
  icon, label, value, iconCls: ic = "bg-main/20 text-main",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  iconCls?: string;
}) => (
  <div className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-white/6 last:border-0">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ic}`}>
      {icon}
    </div>
    <div className="flex flex-col">
      <span className="text-[10px] text-gray-400 dark:text-white uppercase tracking-wider font-medium">
        {label}
      </span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
    </div>
  </div>
));

const EditBtn = memo(({
  onClick,
  disabled = false,
  reason,
}: {
  onClick: () => void;
  disabled?: boolean;
  reason?: string;
}) => {
  const { t } = useTranslation("common");

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? reason : undefined}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white hover:text-main dark:hover:text-white hover:bg-main/10 dark:hover:bg-white/10 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Edit2 size={12} /> {t("edit")}
    </button>
  );
});

const LockNotice = memo(({ children }: { children: string }) => (
  <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
    <LockKeyhole size={14} className="mt-0.5 shrink-0" />
    <span>{children}</span>
  </div>
));

const Skeleton = memo(() => (
  <div className="animate-pulse space-y-4">
    {[64, 200, 120].map((h) => (
      <div key={h} className="rounded-2xl bg-gray-100 dark:bg-white/5" style={{ height: h }} />
    ))}
  </div>
));

// ─── Popup Field Components ───────────────────────────────────────────────────
const SelectField = memo(({
  label, icon: Icon, value, onChange, placeholder, options, disabled = false,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  disabled?: boolean;
}) => (
  <div className="space-y-1.5">
    <label className="text-sm text-gray-500 dark:text-white ml-1">{label}</label>
    <div className="relative">
      <div className={ICON_CLS}><Icon size={16} /></div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${FIELD_CLS} pl-10 pr-10 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <option value="" className="bg-sidebar dark:bg-maindark">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-sidebar dark:bg-maindark">
            {o.label}
          </option>
        ))}
      </select>
      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-white">
        <ChevronDown size={14} />
      </div>
    </div>
  </div>
));

const InputField = memo(({
  label, icon: Icon, value, onChange, placeholder, disabled = false,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) => (
  <div className="space-y-1.5">
    <label className="text-sm text-gray-500 dark:text-white ml-1">{label}</label>
    <div className="relative">
      <div className="absolute left-3.5 top-3.5 text-gray-400 dark:text-white pointer-events-none">
        <Icon size={16} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`${FIELD_CLS} pl-10 pr-4 placeholder:text-gray-400 dark:placeholder:text-white/80 disabled:cursor-not-allowed disabled:opacity-60`}
      />
    </div>
  </div>
));

// ─── Main Component ───────────────────────────────────────────────────────────
const NewOrderUpdate = () => {
  const { t } = useTranslation(["newOrders", "orders"]);
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const queryClient = useQueryClient();
  const { api: notificationApi } = useAppNotification();
  const role = useSelector((state: RootState) => state.role.role);
  const user = useSelector((state: RootState) => state.user.user);
  const branchType = getOrderPageBranchType(user);

  // ─── State ──────────────────────────────────────────────────────────────────
  const [addressPopupOpen, setAddressPopupOpen] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressForm>({
    region_id: "", district_id: "", address: "",
  });

  const [customerPopupOpen, setCustomerPopupOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerForm>({ name: "", phone: "" });

  const [orderPopupOpen, setOrderPopupOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderForm>({
    where_deliver: "", total_price: "", comment: "", items: [],
  });
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isRollbackConfirmOpen, setIsRollbackConfirmOpen] = useState(false);

  // ─── Data fetching ───────────────────────────────────────────────────────────
  const {
    getOrderById,
    updateNewOrder,
    SellOrder,
    PartlySellOrder,
    CancelOrder,
    RollbackOrder,
  } = useOrders();
  const { updateUser } = useUser();
  const { getRegions, getDistricts } = useLogistics();

  const { data: res, isLoading } = getOrderById(orderId ?? "", !!orderId);
  const order = useMemo<OrderDetail | null>(() => {
    if (!res) return null;
    if ("data" in (res as Record<string, unknown>) && (res as { data?: OrderDetail }).data) {
      return (res as { data: OrderDetail }).data;
    }
    return res as OrderDetail;
  }, [res]);
  const userId = order?.customer?.id;

  const { data: regionsData } = getRegions();
  const { data: districtsData } = getDistricts(addressForm.region_id || undefined);

  // ─── Memoized derived state ──────────────────────────────────────────────────
  const regions = useMemo(
    () => (Array.isArray(regionsData?.data) ? regionsData.data : regionsData ?? []).map(
      (r: Region) => ({ value: r.id, label: r.name }),
    ),
    [regionsData],
  );

  const districts = useMemo(
    () => (Array.isArray(districtsData) ? districtsData : []).map(
      (d: District) => ({ value: d.id, label: d.name }),
    ),
    [districtsData],
  );

  const statusCfg = useMemo(() => {
    if (!order) return null;
    return STATUS_CONFIG[order.status] ?? null;
  }, [order]);
  const productsLocked = Boolean(order && isOrderReceivedOrLater(order.status));
  const destinationLocked = Boolean(order && isOrderSentToBranch(order));
  const showUpdateError = useCallback((error: unknown) => {
    notificationApi.error({
      message: t("error", { ns: "common", defaultValue: "Xatolik" }),
      description:
        getBackend400Message(error) ??
        t("updateError", { ns: "newOrders", defaultValue: "Ma'lumotlarni yangilab bo'lmadi" }),
      placement: "topRight",
      duration: 5,
    });
  }, [notificationApi, t]);
  const canUseCourierActions = useMemo(
    () =>
      role === "manager" &&
      (branchType === "REGIONAL" || branchType === "HYBRID") &&
      Boolean(order?.status) &&
      ACTIONABLE_STATUSES.has(order?.status ?? ""),
    [role, branchType, order?.status],
  );
  const canRollbackSoldOrder = useMemo(
    () =>
      role === "manager" &&
      (branchType === "REGIONAL" || branchType === "HYBRID") &&
      order?.status === "sold",
    [role, branchType, order?.status],
  );

  const regionName = useMemo(
    () => order?.district?.region?.name ?? order?.region?.name ?? "—",
    [order],
  );
  const districtName = useMemo(() => order?.district?.name ?? "—", [order]);
  const addressText = useMemo(() => order?.address ?? "—", [order]);

  // ─── Handlers — Address popup ─────────────────────────────────────────────
  const handleOpenAddressPopup = useCallback(() => {
    if (destinationLocked) return;
    setAddressForm({
      region_id: order?.district?.region_id ?? order?.region?.id ?? "",
      district_id: order?.district_id ?? order?.district?.id ?? "",
      address: order?.address ?? "",
    });
    setAddressPopupOpen(true);
  }, [destinationLocked, order]);

  const handleCloseAddressPopup = useCallback(() => setAddressPopupOpen(false), []);

  const handleRegionChange = useCallback((v: string) =>
    setAddressForm((p) => ({ ...p, region_id: v, district_id: "" })), []);

  const handleDistrictChange = useCallback((v: string) =>
    setAddressForm((p) => ({ ...p, district_id: v })), []);

  const handleAddressChange = useCallback((v: string) =>
    setAddressForm((p) => ({ ...p, address: v })), []);

  const handleSaveAddress = useCallback(() => {
    if (!orderId || !order || destinationLocked) return;
    const data = buildAddressUpdatePayload(order, addressForm);
    if (!Object.keys(data).length) {
      setAddressPopupOpen(false);
      return;
    }
    updateNewOrder.mutate(
      { orderId, data },
      {
        onSuccess: () => setAddressPopupOpen(false),
        onError: showUpdateError,
      },
    );
  }, [addressForm, destinationLocked, order, orderId, showUpdateError, updateNewOrder]);

  // ─── Handlers — Customer popup ────────────────────────────────────────────
  const handleOpenCustomerPopup = useCallback(() => {
    if (destinationLocked) return;
    setCustomerForm({
      name: order?.customer?.name ?? "",
      phone: order?.customer?.phone_number ?? "",
    });
    setCustomerPopupOpen(true);
  }, [destinationLocked, order]);

  const handleCloseCustomerPopup = useCallback(() => setCustomerPopupOpen(false), []);

  const handleCustomerNameChange = useCallback((v: string) =>
    setCustomerForm((p) => ({ ...p, name: v })), []);

  const handleCustomerPhoneChange = useCallback((v: string) =>
    setCustomerForm((p) => ({ ...p, phone: v })), []);

  const handleSaveCustomer = useCallback(() => {
    if (!userId || !order || destinationLocked) return;
    const data = buildCustomerUpdatePayload(order, customerForm);
    if (!Object.keys(data).length) {
      setCustomerPopupOpen(false);
      return;
    }
    updateUser.mutate(
      { id: userId, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          setCustomerPopupOpen(false);
        },
        onError: showUpdateError,
      },
    );
  }, [customerForm, destinationLocked, order, queryClient, showUpdateError, updateUser, userId]);

  // ─── Handlers — Order popup ───────────────────────────────────────────────
  const handleOpenOrderPopup = useCallback(() => {
    setOrderForm({
      where_deliver: order?.where_deliver ?? "",
      total_price: String(order?.total_price ?? ""),
      comment: order?.comment ?? "",
      items: order?.items.map((i) => ({ ...i })) ?? [],
    });
    setOrderPopupOpen(true);
  }, [order]);

  const handleCloseOrderPopup = useCallback(() => setOrderPopupOpen(false), []);

  const handleOrderDeliverChange = useCallback((v: string) =>
    setOrderForm((p) => ({ ...p, where_deliver: v })), []);

  const handleOrderPriceChange = useCallback((v: string) =>
    setOrderForm((p) => ({ ...p, total_price: v })), []);

  const handleOrderCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      setOrderForm((p) => ({ ...p, comment: e.target.value })),
    [],
  );

  const handleSaveOrder = useCallback(() => {
    if (!orderId || !order) return;
    const data = buildOrderUpdatePayload(order, orderForm, {
      products: productsLocked,
      destination: destinationLocked,
    });
    if (!Object.keys(data).length) {
      setOrderPopupOpen(false);
      return;
    }
    updateNewOrder.mutate(
      { orderId, data },
      {
        onSuccess: () => setOrderPopupOpen(false),
        onError: showUpdateError,
      },
    );
  }, [destinationLocked, order, orderForm, orderId, productsLocked, showUpdateError, updateNewOrder]);

  const adjustQty = useCallback((itemId: string, delta: number) => {
    if (productsLocked) return;
    setOrderForm((p) => ({
      ...p,
      items: p.items.map((i) =>
        i.id === itemId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
      ),
    }));
  }, [productsLocked]);

  const removeItem = useCallback((itemId: string) => {
    if (productsLocked) return;
    setOrderForm((p) => ({ ...p, items: p.items.filter((i) => i.id !== itemId) }));
  }, [productsLocked]);

  const handleNavigateToCustomer = useCallback(
    () => {
      if (!userId) return;
      navigate(`/all-users/${userId}`);
    },
    [navigate, userId],
  );
  const handleSell = useCallback(
    (id: string, payload: { comment: string; extraCost: number }) => {
      SellOrder.mutate(
        { orderId: id, data: payload },
        { onSuccess: () => setIsSellModalOpen(false) },
      );
    },
    [SellOrder],
  );

  const handlePartlySell = useCallback(
    (
      id: string,
      payload: {
        order_item_info: { product_id: string; quantity: number }[];
        totalPrice: number;
        extraCost: number;
        comment: string;
      },
    ) => {
      PartlySellOrder.mutate(
        { orderId: id, data: payload },
        { onSuccess: () => setIsSellModalOpen(false) },
      );
    },
    [PartlySellOrder],
  );

  const handleCancelOrder = useCallback(
    (id: string, payload: { comment: string; extraCost: number; paidAmount: number }) => {
      CancelOrder.mutate(
        { orderId: id, data: payload },
        { onSuccess: () => setIsCancelModalOpen(false) },
      );
    },
    [CancelOrder],
  );
  const handleRollbackConfirm = useCallback(() => {
    if (!order?.id) return;
    RollbackOrder.mutate(order.id, {
      onSuccess: () => setIsRollbackConfirmOpen(false),
    });
  }, [RollbackOrder, order]);

  const sellModalOrder = useMemo(() => {
    if (!order) return null;
    return {
      id: order.id,
      created_at: "",
      status: order.status,
      total_price: order.total_price,
      where_deliver: order.where_deliver,
      product_quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      market: { name: "-" },
      customer: { name: order.customer.name, phone_number: order.customer.phone_number },
      district: { name: districtName },
      region: { name: regionName },
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        product: {
          id: item.product?.id ?? item.id,
          name: item.product?.name ?? "",
          image_url: item.product?.image_url ?? null,
        },
      })),
    };
  }, [order, districtName, regionName]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full space-y-4 rounded-2xl p-3 pb-20 sm:space-y-5 sm:p-4 sm:pb-24 md:space-y-6 md:p-6 md:pb-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <BackButton className="h-11 min-w-11 shrink-0 rounded-2xl px-2" label="" />
          <HeaderName
            icon={<Package />}
            name={order?.customer?.name ?? t("orders")}
            description={t("viewOrderDetails")}
          />
        </div>
        {order?.status && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${statusCfg?.cls ?? DEFAULT_STATUS_CLS}`}>
              {statusCfg
                ? t(statusCfg.labelKey, { ns: statusCfg.ns ?? "orders", defaultValue: order.status })
                : order.status}
            </span>
            {canUseCourierActions && (
              <>
                <button
                  type="button"
                  onClick={() => setIsSellModalOpen(true)}
                  className="rounded-lg bg-success px-3 py-1.5 text-xs font-bold text-primary transition-opacity hover:opacity-90"
                >
                  {t("sell", { ns: "orders" })}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(true)}
                  className="rounded-lg bg-error px-3 py-1.5 text-xs font-bold text-primary transition-opacity hover:opacity-90"
                >
                  {t("cancelOrderAction", { ns: "orders" })}
                </button>
              </>
            )}
            {canRollbackSoldOrder && (
              <button
                type="button"
                onClick={() => setIsRollbackConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/70 bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 shadow-sm transition-colors hover:border-amber-400 hover:bg-amber-200 dark:border-amber-400/35 dark:bg-amber-400/12 dark:text-amber-100 dark:hover:border-amber-300/60 dark:hover:bg-amber-400/20"
              >
                <RotateCcw size={13} />
                {t("restoreOrder", { ns: "orders" })}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
          <Skeleton /><Skeleton />
        </div>
      ) : !order ? (
        <div className="h-64 flex items-center justify-center text-gray-400 dark:text-white">
          <p className="font-bold uppercase tracking-widest text-sm">{t("notFound")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
          {/* ── LEFT ── */}
          <div className="space-y-4">
            {/* Order Products */}
            <Card>
              <div className="space-y-4 p-3.5 sm:p-4 md:p-5">
                <SectionHead
                  icon={<ShoppingBag size={16} />}
                  title={t("orderProducts")}
                  sub={t("productsCount", { count: order.items.length })}
                  action={<EditBtn onClick={handleOpenOrderPopup} />}
                />
                {productsLocked && <LockNotice>{PRODUCTS_LOCK_REASON}</LockNotice>}
                <div className="hidden border-b border-gray-100 pb-2 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:border-white/6 dark:text-white sm:grid sm:grid-cols-[1fr_auto]">
                  <span>{t("product")}</span>
                  <span>{t("quantity")}</span>
                </div>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 items-center gap-2 border-b border-gray-50 py-2 dark:border-white/4 sm:grid-cols-[1fr_auto] sm:gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <ProductThumbnail
                          item={item}
                          alt={item.product?.name ?? t("productFallback", { id: item.id })}
                          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-white/8 dark:bg-white/5"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {item.product?.name ?? t("productFallback", { id: item.id })}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-white">ID: {item.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/70 sm:hidden">
                          {t("quantity")}
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-main/10 text-sm font-black text-main dark:bg-main/20">
                          {item.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-white/6">
                  <span className="text-xs text-gray-400 dark:text-white font-medium">{t("deliveryType")}:</span>
                  <span className="text-xs font-bold text-main">
                    {t(DELIVER_LABELS[order.where_deliver] ?? "deliverAddress")}
                  </span>
                </div>
              </div>
            </Card>

            {/* Payment */}
            <Card>
              <div className="space-y-1 p-3.5 sm:p-4 md:p-5">
                <div className="mb-4">
                  <SectionHead
                    icon={<CreditCard size={16} />}
                    title={t("payment")}
                    sub={t("paymentSubtitle")}
                    iconCls="bg-emerald-500/15 text-emerald-500"
                  />
                </div>
                {PAYMENT_ROWS(order).map(({ labelKey, value, cls }) => (
                  <div
                    key={labelKey}
                    className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/6 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Banknote size={14} className="text-gray-400 dark:text-white" />
                      <span className="text-sm text-gray-500 dark:text-white">{t(labelKey)}</span>
                    </div>
                    <span className={`text-sm tabular-nums ${cls}`}>{value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ── RIGHT ── */}
          <div className="space-y-4">
            {/* Customer */}
            <Card>
              <div className="space-y-4 p-3.5 sm:p-4 md:p-5">
                <SectionHead
                  icon={<User size={16} />}
                  title={t("customerDetails")}
                  sub={t("customerSubtitle")}
                  iconCls="bg-blue-500/15 text-blue-500"
                  action={
                    <button
                      onClick={handleOpenCustomerPopup}
                      disabled={destinationLocked}
                      title={destinationLocked ? DESTINATION_LOCK_REASON : undefined}
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white hover:text-main dark:hover:text-white hover:bg-main/10 dark:hover:bg-white/10 transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Edit2 size={14} />
                    </button>
                  }
                />
                {destinationLocked && <LockNotice>{DESTINATION_LOCK_REASON}</LockNotice>}
                <div
                  onClick={handleNavigateToCustomer}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-main/8 dark:bg-main/10 border border-main/20 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-linear-to-br from-main to-primarydark flex items-center justify-center text-white font-black text-xl shadow-lg shadow-main/30 shrink-0">
                    {order.customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900 dark:text-white">
                      {order.customer.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-white">
                      {t("customerProfileHint")}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-white mb-1">
                    {t("contactInformation")}
                  </p>
                  <InfoRow
                    icon={<Phone size={15} />}
                    label={t("phone")}
                    value={order.customer.phone_number}
                    iconCls="bg-emerald-500/15 text-emerald-500"
                  />
                </div>
              </div>
            </Card>

            {/* Address */}
            <Card>
              <div className="space-y-3 p-3.5 sm:p-4 md:p-5">
                <SectionHead
                  icon={<MapPin size={16} />}
                  title={t("addressTitle")}
                  sub={t("addressSubtitle")}
                  iconCls="bg-amber-500/15 text-amber-500"
                  action={
                    <EditBtn
                      onClick={handleOpenAddressPopup}
                      disabled={destinationLocked}
                      reason={DESTINATION_LOCK_REASON}
                    />
                  }
                />
                {destinationLocked && <LockNotice>{DESTINATION_LOCK_REASON}</LockNotice>}
                <div>
                  <InfoRow
                    icon={<Map size={15} />}
                    label={t("region")}
                    value={regionName}
                    iconCls="bg-blue-500/15 text-blue-500"
                  />
                  <InfoRow
                    icon={<Building size={15} />}
                    label={t("district")}
                    value={districtName}
                    iconCls="bg-purple-500/15 text-purple-500"
                  />
                  <InfoRow
                    icon={<Home size={15} />}
                    label={t("address")}
                    value={addressText}
                    iconCls="bg-emerald-500/15 text-emerald-500"
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {orderId ? <OrderTracking orderId={orderId} currentStatus={order?.status} /> : null}

      {/* ─── Address Edit Popup ─────────────────────────────────────────────── */}
      <UpdatePopup
        isOpen={addressPopupOpen}
        onClose={handleCloseAddressPopup}
        onSave={handleSaveAddress}
        isLoading={updateNewOrder.isPending}
        title={t("editAddress")}
        icon={<MapPin size={20} />}
      >
        {destinationLocked && <LockNotice>{DESTINATION_LOCK_REASON}</LockNotice>}
        <SelectField
          label={t("region")}
          icon={Map}
          value={addressForm.region_id}
          onChange={handleRegionChange}
          placeholder={t("selectRegion")}
          options={regions}
          disabled={destinationLocked}
        />
        <SelectField
          label={t("district")}
          icon={Building}
          value={addressForm.district_id}
          onChange={handleDistrictChange}
          placeholder={addressForm.region_id ? t("selectDistrict") : t("selectRegionFirst")}
          options={districts}
          disabled={destinationLocked}
        />
        <InputField
          label={t("fullAddress")}
          icon={Home}
          value={addressForm.address}
          onChange={handleAddressChange}
          placeholder={t("enterAddress")}
          disabled={destinationLocked}
        />
      </UpdatePopup>

      {/* ─── Customer Edit Popup ────────────────────────────────────────────── */}
      <UpdatePopup
        isOpen={customerPopupOpen}
        onClose={handleCloseCustomerPopup}
        onSave={handleSaveCustomer}
        isLoading={updateUser.isPending}
        title={t("editCustomer")}
        icon={<User size={20} />}
      >
        {destinationLocked && <LockNotice>{DESTINATION_LOCK_REASON}</LockNotice>}
        <InputField
          label={t("name")}
          icon={User}
          value={customerForm.name}
          onChange={handleCustomerNameChange}
          placeholder={t("customerNamePlaceholder")}
          disabled={destinationLocked}
        />
        <InputField
          label={t("phone")}
          icon={Phone}
          value={customerForm.phone}
          onChange={handleCustomerPhoneChange}
          placeholder={t("phonePlaceholder")}
          disabled={destinationLocked}
        />
      </UpdatePopup>

      {/* ─── Order Edit Popup ───────────────────────────────────────────────── */}
      <UpdatePopup
        isOpen={orderPopupOpen}
        onClose={handleCloseOrderPopup}
        onSave={handleSaveOrder}
        isLoading={updateNewOrder.isPending}
        title={t("editOrder")}
        icon={<ShoppingBag size={20} />}
      >
        {productsLocked && <LockNotice>{PRODUCTS_LOCK_REASON}</LockNotice>}
        {destinationLocked && <LockNotice>{DESTINATION_LOCK_REASON}</LockNotice>}
        {/* Mahsulotlar */}
        <div className="space-y-2">
          {orderForm.items.map((item) => (
            <OrderItemRow
              key={item.id}
              item={item}
              onAdjust={adjustQty}
              onRemove={removeItem}
              disabled={productsLocked}
            />
          ))}
        </div>

        {/* Yetkazish turi */}
        <SelectField
          label={t("deliveryType")}
          icon={Truck}
          value={orderForm.where_deliver}
          onChange={handleOrderDeliverChange}
          placeholder={t("selectType")}
          options={DELIVER_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
          disabled={destinationLocked}
        />

        {/* Total amount */}
        <InputField
          label={t("totalAmount")}
          icon={Banknote}
          value={orderForm.total_price}
          onChange={handleOrderPriceChange}
          placeholder={t("enterPrice")}
          disabled={productsLocked}
        />

        {/* Izoh */}
        <div className="space-y-1.5">
          <label className="text-sm text-gray-500 dark:text-white ml-1">{t("note")}</label>
          <div className="relative">
            <div className="absolute left-3.5 top-3.5 text-gray-400 dark:text-white pointer-events-none">
              <MessageSquare size={16} />
            </div>
            <textarea
              value={orderForm.comment}
              onChange={handleOrderCommentChange}
              placeholder={t("enterNote")}
              rows={4}
              className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-10 pr-4 text-gray-800 dark:text-white text-sm font-medium focus:outline-none focus:border-main focus:ring-1 focus:ring-main/30 transition-all resize-none placeholder:text-gray-400 dark:placeholder:text-white/80"
            />
          </div>
        </div>
      </UpdatePopup>

      <SellModal
        order={sellModalOrder}
        open={isSellModalOpen}
        onClose={() => setIsSellModalOpen(false)}
        onSell={handleSell}
        onPartlySell={handlePartlySell}
        isLoading={SellOrder.isPending || PartlySellOrder.isPending}
      />

      <CancelModal
        order={sellModalOrder}
        open={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onCancel={handleCancelOrder}
        isLoading={CancelOrder.isPending}
      />

      <PopupConfirm
        isOpen={isRollbackConfirmOpen}
        onClose={() => setIsRollbackConfirmOpen(false)}
        onConfirm={handleRollbackConfirm}
        title={t("rollbackOrder", { ns: "orders" })}
        message={t("rollbackConfirmMessage", { ns: "orders", id: order?.id })}
        confirmLabel={t("rollbackConfirmLabel", { ns: "orders" })}
        cancelLabel={t("cancelOrderAction", { ns: "orders" })}
        isLoading={RollbackOrder.isPending}
        variant="warning"
      />
    </div>
  );
};

// ─── OrderItemRow: alohida memo komponent (har item uchun re-render izolyatsiyasi) ─
const OrderItemRow = memo(({
  item,
  onAdjust,
  onRemove,
  disabled = false,
}: {
  item: OrderItem;
  onAdjust: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) => {
  const handleDec = useCallback(() => onAdjust(item.id, -1), [item.id, onAdjust]);
  const handleInc = useCallback(() => onAdjust(item.id, 1), [item.id, onAdjust]);
  const handleRemove = useCallback(() => onRemove(item.id), [item.id, onRemove]);

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
      <ProductThumbnail
        item={item}
        alt={item.product?.name ?? "—"}
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/8"
      />
      <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white truncate">
        {item.product?.name ?? "—"}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleDec}
          disabled={disabled}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-white dark:bg-white/8 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/60 hover:text-main transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus size={12} />
        </button>
        <span className="w-6 text-center text-sm font-bold text-gray-900 dark:text-white">
          {item.quantity}
        </span>
        <button
          onClick={handleInc}
          disabled={disabled}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-white dark:bg-white/8 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/60 hover:text-main transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={12} />
        </button>
      </div>
      <button
        onClick={handleRemove}
        disabled={disabled}
        className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
});

export default memo(NewOrderUpdate);
