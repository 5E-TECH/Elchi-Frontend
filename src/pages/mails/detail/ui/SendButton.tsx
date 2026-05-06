import { memo } from "react";
import { Send, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";

// ─── Props ────────────────────────────────────────────────────────────────────
interface SendButtonProps {
    selectedCount: number;
    isCourier: boolean;
    mode?: "send" | "receive";
    onSend: () => void;
    onReceive: () => void;
    isBusy?: boolean;
    className?: string;
    sendLabel?: string;
    receiveLabel?: string;
    busyLabel?: string;
}

const SendButton = memo(({
    selectedCount,
    isCourier,
    mode = "send",
    onSend,
    onReceive,
    isBusy = false,
    className = "",
    sendLabel,
    receiveLabel,
    busyLabel,
}: SendButtonProps) => {
    const { t } = useTranslation("mails");
    const isDisabled = selectedCount === 0 || isBusy;
    const shouldReceive = isCourier || mode === "receive";
    const loadingText = busyLabel ?? t("checking");

    if (shouldReceive) {
        return (
            <div className={`pt-2 ${className}`}>
                <button
                    type="button"
                    disabled={isDisabled}
                    onClick={onReceive}
                    className={`flex w-full items-center justify-center gap-2.5 px-6 py-4 rounded-2xl font-semibold text-base transition-all duration-200 ${!isDisabled
                            ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40 hover:scale-[1.02] cursor-pointer"
                            : "bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-white/30 cursor-not-allowed"
                        }`}
                >
                    <Inbox size={16} />
                    {isBusy ? loadingText : receiveLabel ?? t("receiveMail")}
                    {!isDisabled && (
                        <span className="ml-1 px-2 py-0.5 rounded-md bg-white/20 text-xs font-bold">
                            {selectedCount}
                        </span>
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className={`pt-2 ${className}`}>
            <button
                type="button"
                disabled={isDisabled}
                onClick={onSend}
                className={`flex w-full items-center justify-center gap-2.5 px-6 py-4 rounded-2xl font-semibold text-base transition-all duration-200 ${!isDisabled
                        ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40 hover:scale-[1.02] cursor-pointer"
                        : "bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-white/30 cursor-not-allowed"
                    }`}
            >
                <Send size={16} />
                {isBusy ? loadingText : sendLabel ?? t("sendMail")}
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
