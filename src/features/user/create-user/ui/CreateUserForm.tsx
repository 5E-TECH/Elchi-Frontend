import { memo, useState } from 'react';
import type { UserRole } from '../../../../entities/user/types/user';
import { RoleSelector } from './RoleSelector';
import { Eye, EyeOff, Send, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CreateUserForm = memo(() => {
    const navigate = useNavigate();
    const [role, setRole] = useState<UserRole>('admin');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Mimic API call
        setTimeout(() => {
            setLoading(false);
            navigate('/all-users');
        }, 1000);
    };

    return (
        <div className="bg-[var(--primarydark)] rounded-3xl p-6 lg:p-10 shadow-2xl shadow-black/10 mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold text-[var(--primary)] mb-8 flex items-center gap-3">
                <span className="bg-gradient-to-r from-[var(--main)] to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-[var(--main)]/30">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                </span>
                Foydalanuvchi yaratish
            </h2>

            <RoleSelector selectedRole={role} onSelect={setRole} />

            <div className="bg-[var(--maindark)]/30 rounded-2xl p-8 border border-[var(--primary)]/5 backdrop-blur-sm">
                <div className="flex items-center gap-4 mb-8 pb-6 border-b border-[var(--primary)]/5">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-[var(--main)] to-purple-600 text-white shadow-lg shadow-[var(--main)]/20">
                        <ShieldIcon role={role} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-[var(--primary)] capitalize mb-1">{role} qo'shish</h3>
                        <p className="text-[var(--primary)]/50">Yangi xodim uchun shaxsiy ma'lumotlarni to'ldiring</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 group">
                            <label className="text-sm font-semibold text-[var(--primary)]/70 ml-1 group-focus-within:text-[var(--main)] transition-colors">Ism va Familiya <span className="text-red-400">*</span></label>
                            <input
                                type="text"
                                placeholder="F.I.SH kiriting"
                                required
                                className="w-full bg-[var(--maindark)]/50 border border-[var(--primary)]/10 rounded-xl px-5 py-4 text-[var(--primary)] focus:border-[var(--main)] focus:ring-4 focus:ring-[var(--main)]/10 outline-none transition-all placeholder:text-[var(--primary)]/30"
                            />
                        </div>

                        <div className="space-y-2 group">
                            <label className="text-sm font-semibold text-[var(--primary)]/70 ml-1 group-focus-within:text-[var(--main)] transition-colors">Telefon raqam <span className="text-red-400">*</span></label>
                            <div className="relative">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--primary)]/50 font-medium">+998</span>
                                <input
                                    type="tel"
                                    placeholder="90 123 45 67"
                                    required
                                    className="w-full bg-[var(--maindark)]/50 border border-[var(--primary)]/10 rounded-xl pl-16 pr-5 py-4 text-[var(--primary)] focus:border-[var(--main)] focus:ring-4 focus:ring-[var(--main)]/10 outline-none transition-all placeholder:text-[var(--primary)]/30"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 group">
                            <label className="text-sm font-semibold text-[var(--primary)]/70 ml-1 group-focus-within:text-[var(--main)] transition-colors">Parol <span className="text-red-400">*</span></label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Kuchli parol o'ylab toping"
                                    required
                                    className="w-full bg-[var(--maindark)]/50 border border-[var(--primary)]/10 rounded-xl px-5 py-4 text-[var(--primary)] focus:border-[var(--main)] focus:ring-4 focus:ring-[var(--main)]/10 outline-none transition-all placeholder:text-[var(--primary)]/30"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--primary)]/40 hover:text-[var(--main)] transition-colors p-1"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 group">
                            <label className="text-sm font-semibold text-[var(--primary)]/70 ml-1 group-focus-within:text-[var(--main)] transition-colors">Oylik maosh <span className="text-red-400">*</span></label>
                            <div className="relative">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--primary)]/50 font-medium">$</span>
                                <input
                                    type="number"
                                    placeholder="0"
                                    required
                                    className="w-full bg-[var(--maindark)]/50 border border-[var(--primary)]/10 rounded-xl pl-10 pr-5 py-4 text-[var(--primary)] focus:border-[var(--main)] focus:ring-4 focus:ring-[var(--main)]/10 outline-none transition-all placeholder:text-[var(--primary)]/30"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-gradient-to-r from-[var(--main)] to-indigo-600 hover:from-[var(--main)]/90 hover:to-indigo-600/90 text-white font-bold py-4 px-10 rounded-xl transition-all duration-300 flex items-center gap-3 shadow-xl shadow-[var(--main)]/30 transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none w-full md:w-auto min-w-[200px] justify-center"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    Saqlash <Send size={20} className="stroke-[2.5]" />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});

const ShieldIcon = ({ role }: { role: any }) => {
    // Simple icon switcher based on role if needed, or just generic
    console.log(role); // Use variable to avoid warning for now, or implement logic
    return <Shield size={24} />;
};
