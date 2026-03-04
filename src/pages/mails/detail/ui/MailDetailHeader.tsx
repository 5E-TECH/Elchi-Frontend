import { memo } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MailDetailHeaderProps {
    regionName: string;
    orderCount: number;
}

const MailDetailHeader = memo(({ regionName, orderCount }: MailDetailHeaderProps) => {
    const navigate = useNavigate();

    return (
        <div className="flex items-center gap-4">
            <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-primarydark border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/60 hover:border-main/40 hover:text-main dark:hover:text-main transition-all duration-200 cursor-pointer shrink-0"
            >
                <ArrowLeft size={18} />
            </button>

            <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-main flex items-center justify-center shrink-0">
                        <MapPin size={14} className="text-white" />
                    </div>
                    <h1 className="text-lg font-bold text-gray-800 dark:text-white">
                        {regionName} Buyurtmalar
                    </h1>
                </div>
                <p className="text-gray-400 dark:text-white/60 text-xs ml-9">
                    {orderCount} ta buyurtma mavjud
                </p>
            </div>
        </div>
    );
});
MailDetailHeader.displayName = "MailDetailHeader";

export default MailDetailHeader;
