import { memo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import Popup from "../../../shared/ui/Popup";
import HeaderName from "../../../shared/components/headerName";
import Button from "../../../shared/components/button";

interface CashboxFormPopupProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    icon: ReactNode;
    accentColor: string;      // e.g. "from-rose-500 to-rose-600"
    submitLabel: string;
    submitIcon?: ReactNode;
    sourceTypes?: { id: string | number; name: string }[];
    isLoading?: boolean;
    onSubmit: (data: { amount: number; source_type_id: string; comment: string }) => void;
}

const CashboxFormPopup = ({
    isOpen,
    onClose,
    title,
    description,
    icon,
    accentColor,
    submitLabel,
    submitIcon,
    sourceTypes = [],
    isLoading = false,
    onSubmit,
}: CashboxFormPopupProps) => {
    const [amount, setAmount] = useState("");
    const [sourceTypeId, setSourceTypeId] = useState("");
    const [comment, setComment] = useState("");

    const handleClose = () => {
        setAmount("");
        setSourceTypeId("");
        setComment("");
        onClose();
    };

    const handleSubmit = () => {
        if (!amount || !sourceTypeId) return;
        onSubmit({
            amount: Number(amount),
            source_type_id: sourceTypeId,
            comment,
        });
        handleClose();
    };

    const isValid = amount !== "" && Number(amount) > 0 && sourceTypeId !== "";

    return (
        <Popup isShow={isOpen} onClose={handleClose}>
            <div className="bg-primary dark:bg-maindark w-[92vw] max-w-[460px] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                {/* Gradient header */}
                <div className={`bg-gradient-to-r ${accentColor} px-6 py-5 flex items-center justify-between`}>
                    <HeaderName name={title} description={description} icon={icon} />
                    <button
                        onClick={handleClose}
                        className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors shrink-0"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form body */}
                <div className="px-6 py-6 flex flex-col gap-5">
                    {/* Amount */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-gray-700 dark:text-white/70">
                            Amount <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min={0}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0"
                                className="w-full h-12 rounded-xl border border-gray-200 dark:border-glass-border bg-white dark:bg-primarydark px-4 pr-16 text-gray-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main transition-all placeholder-gray-400"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 dark:text-white/40 pointer-events-none">
                                UZS
                            </span>
                        </div>
                    </div>

                    {/* Payment type */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-gray-700 dark:text-white/70">
                            payment type <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={sourceTypeId}
                                onChange={(e) => setSourceTypeId(e.target.value)}
                                className="w-full h-12 rounded-xl border border-gray-200 dark:border-glass-border bg-white dark:bg-primarydark px-4 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main transition-all appearance-none cursor-pointer"
                            >
                                <option value="">payment type</option>
                                {sourceTypes.map((t) => (
                                    <option key={t.id} value={String(t.id)}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </span>
                        </div>
                    </div>

                    {/* Comment */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-gray-700 dark:text-white/70">
                            Comment
                        </label>
                        <textarea
                            rows={3}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Comment..."
                            className="w-full rounded-xl border border-gray-200 dark:border-glass-border bg-white dark:bg-primarydark px-4 py-3 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-main/30 focus:border-main transition-all resize-none placeholder-gray-400"
                        />
                    </div>
                </div>

                {/* Footer buttons */}
                <div className="flex justify-end gap-3 px-6 pb-6">
                    <Button
                        label="Cancel"
                        className="border border-gray-200 dark:border-glass-border text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5"
                        onClick={handleClose}
                    />
                    <Button
                        label={isLoading ? "Loading..." : submitLabel}
                        icon={submitIcon}
                        className={`px-7 bg-gradient-to-r ${accentColor} text-white ${!isValid || isLoading ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"
                            }`}
                        onClick={handleSubmit}
                        disabled={!isValid || isLoading}
                    />
                </div>
            </div>
        </Popup>
    );
};

export default memo(CashboxFormPopup);
