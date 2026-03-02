import { memo, useEffect, useState } from "react";
import {
    X,
    Save,
    User,
    Phone,
    Calendar,
    Building,
    Building2,
    Store,
    Lock,
    Home,
    MapPin,
    AtSign,
    DollarSign,
} from "lucide-react";
import Popup from "../../../../shared/ui/Popup";
import Select from "../../../../shared/ui/Select";
import { useUser } from "../../../../entities/user/api/userApi";
import { useAppNotification } from "../../../../app/providers/notification/NotificationProvider";
import { UserRoleBadge } from "../../../../entities/user/ui/UserRoleBadge";
import type { UpdateUserRequest } from "../../../../entities/user/types/user";
import type { User as UserType } from "../../../../entities/user/types/user";

// ─── Formatters ────────────────────────────────────────────────────────────────

const formatAmount = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    const parts: string[] = [];
    let remaining = digits;
    while (remaining.length > 3) {
        parts.unshift(remaining.slice(-3));
        remaining = remaining.slice(0, -3);
    }
    if (remaining) parts.unshift(remaining);
    return parts.join(" ");
};

const parseAmount = (value: string): number =>
    Number(value.replace(/\s/g, ""));

const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    const parts: string[] = [];
    if (digits.length > 0) parts.push(digits.slice(0, 2));
    if (digits.length > 2) parts.push(digits.slice(2, 5));
    if (digits.length > 5) parts.push(digits.slice(5, 7));
    if (digits.length > 7) parts.push(digits.slice(7, 9));
    return parts.join(" ");
};

const parsePhone = (value: string): string => value.replace(/\s/g, "");

// ─── Props ─────────────────────────────────────────────────────────────────────

