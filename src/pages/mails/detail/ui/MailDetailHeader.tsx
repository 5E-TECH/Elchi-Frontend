import { memo } from "react";
import { MapPin } from "lucide-react";
import BackButton from "../../../../shared/ui/BackButton";

interface MailDetailHeaderProps {
    regionName: string;
    orderCount: number;
}

const MailDetailHeader = memo(({ regionName, orderCount }: MailDetailHeaderProps) => {
    return (
        <div className="flex items-center gap-4">
            <BackButton className="h-10 min-w-10 shrink-0 rounded-xl px-2" label="" />

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
