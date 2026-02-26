import { memo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  MoveLeft, Package, User, Phone, MapPin,
  Building, Map, Home, ShoppingBag,
  CreditCard, Banknote, Edit2,
} from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import { useOrders } from "../../../entities/orders";

// ─── Types ──────────────────────────────────────────────────────────────────
interface District {
  id: string;
  name: string;
  region?: { name: string };
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
  product: { id: string; name: string; image_url?: string | null } | null;
}

interface OrderDetail {
  id: string;
  where_deliver: "center" | "home" | "address";
  total_price: number;
  to_be_paid: number;
  paid_amount: number;
  status: string;
  comment: string | null;
  address: string | null;
  items: OrderItem[];
  customer: Customer;
  district?: District;
  region?: Region;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("uz-UZ") + " so'm";

const deliverLabel: Record<string, string> = {
  center: "Markazga",
  home: "Uyga",
  address: "Manzilga",
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" },
  processing: { label: "Jarayonda", cls: "bg-amber-500/20 text-amber-400 border border-amber-500/30" },
  completed: { label: "Tayyor", cls: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
};

// ─── Reusable subcomponents ───────────────────────────────────────────────────
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl bg-white dark:bg-white/4 border border-gray-200 dark:border-white/8 ${className}`}>
    {children}
  </div>
);

const SectionHead = ({
  icon, title, sub, iconCls = "bg-main/20 text-main", action,
}: {
  icon: React.ReactNode; title: string; sub?: string;
  iconCls?: string; action?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${iconCls}`}>{icon}</div>
      <div>
        <p className="font-semibold text-sm text-gray-900 dark:text-white">{title}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-white/40">{sub}</p>}
      </div>
    </div>
    {action}
  </div>
);

const InfoRow = ({
  icon, label, value, iconCls = "bg-main/20 text-main",
}: {
  icon: React.ReactNode; label: string; value: string; iconCls?: string;
}) => (
  <div className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-white/6 last:border-0">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconCls}`}>
      {icon}
    </div>
    <div className="flex flex-col">
      <span className="text-[10px] text-gray-400 dark:text-white/40 uppercase tracking-wider font-medium">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
    </div>
  </div>
);