interface UpdateUserModalProps {
    userId: string | null;
    onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const UpdateUserModal = memo(
    ({ userId, onClose }: UpdateUserModalProps) => {
        const { getUserById, updateUser, getRegions } = useUser();
        const { apiRequest } = useAppNotification();

        const { data: rawUser, isLoading } = getUserById(userId ?? "");

        // API response dan user object ni ajratib olish
        const userData: UserType | null = (() => {
            const d = rawUser as any;
            if (d?.data?.data) return d.data.data;
            if (d?.data) return d.data;
            return d ?? null;
        })();

        // Viloyatlar (faqat courier uchun kerak)
        const { data: regionsData } = getRegions();
        const regionList: { id: string; name: string }[] = (() => {
            const d = regionsData as any;
            if (Array.isArray(d)) return d;
            if (d?.data?.items && Array.isArray(d.data.items)) return d.data.items;
            if (d?.data && Array.isArray(d.data)) return d.data;
            if (d?.items && Array.isArray(d.items)) return d.items;
            return [];
        })();

        // ── Rol aniqlovchilar ──────────────────────────────────────────────────────
        const role = userData?.role ?? "";
        const isAdmin = role === "admin" || role === "manager" || role === "superadmin";
        const isCourier = role === "courier";
        const isMarket = role === "market" || role === "marketing";
        const isCustomer = role === "customer";

        // ── Form state ──────────────────────────────────────────────────────────────
        const [form, setForm] = useState<Record<string, string>>({});
        const [regionId, setRegionId] = useState("");

        // userData kelganda prepopulate
        useEffect(() => {
            if (!userData) return;
            const phone = (userData.phone_number ?? "").replace("+998", "");
            setForm({
                name: userData.name ?? "",
                phone: formatPhone(phone),
                password: "",
                status: userData.status ?? "",
                // Admin / Manager
                username: userData.username ?? "",
                salary: userData.salary != null ? formatAmount(String(userData.salary)) : "",
                payment_day: userData.payment_day != null ? String(userData.payment_day) : "",
                // Courier / Market
                tariff_home: userData.tariff_home != null ? formatAmount(String(userData.tariff_home)) : "",
                tariff_center: userData.tariff_center != null ? formatAmount(String(userData.tariff_center)) : "",
                default_tariff: userData.default_tariff ?? "",
            });
            setRegionId("");
        }, [userData?.id]);

        // ── Input handler ──────────────────────────────────────────────────────────
        const handleInput = (
            e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
        ) => {
            const { name, value } = e.target;
            if (["salary", "tariff_home", "tariff_center"].includes(name)) {
                setForm((prev) => ({ ...prev, [name]: formatAmount(value) }));
            } else if (name === "phone") {
                setForm((prev) => ({ ...prev, [name]: formatPhone(value) }));
            } else {
                setForm((prev) => ({ ...prev, [name]: value }));
            }
        };

        // ── Submit — faqat o'zgargan fieldlarni yuboramiz ──────────────────────────
        const handleSubmit = async () => {
            if (!userId || !userData) return;

            const payload: UpdateUserRequest = {};

            // ── Umumiy fieldlar (barcha rollar) ──
            if (form.name?.trim() && form.name !== userData.name)
                payload.name = form.name.trim();

            if (form.phone) {
                const raw = `+998${parsePhone(form.phone)}`;
                if (raw !== userData.phone_number) payload.phone_number = raw;
            }

            if (form.password?.trim()) payload.password = form.password;

            if (form.status && form.status !== userData.status)
                payload.status = form.status as any;

            // ── Admin / Manager ──
            if (isAdmin) {
                if (form.salary) {
                    const val = parseAmount(form.salary);
                    if (val !== (userData as any).salary) payload.salary = val;
                }
                if (form.payment_day) {
                    const val = Number(form.payment_day);
                    if (val !== Number((userData as any).payment_day))
                        payload.payment_day = val;
                }
            }

            // ── Courier ──
            if (isCourier) {
                if (form.tariff_home) {
                    const val = parseAmount(form.tariff_home);
                    if (val !== (userData as any).tariff_home) payload.tariff_home = val;
                }
                if (form.tariff_center) {
                    const val = parseAmount(form.tariff_center);
                    if (val !== (userData as any).tariff_center)
                        payload.tariff_center = val;
                }
                if (regionId) payload.region_id = regionId;
            }

            // ── Market ──
            if (isMarket) {
                if (form.username && form.username !== userData.username)
                    payload.username = form.username;
                if (form.tariff_home) {
                    const val = parseAmount(form.tariff_home);
                    if (val !== (userData as any).tariff_home) payload.tariff_home = val;
                }
                if (form.tariff_center) {
                    const val = parseAmount(form.tariff_center);
                    if (val !== (userData as any).tariff_center)
                        payload.tariff_center = val;
                }
                if (
                    form.default_tariff &&
                    form.default_tariff !== (userData as any).default_tariff
                )
                    payload.default_tariff = form.default_tariff as "address" | "center";
            }

            if (Object.keys(payload).length === 0) {
                onClose();
                return;
            }

            await apiRequest({
                request: () => updateUser.mutateAsync({ id: userId, data: payload }),
                successMessage: `"${userData.name}" muvaffaqiyatli yangilandi!`,
                errorMessage: "Foydalanuvchini yangilashda xatolik yuz berdi",
                onSuccess: onClose,
            });
        };

        // ── Shared classes ─────────────────────────────────────────────────────────
        const inputCls = `
      w-full bg-slate-50 dark:bg-[#1a1f3a] border
      border-slate-200 dark:border-[#4c5798]/20
      focus:border-main dark:focus:border-main focus:ring-main/10
      rounded-xl px-4 py-3 text-slate-800 dark:text-white text-sm font-medium
      placeholder:text-slate-400 dark:placeholder:text-white/30
      focus:outline-none focus:ring-2 transition-all duration-200 shadow-sm
    `;

        const labelCls =
            "block text-xs font-bold text-slate-500 dark:text-white/60 mb-1.5 ml-1 uppercase tracking-wide";

        const SectionDivider = ({ title }: { title: string }) => (
            <div className="col-span-full flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-slate-100 dark:bg-white/10" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/40 whitespace-nowrap">
                    {title}
                </span>
                <div className="h-px flex-1 bg-slate-100 dark:bg-white/10" />
            </div>
        );

        const isPending = updateUser.isPending;

        // ── Render ─────────────────────────────────────────────────────────────────
        return (
            <Popup isShow={!!userId} onClose={onClose}>
                <div
                    className="
          bg-white dark:bg-maindark w-[92vw] max-w-2xl rounded-2xl shadow-2xl
          flex flex-col overflow-hidden
          border border-slate-100 dark:border-primarydark/20
          max-h-[90vh]
        "
                >
                    {/* ── Header ── */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-main/10 flex items-center justify-center">
                                <User size={17} className="text-main" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-800 dark:text-white leading-tight">
                                    {isLoading
                                        ? "Yuklanmoqda..."
                                        : `${userData?.name ?? ""} ni tahrirlash`}
                                </h2>
                                {userData && (
                                    <div className="mt-1">
                                        <UserRoleBadge role={userData.role} />
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* ── Body ── */}
                    <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
                        {isLoading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="space-y-1.5">
                                        <div className="h-3 w-24 rounded bg-slate-100 dark:bg-white/5 animate-pulse" />
                                        <div className="h-11 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                                {/* ── Umumiy (barcha rollar) ── */}
                                {!isCustomer && (
                                    <div className="col-span-full">
                                        <SectionDivider title="Asosiy ma'lumotlar" />
                                    </div>
                                )}

                                {/* Name */}
                                <div className="relative">
                                    <label className={labelCls}>
                                        <User size={11} className="inline mr-1 mb-px" />
                                        Ism Familya
                                    </label>
                                    <input
                                        name="name"
                                        value={form.name ?? ""}
                                        onChange={handleInput}
                                        placeholder="F.I.O"
                                        className={inputCls}
                                    />
                                </div>

                                {/* Phone */}
                                <div className="relative">
                                    <label className={labelCls}>
                                        <Phone size={11} className="inline mr-1 mb-px" />
                                        Telefon
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-white/50 font-medium text-sm select-none z-10">
                                            +998
                                        </span>
                                        <input
                                            name="phone"
                                            value={form.phone ?? ""}
                                            onChange={handleInput}
                                            placeholder="90 123 45 67"
                                            className={inputCls}
                                            style={{ paddingLeft: "3.5rem" }}
                                        />
                                    </div>
                                </div>

                                {!isCustomer && (
                                    <>
                                        {/* Password */}
                                        <div className="relative">
                                            <label className={labelCls}>
                                                <Lock size={11} className="inline mr-1 mb-px" />
                                                Yangi parol (ixtiyoriy)
                                            </label>
                                            <input
                                                name="password"
                                                type="password"
                                                value={form.password ?? ""}
                                                onChange={handleInput}
                                                placeholder="••••••"
                                                className={inputCls}
                                            />
                                        </div>

                                        {/* Status */}
                                        <div className="relative">
                                            <Select
                                                label="Holati"
                                                name="status"
                                                value={form.status ?? ""}
                                                onChange={handleInput as any}
                                                options={[
                                                    { value: "active", label: "Faol" },
                                                    { value: "inactive", label: "Faol emas" },
                                                    { value: "blocked", label: "Bloklangan" },
                                                ]}
                                                placeholder="Tanlang"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* ── Admin / Manager: Moliyaviy ── */}
                                {isAdmin && (
                                    <>
                                        <div className="col-span-full">
                                            <SectionDivider title="Moliyaviy ma'lumotlar" />
                                        </div>

                                        <div className="relative">
                                            <label className={labelCls}>
                                                <DollarSign size={11} className="inline mr-1 mb-px" />
                                                Maosh (so'm)
                                            </label>
                                            <input
                                                name="salary"
                                                value={form.salary ?? ""}
                                                onChange={handleInput}
                                                placeholder="5 000 000"
                                                className={inputCls}
                                            />
                                        </div>

                                        <div className="relative">
                                            <label className={labelCls}>
                                                <Calendar size={11} className="inline mr-1 mb-px" />
                                                To'lov kuni (1–30)
                                            </label>
                                            <input
                                                name="payment_day"
                                                type="number"
                                                min={1}
                                                max={30}
                                                value={form.payment_day ?? ""}
                                                onChange={handleInput}
                                                placeholder="1 – 30"
                                                className={inputCls}
                                            />
                                        </div>
                                    </>
                                )}

                                {/* ── Courier: Tarif + Viloyat ── */}
                                {isCourier && (
                                    <>
                                        <div className="col-span-full">
                                            <SectionDivider title="Kuryer tarifi" />
                                        </div>

                                        <div className="relative">
                                            <label className={labelCls}>
                                                <Home size={11} className="inline mr-1 mb-px" />
                                                Uyga tarif (so'm)
                                            </label>
                                            <input
                                                name="tariff_home"
                                                value={form.tariff_home ?? ""}
                                                onChange={handleInput}
                                                placeholder="10 000"
                                                className={inputCls}
                                            />
                                        </div>

                                        <div className="relative">
                                            <label className={labelCls}>
                                                <Building2 size={11} className="inline mr-1 mb-px" />
                                                Markazga tarif (so'm)
                                            </label>
                                            <input
                                                name="tariff_center"
                                                value={form.tariff_center ?? ""}
                                                onChange={handleInput}
                                                placeholder="8 000"
                                                className={inputCls}
                                            />
                                        </div>

                                        <div className="relative col-span-full sm:col-span-1">
                                            <Select
                                                label="Viloyat"
                                                name="region_id"
                                                value={regionId}
                                                onChange={(e) => setRegionId(e.target.value)}
                                                options={regionList.map((r) => ({
                                                    value: String(r.id),
                                                    label: r.name,
                                                }))}
                                                placeholder={
                                                    regionList.length ? "Tanlang" : "Yuklanmoqda..."
                                                }
                                            />
                                        </div>
                                    </>
                                )}

                                {/* ── Market: Username + Tarif ── */}
                                {isMarket && (
                                    <>
                                        <div className="col-span-full">
                                            <SectionDivider title="Market ma'lumotlari" />
                                        </div>

                                        <div className="relative">
                                            <label className={labelCls}>
                                                <AtSign size={11} className="inline mr-1 mb-px" />
                                                Username
                                            </label>
                                            <input
                                                name="username"
                                                value={form.username ?? ""}
                                                onChange={handleInput}
                                                placeholder="market_01"
                                                className={inputCls}
                                            />
                                        </div>

                                        <div className="relative">
                                            <Select
                                                label="Asosiy tarif"
                                                name="default_tariff"
                                                value={form.default_tariff ?? ""}
                                                onChange={handleInput as any}
                                                options={[
                                                    { value: "center", label: "Markazgacha" },
                                                    { value: "address", label: "Eshikkacha" },
                                                ]}
                                                placeholder="Tanlang"
                                            />
                                        </div>

                                        <div className="relative">
                                            <label className={labelCls}>
                                                <Building size={11} className="inline mr-1 mb-px" />
                                                Uyga tarif (so'm)
                                            </label>
                                            <input
                                                name="tariff_home"
                                                value={form.tariff_home ?? ""}
                                                onChange={handleInput}
                                                placeholder="10 000"
                                                className={inputCls}
                                            />
                                        </div>

                                        <div className="relative">
                                            <label className={labelCls}>
                                                <Store size={11} className="inline mr-1 mb-px" />
                                                Markazga tarif (so'm)
                                            </label>
                                            <input
                                                name="tariff_center"
                                                value={form.tariff_center ?? ""}
                                                onChange={handleInput}
                                                placeholder="8 000"
                                                className={inputCls}
                                            />
                                        </div>
                                    </>
                                )}

                                {/* ── Operator / Superadmin: faqat umumiy fieldlar ── */}
                                {!isAdmin && !isCourier && !isMarket && !isCustomer && (
                                    <div className="col-span-full">
                                        <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                            <MapPin size={14} className="text-slate-400" />
                                            <p className="text-xs text-slate-400 dark:text-white/40">
                                                Bu rol uchun qo'shimcha maydonlar mavjud emas
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Footer ── */}
                    <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-white/5 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl font-semibold text-sm text-slate-500 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                        >
                            Bekor qilish
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isPending || isLoading}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-main hover:bg-main/90 shadow-md shadow-main/20 transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isPending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Saqlanmoqda...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={15} strokeWidth={2.5} />
                                    <span>O'zgarishlarni saqlash</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Popup>
        );
    }
);

UpdateUserModal.displayName = "UpdateUserModal";
