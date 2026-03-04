import { memo } from "react";
import { Send } from "lucide-react";

interface SendButtonProps {
    selectedCount: number;
    onSend: () => void;
}

const SendButton = memo(({ selectedCount, onSend }: SendButtonProps) => {
    const isDisabled = selectedCount === 0;

    return (
        <div className="pt-2">
            <button
                type="button"
                disabled={isDisabled}
                onClick={onSend}
                className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200 ${!isDisabled
                        ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40 hover:scale-[1.02] cursor-pointer"
                        : "bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-white/30 cursor-not-allowed"
                    }`}
            >
                <Send size={16} />
                Pochtani jo'natish
                {!isDisabled && (
                    <span className="ml-1 px-2 py-0.5 rounded-md bg-white/20 text-xs font-bold">
                        {selectedCount}
                    </span>
                )}
            </button>
        </div>
    );
});
SendButton.displayName = "SendButton";

export default SendButton;
