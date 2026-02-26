import { memo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  MoveLeft, Package, User, Phone, MapPin,
  QrCode, Minus, Plus, Trash2, Check,
  ChevronDown, CreditCard, Banknote,
} from "lucide-react";
import HeaderName from "../../../shared/components/headerName";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Product { id: number; name: string; price: number; quantity: number }
interface OrderData {
  customerName: string; phone: string;
  region: string; district: string; address: string;
  deliveryType: "market" | "home";
  products: Product[]; paid: number;
}

// ─── Mock (API tayyor bo'lganda almashtiriladi) ─────────────────────────────
const MOCK: OrderData = {
  customerName: "Jurayeva", phone: "+998338809197",
  region: "Farg'ona", district: "Qo'qon shahri", address: "guzar kuchasi 9 uy",
  deliveryType: "home",
  products: [{ id: 1, name: "Safariy", price: 200000, quantity: 1 }],
  paid: 0,
};

const REGIONS = [
  "Toshkent", "Samarqand", "Buxoro", "Farg'ona", "Andijon",
  "Namangan", "Qashqadaryo", "Surxondaryo", "Xorazm",
  "Navoiy", "Jizzax", "Sirdaryo", "Qoraqalpog'iston",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("uz-UZ") + " so'm";

// Light/dark uchun umumiy class lar
const cardCls = "rounded-2xl bg-white dark:bg-white/4 border border-gray-200 dark:border-white/8 p-5 space-y-4 shadow-sm";
const labelCls = "text-xs font-medium text-gray-500 dark:text-white/40 uppercase tracking-wider";
const textPrimary = "text-gray-900 dark:text-white";
const textSecondary = "text-gray-500 dark:text-white/40";
const dividerCls = "border-gray-100 dark:border-white/6";
const iconWrapCls = "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/25 [&>*]:w-4 [&>*]:h-4";

const inputCls = (hasIcon = true) =>
  `w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-2.5 text-sm
   text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25
   focus:outline-none focus:border-main/60 focus:bg-white dark:focus:bg-white/8 transition-all
   ${hasIcon ? "pl-10 pr-4" : "px-4"}`;

const Field = ({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1.5">
    <span className={labelCls}>{label}</span>
    <div className="relative">
      {icon && <span className={iconWrapCls}>{icon}</span>}
      {children}
    </div>
  </label>
);

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className={cardCls}>{children}</div>
);

const SectionHead = ({ icon, title, sub, iconCls = "bg-main/20 text-main" }: {
  icon: React.ReactNode; title: string; sub?: string; iconCls?: string;
}) => (
  <div className="flex items-center gap-3">
    <div className={`p-2.5 rounded-xl ${iconCls}`}>{icon}</div>
    <div>
      <p className={`font-semibold text-sm ${textPrimary}`}>{title}</p>
      {sub && <p className={`text-xs ${textSecondary}`}>{sub}</p>}
    </div>
  </div>
);

// ─── Main Page ───────────────────────────────────────────────────────────────
const NewOrderUpdate = () => {
  const navigate = useNavigate();
  const { marketId, orderId } = useParams();

  const [data, setData] = useState<OrderData>(MOCK);
  const [saving, setSaving] = useState(false);

  const set = useCallback(<K extends keyof OrderData>(k: K, v: OrderData[K]) =>
    setData(p => ({ ...p, [k]: v })), []);

  const changeQty = useCallback((pid: number, delta: number) =>
    setData(p => ({
      ...p,
      products: p.products.map(pr =>
        pr.id === pid ? { ...pr, quantity: Math.max(1, pr.quantity + delta) } : pr
      )
    })), []);

  const removeProduct = useCallback((pid: number) =>
    setData(p => ({ ...p, products: p.products.filter(pr => pr.id !== pid) })), []);

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    console.log("Saved order:", orderId, "in market:", marketId, data);
    setSaving(false);
    navigate(-1);
  };

  const total = data.products.reduce((s, p) => s + p.price * p.quantity, 0);
  const debt = Math.max(0, total - data.paid);

  return (
    <div className="min-h-full rounded-2xl bg-sidebar dark:bg-maindark p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div onClick={() => navigate(-1)} className="cursor-pointer">
          <HeaderName
            icon={<MoveLeft />}
            name="Buyurtmani tahrirlash"
            description={`ID-${orderId} • ${data.products.length} ta mahsulot`}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-main text-white font-bold text-sm
            hover:bg-main/85 active:scale-95 transition-all shadow-lg shadow-main/30
            disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving
            ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Saqlanmoqda...</>
            : <><Check size={16} /> Saqlash</>
          }
        </button>
      </div>

      {/* 2 col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── CHAP ── */}
        <div className="space-y-4">

          {/* Mahsulotlar */}
          <Card>
            <SectionHead icon={<Package size={16} />} title="Order products" sub={`${data.products.length} ta mahsulot`} />
            <div className="space-y-2">
              {data.products.map(p => (
                <div key={p.id}
                  className="group flex items-center gap-3 p-3 rounded-xl
                    bg-gray-50 dark:bg-white/4 border border-gray-200 dark:border-white/6
                    hover:border-main/30 transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-main/10 border border-main/20 flex items-center justify-center shrink-0">
                    <Package size={15} className="text-main/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${textPrimary}`}>{p.name}</p>
                    <p className={`text-xs ${textSecondary}`}>{fmt(p.price)}</p>
                  </div>
                  {/* Miqdor boshqaruvi */}
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 rounded-lg p-1 border border-gray-200 dark:border-white/8">
                    <button onClick={() => changeQty(p.id, -1)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 dark:text-white/50
                        hover:bg-white dark:hover:bg-white/10 hover:text-main transition-all">
                      <Minus size={12} />
                    </button>
                    <span className={`w-6 text-center text-sm font-bold ${textPrimary}`}>{p.quantity}</span>
                    <button onClick={() => changeQty(p.id, 1)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 dark:text-white/50
                        hover:bg-white dark:hover:bg-white/10 hover:text-main transition-all">
                      <Plus size={12} />
                    </button>
                  </div>
                  <button onClick={() => removeProduct(p.id)}
                    className="p-1.5 rounded-lg text-gray-300 dark:text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Yetkazish turi */}
            <div className={`pt-3 border-t ${dividerCls} space-y-2`}>
              <p className={`text-xs font-medium uppercase tracking-wider ${textSecondary}`}>Yetkazish turi</p>
              <div className="flex gap-2">
                {(["market", "home"] as const).map(t => (
                  <button key={t} onClick={() => set("deliveryType", t)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all
                      ${data.deliveryType === t
                        ? "bg-main/15 border-main/40 text-main"
                        : "bg-gray-50 dark:bg-white/4 border-gray-200 dark:border-white/8 text-gray-500 dark:text-white/40 hover:border-main/20"
                      }`}>
                    {t === "market" ? "Markazga" : "Uyga"}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* To'lov */}
          <Card>
            <SectionHead icon={<CreditCard size={16} />} title="To'lov" sub="Summa tafsilotlari" iconCls="bg-emerald-500/15 text-emerald-500" />
            <div className="space-y-2">
              <div className={`flex justify-between py-2.5 border-b ${dividerCls}`}>
                <span className={`text-sm ${textSecondary}`}>Jami summa</span>
                <span className={`font-bold ${textPrimary}`}>{fmt(total)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className={`text-sm ${textSecondary}`}>To'langan</span>
                </div>
                <div className="relative">
                  <Banknote size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/60" />
                  <input type="number" value={data.paid}
                    onChange={e => set("paid", +e.target.value)}
                    className="pl-8 pr-3 py-1.5 w-36 rounded-lg
                      bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10
                      text-emerald-600 dark:text-emerald-400 font-bold text-sm text-right
                      focus:outline-none focus:border-emerald-500/40 transition-all" />
                </div>
              </div>
              <div className="flex justify-between py-2 px-3 rounded-xl bg-red-50 dark:bg-red-500/6 border border-red-100 dark:border-red-500/10">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span className={`text-sm ${textSecondary}`}>Qarz</span>
                </div>
                <span className={`font-bold text-sm ${debt > 0 ? "text-red-500" : "text-emerald-500"}`}>{fmt(debt)}</span>
              </div>
            </div>
          </Card>

          {/* QR */}
          <Card>
            <SectionHead icon={<QrCode size={16} />} title="QR Kod" sub="Buyurtmani tasdiqlash uchun skanerlang" iconCls="bg-purple-500/15 text-purple-500" />
            <div className="flex justify-center py-2">
              <div className="p-3 bg-white rounded-2xl shadow-md border border-gray-100">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=ORDER-${orderId}&bgcolor=ffffff&color=272c52`}
                  alt="QR" className="w-28 h-28 rounded-lg"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* ── O'NG ── */}
        <div className="space-y-4">

          {/* Mijoz */}
          <Card>
            <SectionHead icon={<User size={16} />} title="Customer details" sub="Mijoz haqida ma'lumot" iconCls="bg-blue-500/15 text-blue-500" />
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-main/8 dark:bg-main/10 border border-main/20">
              <div className="w-11 h-11 rounded-full bg-linear-to-br from-main to-primarydark flex items-center justify-center text-white font-bold text-lg shadow-md">
                {data.customerName.charAt(0)}
              </div>
              <div>
                <p className={`font-semibold text-sm ${textPrimary}`}>{data.customerName}</p>
                <p className={`text-xs ${textSecondary}`}>Profilni ko'rish uchun bosing</p>
              </div>
            </div>
            <div className="space-y-3">
              <Field label="Ismi" icon={<User />}>
                <input value={data.customerName} onChange={e => set("customerName", e.target.value)}
                  placeholder="Mijoz ismi" className={inputCls()} />
              </Field>
              <Field label="Telefon" icon={<Phone />}>
                <input value={data.phone} onChange={e => set("phone", e.target.value)}
                  placeholder="+998 __ ___ __ __" className={inputCls()} />
              </Field>
            </div>
          </Card>

          {/* Manzil */}
          <Card>
            <SectionHead icon={<MapPin size={16} />} title="Manzil" sub="Yetkazib berish manzili" iconCls="bg-amber-500/15 text-amber-500" />
            <div className="space-y-3">
              <Field label="Viloyat">
                <div className="relative">
                  <select value={data.region} onChange={e => set("region", e.target.value)}
                    className={`${inputCls(false)} appearance-none cursor-pointer`}>
                    {REGIONS.map(r => (
                      <option key={r} value={r} className="bg-white dark:bg-maindark text-gray-900 dark:text-white">{r}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 pointer-events-none" />
                </div>
              </Field>
              <Field label="Tuman / Shahar" icon={<MapPin />}>
                <input value={data.district} onChange={e => set("district", e.target.value)}
                  placeholder="Tuman yoki shahar" className={inputCls()} />
              </Field>
              <Field label="To'liq manzil" icon={<MapPin />}>
                <input value={data.address} onChange={e => set("address", e.target.value)}
                  placeholder="Ko'cha, uy raqami..." className={inputCls()} />
              </Field>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default memo(NewOrderUpdate);
