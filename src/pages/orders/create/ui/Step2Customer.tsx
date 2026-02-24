import { memo } from "react";
import { User, Phone, MapPin, Home } from "lucide-react";
import { useLogistics } from "../../../../entities/logistics/api/logisticsApi";

interface CustomerFormData {
    phone: string;
    extra_phone: string;
    name: string;
    region_id: string;
    district_id: string;
    address: string;
}

interface Step2CustomerProps {
    data: CustomerFormData;
    onChange: (data: CustomerFormData) => void;
}

interface FieldProps {
    label: string;
    required?: boolean;
    icon: React.ReactNode;
    children: React.ReactNode;
}

const Field = ({ label, required, icon, children }: FieldProps) => (
    <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {icon}
            {label}
            {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {children}
    </div>
);

const inputClass = `
  w-full px-3.5 py-2.5 rounded-xl text-sm
  bg-primary dark:bg-primarydark
  border border-gray-200 dark:border-primarydark/80
  text-maindark dark:text-primary
  placeholder:text-gray-400
  focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main
  transition-all duration-200
`;

const Step2Customer = ({ data, onChange }: Step2CustomerProps) => {
    const { getRegions, getDistricts } = useLogistics();
    const { data: regions, isLoading: regLoading } = getRegions();
    const { data: districts, isLoading: distLoading } = getDistricts(data.region_id);

    const toArray = (val: any): any[] => {
        if (Array.isArray(val)) return val;
        if (val && Array.isArray(val.data)) return val.data;
        if (val && Array.isArray(val.items)) return val.items;
        if (val && Array.isArray(val.results)) return val.results;
        return [];
    };

    const regionList = toArray(regions);
    const districtList = toArray(districts);


    const update = (field: keyof CustomerFormData, value: string) => {
        const next = { ...data, [field]: value };
        if (field === "region_id") next.district_id = "";
        onChange(next);
    };

    return (
        <div className="flex flex-col gap-5">
            {/* Section header */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-main/10 flex items-center justify-center">
                    <User size={18} className="text-main" />
                </div>
                <div>
                    <h3 className="font-semibold text-maindark dark:text-primary text-base">
                        Mijoz ma'lumotlari
                    </h3>
                    <p className="text-xs text-gray-400">Yetkazib berish uchun ma'lumotlar kiriting</p>
                </div>
            </div>

            {/* Form grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Phone */}
                <Field label="Telefon raqam" required icon={<Phone size={12} />}>
                    <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">+998</span>
                        <input
                            type="tel"
                            placeholder="__ ___ __ __"
                            value={data.phone}
                            onChange={(e) => update("phone", e.target.value)}
                            className={`${inputClass} pl-14`}
                            maxLength={9}
                        />
                    </div>
                </Field>

                {/* Extra phone */}
                <Field label="Qo'shimcha raqam" icon={<Phone size={12} />}>
                    <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">+998</span>
                        <input
                            type="tel"
                            placeholder="__ ___ __ __"
                            value={data.extra_phone}
                            onChange={(e) => update("extra_phone", e.target.value)}
                            className={`${inputClass} pl-14`}
                            maxLength={9}
                        />
                    </div>
                </Field>

                {/* Name */}
                <Field label="Ism" required icon={<User size={12} />}>
                    <input
                        type="text"
                        placeholder="Ism kiriting"
                        value={data.name}
                        onChange={(e) => update("name", e.target.value)}
                        className={inputClass}
                    />
                </Field>

                {/* Region */}
                <Field label="Viloyat" required icon={<MapPin size={12} />}>
                    <select
                        value={data.region_id}
                        onChange={(e) => update("region_id", e.target.value)}
                        disabled={regLoading}
                        className={`${inputClass} cursor-pointer`}
                    >
                        <option value="">
                            {regLoading ? "Yuklanmoqda..." : "Viloyat tanlang"}
                        </option>
                        {regionList.map((r: any) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </Field>

                {/* District */}
                <Field label="Tuman" required icon={<MapPin size={12} />}>
                    <select
                        value={data.district_id}
                        onChange={(e) => update("district_id", e.target.value)}
                        disabled={!data.region_id || distLoading}
                        className={`${inputClass} cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        <option value="">
                            {!data.region_id
                                ? "Avval viloyat tanlang"
                                : distLoading
                                    ? "Yuklanmoqda..."
                                    : "Tuman tanlang"}
                        </option>
                        {districtList.map((d: any) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </Field>

                {/* Address — full width */}
                <div className="sm:col-span-2">
                    <Field label="Manzil" required icon={<Home size={12} />}>
                        <textarea
                            placeholder="To'liq manzil kiriting..."
                            value={data.address}
                            onChange={(e) => update("address", e.target.value)}
                            rows={2}
                            className={`${inputClass} resize-none`}
                        />
                    </Field>
                </div>
            </div>
        </div>
    );
};

export default memo(Step2Customer);
