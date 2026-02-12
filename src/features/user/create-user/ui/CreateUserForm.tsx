import React, { memo, useState, useEffect } from 'react';
import type { UserRole } from '../../../../entities/user/types/user';
import { RoleSelector } from './RoleSelector';
import { Eye, EyeOff, Send, Shield, Users, Truck, Store, MapPin, Building, Calendar, DollarSign, User, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CreateUserForm = memo(() => {
    const navigate = useNavigate();
    const [role, setRole] = useState<UserRole>('admin');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        password: '',
        salary: '',
        paymentDay: '',
        region: '',
        homeRate: '',
        centerRate: '',
        marketName: '',
        deliveryType: '',
    });

    // Validation errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
        }));
    }, [role]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.fullName.trim()) {
            newErrors.fullName = 'Ism talab qilinadi';
        }
        if (!formData.phone.trim()) {
            newErrors.phone = 'Telefon raqam talab qilinadi';
        }
        if (!formData.password.trim()) {
            newErrors.password = 'Parol talab qilinadi';
        }
        if (formData.password.length < 6) {
            newErrors.password = 'Parol kamida 6 ta belgi bo\'lishi kerak';
        }

        if (role === 'courier' && !formData.region) {
            newErrors.region = 'Viloyat tanlang';
        }
        if (role === 'marketing' && !formData.marketName.trim()) {
            newErrors.marketName = 'Market nomi talab qilinadi';
        }
        if ((role === 'admin' || role === 'manager') && !formData.salary) {
            newErrors.salary = 'Maosh talab qilinadi';
        }
        if ((role === 'admin' || role === 'manager') && !formData.paymentDay) {
            newErrors.paymentDay = 'To\'lov kuni talab qilinadi';
        }
        if ((role === 'courier' || role === 'marketing') && !formData.homeRate) {
            newErrors.homeRate = 'Uy tarifini kiriting';
        }
        if ((role === 'courier' || role === 'marketing') && !formData.centerRate) {
            newErrors.centerRate = 'Markaz tarifini kiriting';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        const submitData = {
            role,
            ...formData,
        };

        console.log('Form Submitted:', submitData);

        // Mimic API call
        setTimeout(() => {
            setLoading(false);
            navigate('/all-users');
        }, 1000);
    };

    const renderInput = (
        label: string,
        name: string,
        type: string = 'text',
        placeholder: string,
        icon?: any,
        required: boolean = true
    ) => (
        <div className="space-y-2 group">
            <label className="text-sm font-semibold text-main dark:text-primary/70 ml-1 group-focus-within:text-main transition-colors">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                {icon && (
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-main/40 dark:text-primary/40 group-focus-within:text-main dark:group-focus-within:text-primary transition-colors">
                        {icon}
                    </span>
                )}
                {name === 'phone' && !icon && (
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-main/50 dark:text-primary/50 font-medium">+998</span>
                )}
                <input
                    type={type}
                    name={name}
                    value={(formData as any)[name]}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    required={required}
                    className={`w-full bg-primary dark:bg-[#1a1f3a] border ${
                        errors[name]
                            ? 'border-red-400 dark:border-red-500'
                            : 'border-main/10 dark:border-primary/10 focus:border-main dark:focus:border-primary'
                    } rounded-xl ${icon ? 'pl-14' : name === 'phone' ? 'pl-16' : 'px-5'} pr-5 py-4 text-main dark:text-primary focus:ring-4 focus:ring-main/10 dark:focus:ring-primary/10 outline-none transition-all placeholder:text-main/30 dark:placeholder:text-primary/30`}
                />
                {errors[name] && (
                    <span className="text-xs text-red-500 mt-1 block">{errors[name]}</span>
                )}
            </div>
        </div>
    );

    const renderPasswordInput = () => (
        <div className="space-y-2 group">
            <label className="text-sm font-semibold text-main dark:text-primary/70 ml-1 group-focus-within:text-main transition-colors">
                Parol <span className="text-red-500">*</span>
            </label>
            <div className="relative">
                <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Kuchli parol o'ylab toping"
                    required
                    className={`w-full bg-primary dark:bg-[#1a1f3a] border ${
                        errors.password
                            ? 'border-red-400 dark:border-red-500'
                            : 'border-main/10 dark:border-primary/10 focus:border-main dark:focus:border-primary'
                    } rounded-xl px-5 py-4 text-main dark:text-primary focus:ring-4 focus:ring-main/10 dark:focus:ring-primary/10 outline-none transition-all placeholder:text-main/30 dark:placeholder:text-primary/30`}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-main/40 dark:text-primary/40 hover:text-main dark:hover:text-primary transition-colors p-1"
                >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
                {errors.password && (
                    <span className="text-xs text-red-500 mt-1 block">{errors.password}</span>
                )}
            </div>
        </div>
    );

    const renderSelect = (
        label: string,
        name: string,
        options: { value: string; label: string }[],
        placeholder: string,
        required: boolean = true
    ) => (
        <div className="space-y-2 group">
            <label className="text-sm font-semibold text-main dark:text-primary/70 ml-1 group-focus-within:text-main transition-colors">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <select
                    name={name}
                    value={(formData as any)[name]}
                    onChange={handleInputChange}
                    required={required}
                    className={`w-full bg-primary dark:bg-[#1a1f3a] border ${
                        errors[name]
                            ? 'border-red-400 dark:border-red-500'
                            : 'border-main/10 dark:border-primary/10 focus:border-main dark:focus:border-primary'
                    } rounded-xl px-5 py-4 text-main dark:text-primary focus:ring-4 focus:ring-main/10 dark:focus:ring-primary/10 outline-none transition-all appearance-none cursor-pointer`}
                >
                    <option value="" disabled className="text-main/50 dark:text-primary/50">
                        {placeholder}
                    </option>
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-primary dark:bg-maindark text-main dark:text-primary">
                            {opt.label}
                        </option>
                    ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-main/40 dark:text-primary/40">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                {errors[name] && (
                    <span className="text-xs text-red-500 mt-1 block">{errors[name]}</span>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-primary dark:bg-[#2A2555] p-6">
            <div className="max-w-6xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-main dark:text-primary hover:opacity-70 transition-opacity mb-8 font-medium"
                >
                    <ArrowLeft size={20} />
                    Orqaga
                </button>

                {/* Main Card */}
                <div className="bg-primary dark:bg-[#3D3A5C] rounded-3xl p-6 lg:p-10 shadow-xl shadow-main/5 dark:shadow-black/20">
                    {/* Header */}
                    <div className="mb-10">
                        <h1 className="text-3xl font-bold text-main dark:text-primary flex items-center gap-4 mb-2">
                            <span className="p-3 rounded-xl bg-linear-to-br from-main to-indigo-600 dark:from-[#4B5C9C] dark:to-indigo-500 text-white shadow-lg shadow-main/20 dark:shadow-main/10">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </span>
                            Yangi Foydalanuvchi Yaratish
                        </h1>
                        <p className="text-main/60 dark:text-primary/60 ml-16 font-medium">Sistemaga yangi foydalanuvchi qo'shing</p>
                    </div>

                    {/* Role Selector */}
                    <RoleSelector selectedRole={role} onSelect={setRole} />

                    {/* Form Container */}
                    <div className="bg-primary dark:bg-[#272C52]/50 rounded-2xl p-8 border border-main/5 dark:border-primary/5 backdrop-blur-sm">
                        {/* Role Info Card */}
                        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-main/10 dark:border-primary/10">
                            <div
                                className={`p-4 rounded-2xl bg-linear-to-br text-white shadow-lg ${
                                    role === 'admin'
                                        ? 'from-purple-600 to-indigo-600 shadow-purple-500/20'
                                        : role === 'manager'
                                            ? 'from-blue-500 to-cyan-500 shadow-blue-500/20'
                                            : role === 'courier'
                                                ? 'from-orange-500 to-amber-500 shadow-orange-500/20'
                                                : 'from-emerald-500 to-teal-500 shadow-emerald-500/20'
                                }`}
                            >
                                <ShieldIcon role={role} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-main dark:text-primary capitalize mb-1">
                                    {role === 'manager' ? "Ro'yxatchi" : role} yaratish
                                </h3>
                                <p className="text-main/50 dark:text-primary/50">
                                    {role === 'manager' ? "Ro'yxatchi" : role} ma'lumotlarini to'liq kiriting
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            {/* Common Fields Section */}
                            <div>
                                <h4 className="text-sm font-bold text-main dark:text-primary mb-4 uppercase tracking-wide opacity-70">
                                    Asosiy Ma'lumotlar
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {renderInput('Ism Familya', 'fullName', 'text', 'Ismni kiriting', <User size={20} />)}
                                    {renderInput('Telefon raqam', 'phone', 'tel', '90 123 45 67', null)}
                                    {renderPasswordInput()}
                                </div>
                            </div>

                            {/* Role-specific Fields */}
                            {(role === 'admin' || role === 'manager') && (
                                <div>
                                    <h4 className="text-sm font-bold text-main dark:text-primary mb-4 uppercase tracking-wide opacity-70">
                                        Maosh Ma'lumotlari
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {renderInput('Oylik Maosh', 'salary', 'number', 'Oylikni kiriting', <DollarSign size={20} />)}
                                        {renderInput('To\'lov Kuni (1-31)', 'paymentDay', 'number', 'To\'lov kunini kiriting', <Calendar size={20} />)}
                                    </div>
                                </div>
                            )}

                            {role === 'courier' && (
                                <div>
                                    <h4 className="text-sm font-bold text-main dark:text-primary mb-4 uppercase tracking-wide opacity-70">
                                        Viloyat Ma'lumotlari
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {renderSelect(
                                            'Viloyat',
                                            'region',
                                            [
                                                { value: 'tashkent', label: 'Toshkent shahri' },
                                                { value: 'samarkand', label: 'Samarqand' },
                                                { value: 'bukhara', label: 'Buxoro' },
                                                { value: 'khiva', label: 'Xiva' },
                                                { value: 'andijan', label: 'Andijon' },
                                                { value: 'fergana', label: 'Farg\'ona' },
                                                { value: 'namangan', label: 'Namangan' },
                                                { value: 'kashkadarya', label: 'Qashqadaryo' },
                                                { value: 'surkhandarya', label: 'Surxondaryo' },
                                                { value: 'jizzakh', label: 'Jizzax' },
                                                { value: 'navoi', label: 'Navoi' },
                                            ],
                                            'Joylashuvni tanlang'
                                        )}
                                    </div>
                                </div>
                            )}

                            {role === 'marketing' && (
                                <div>
                                    <h4 className="text-sm font-bold text-main dark:text-primary mb-4 uppercase tracking-wide opacity-70">
                                        Bozor Ma'lumotlari
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {renderInput('Market Nomi', 'marketName', 'text', 'Market nomini kiriting', <Store size={20} />)}
                                        {renderSelect(
                                            'Yetkazib Berish Turi',
                                            'deliveryType',
                                            [
                                                { value: 'center', label: 'Markazgacha' },
                                                { value: 'door', label: 'Eshikkacha' },
                                            ],
                                            'Tur tanlang'
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Tariff Fields */}
                            {(role === 'courier' || role === 'marketing') && (
                                <div>
                                    <h4 className="text-sm font-bold text-main dark:text-primary mb-4 uppercase tracking-wide opacity-70">
                                        Tarif Ma'lumotlari
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {renderInput('Uyga Tarifi', 'homeRate', 'number', 'Uy tarifini kiriting', <Building size={20} />)}
                                        {renderInput('Markazga Tarifi', 'centerRate', 'number', 'Markaz tarifini kiriting', <MapPin size={20} />)}
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-8 flex gap-4 justify-end border-t border-main/10 dark:border-primary/10">
                                <button
                                    type="button"
                                    onClick={() => navigate(-1)}
                                    className="px-8 py-3 rounded-xl font-bold transition-all text-main dark:text-primary bg-primary dark:bg-[#1a1f3a] hover:opacity-70 border border-main/20 dark:border-primary/20"
                                >
                                    Bekor qilish
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`
                                        flex items-center gap-3 text-white font-bold py-3 px-10 rounded-xl transition-all duration-300 shadow-lg transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none
                                        ${
                                            role === 'admin'
                                                ? 'bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-500/30'
                                                : role === 'manager'
                                                    ? 'bg-linear-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 shadow-blue-500/30'
                                                    : role === 'courier'
                                                        ? 'bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 shadow-orange-500/30'
                                                        : 'bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/30'
                                        }
                                    `}
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Saqlanmoqda...
                                        </>
                                    ) : (
                                        <>
                                            {role === 'manager'
                                                ? "Ro'yxatchi"
                                                : role === 'marketing'
                                                    ? 'Market'
                                                    : role.charAt(0).toUpperCase() + role.slice(1)}{' '}
                                            yaratish
                                            <Send size={20} className="stroke-[2.5]" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
});

const ShieldIcon = ({ role }: { role: string }) => {
    switch (role) {
        case 'admin':
            return <Shield size={28} />;
        case 'manager':
            return <Users size={28} />;
        case 'courier':
            return <Truck size={28} />;
        case 'marketing':
            return <Store size={28} />;
        default:
            return <Shield size={28} />;
    }
};

CreateUserForm.displayName = 'CreateUserForm';