const EditBtn = ({ onClick }: { onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/40
      hover:text-main dark:hover:text-white hover:bg-main/10 dark:hover:bg-white/10 text-xs font-semibold transition-colors"
  >
    <Edit2 size={12} /> Edit
  </button>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = () => (
  <div className="animate-pulse space-y-4">
    {[64, 200, 120].map((h) => (
      <div key={h} className="rounded-2xl bg-gray-100 dark:bg-white/5" style={{ height: h }} />
    ))}
  </div>
);

// ─── Main Page ───────────────────────────────────────────────────────────────
const NewOrderUpdate = () => {
  const navigate = useNavigate();
  const { marketId, orderId } = useParams();

  const { getOrderById } = useOrders();
  const { data: res, isLoading } = getOrderById(orderId ?? "", !!orderId);
  const order: OrderDetail | null = res?.data ?? null;

  const statusCfg = order ? (statusConfig[order.status] ?? statusConfig.new) : null;
  const regionName = order?.customer?.region?.name ?? order?.region?.name ?? "—";
  const districtName = order?.customer?.district?.name ?? order?.district?.name ?? "—";
  const addressText = order?.address ?? "—";

  return (
    <div className="min-h-full rounded-2xl bg-sidebar dark:bg-maindark p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div onClick={() => navigate(-1)} className="cursor-pointer">
          <HeaderName
            icon={<MoveLeft />}
            name={order?.customer?.name ?? "Buyurtma"}
            description="Order details"
          />
        </div>
        {statusCfg && (
          <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${statusCfg.cls}`}>
            {statusCfg.label}
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton />
          <Skeleton />
        </div>
      ) : !order ? (
        <div className="h-64 flex items-center justify-center text-gray-400 dark:text-white/30">
          <p className="font-bold uppercase tracking-widest text-sm">Ma'lumot topilmadi</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── CHAP ── */}
          <div className="space-y-4">

            {/* Order Products */}
            <Card>
              <div className="p-5 space-y-4">
                <SectionHead
                  icon={<ShoppingBag size={16} />}
                  title="Order products"
                  sub={`${order.items.length} ta mahsulot`}
                  action={<EditBtn onClick={() => navigate(`/new-orders/${marketId}/edit/${orderId}`)} />}
                />

                {/* Table header */}
                <div className="grid grid-cols-[1fr_auto] text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-white/30 border-b border-gray-100 dark:border-white/6 pb-2">
                  <span>PRODUCT</span>
                  <span>QUANTITY</span>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 py-2 border-b border-gray-50 dark:border-white/4 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/8 flex items-center justify-center shrink-0 overflow-hidden">
                          {item.product?.image_url ? (
                            <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={18} className="text-gray-300 dark:text-white/20" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {item.product?.name ?? `Mahsulot #${item.id}`}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-white/40">ID: {item.id}</p>
                        </div>
                      </div>
                      <span className="w-8 h-8 rounded-lg bg-main/10 dark:bg-main/20 text-main font-black text-sm flex items-center justify-center">
                        {item.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Delivery type */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-white/6">
                  <span className="text-xs text-gray-400 dark:text-white/40 font-medium">Yetkazish:</span>
                  <span className="text-xs font-bold text-main">{deliverLabel[order.where_deliver] ?? order.where_deliver}</span>
                </div>
              </div>
            </Card>

            {/* Payment */}
            <Card>
              <div className="p-5 space-y-1">
                <div className="mb-4">
                  <SectionHead
                    icon={<CreditCard size={16} />}
                    title="To'lov"
                    sub="Summa tafsilotlari"
                    iconCls="bg-emerald-500/15 text-emerald-500"
                  />
                </div>

                {[
                  { label: "Total", value: fmt(order.total_price), cls: "text-gray-900 dark:text-white font-bold" },
                  { label: "To be paid", value: fmt(order.to_be_paid), cls: "text-amber-500 font-bold" },
                  { label: "Paid", value: fmt(order.paid_amount), cls: "text-emerald-500 font-bold" },
                ].map(({ label, value, cls }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/6 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Banknote size={14} className="text-gray-400 dark:text-white/30" />
                      <span className="text-sm text-gray-500 dark:text-white/60">{label}</span>
                    </div>
                    <span className={`text-sm tabular-nums ${cls}`}>{value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ── O'NG ── */}
          <div className="space-y-4">

            {/* Customer */}
            <Card>
              <div className="p-5 space-y-4">
                <SectionHead
                  icon={<User size={16} />}
                  title="Customer details"
                  sub="Mijoz haqida ma'lumot"
                  iconCls="bg-blue-500/15 text-blue-500"
                  action={
                    <button className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/40 hover:text-main dark:hover:text-white hover:bg-main/10 dark:hover:bg-white/10 transition-colors">
                      <Edit2 size={14} />
                    </button>
                  }
                />

                {/* Avatar */}
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-main/8 dark:bg-main/10 border border-main/20">
                  <div className="w-12 h-12 rounded-full bg-linear-to-br from-main to-primarydark flex items-center justify-center text-white font-black text-xl shadow-lg shadow-main/30 shrink-0">
                    {order.customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900 dark:text-white">{order.customer.name}</p>
                    <p className="text-xs text-gray-400 dark:text-white/40">Profilni ko'rish uchun bosing</p>
                  </div>
                </div>

                {/* Contact */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-white/30 mb-1">
                    CONTACT INFORMATION
                  </p>
                  <InfoRow
                    icon={<Phone size={15} />}
                    label="PHONE"
                    value={order.customer.phone_number}
                    iconCls="bg-emerald-500/15 text-emerald-500"
                  />
                </div>
              </div>
            </Card>

            {/* Address */}
            <Card>
              <div className="p-5 space-y-3">
                <SectionHead
                  icon={<MapPin size={16} />}
                  title="Address"
                  sub="Yetkazib berish manzili"
                  iconCls="bg-amber-500/15 text-amber-500"
                  action={<EditBtn />}
                />
                <div>
                  <InfoRow
                    icon={<Map size={15} />}
                    label="Region"
                    value={regionName}
                    iconCls="bg-blue-500/15 text-blue-500"
                  />
                  <InfoRow
                    icon={<Building size={15} />}
                    label="District"
                    value={districtName}
                    iconCls="bg-purple-500/15 text-purple-500"
                  />
                  <InfoRow
                    icon={<Home size={15} />}
                    label="Address"
                    value={addressText}
                    iconCls="bg-emerald-500/15 text-emerald-500"
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(NewOrderUpdate);
