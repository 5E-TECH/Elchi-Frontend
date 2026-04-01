import { memo } from "react";
import { House, RefreshCw, ServerCrash, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ErrorActions from "./error-page/ErrorActions";
import ErrorCode from "./error-page/ErrorCode";
import ErrorInfoCard from "./error-page/ErrorInfoCard";
import ErrorPageLayout from "./error-page/ErrorPageLayout";

const ServerErrorPage = () => {
  const navigate = useNavigate();

  return (
    <ErrorPageLayout>
      <ErrorCode leftDigit="5" rightDigit="0" subtitle="INTERNAL SERVER ERROR" />

      <div className="mt-10 text-center">
        <h1 className="text-4xl font-black text-primary sm:text-5xl">
          Server xatosi yuz berdi
        </h1>
        <p className="error-page-muted mx-auto mt-5 max-w-3xl text-sm leading-7 sm:text-base">
          Serverda kutilmagan xato yuz berdi. Iltimos, keyinroq urinib ko'ring.
        </p>
      </div>

      <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        <ErrorInfoCard icon={<ServerCrash size={22} />} label="HOLAT" value="Server ishlamayapti" />
        <ErrorInfoCard icon={<ShieldAlert size={22} />} label="KOD" value="500 Server Error" />
        <ErrorInfoCard icon={<RefreshCw size={22} />} label="TAVSIYA" value="Qayta urinib ko'ring" />
      </div>

      <ErrorActions
        primary={{
          label: "Qayta yuklash",
          icon: <RefreshCw size={17} />,
          onClick: () => window.location.reload(),
        }}
        secondary={{
          label: "Asosiy sahifaga qaytish",
          icon: <House size={17} />,
          onClick: () => navigate("/"),
        }}
      />
    </ErrorPageLayout>
  );
};

export default memo(ServerErrorPage);
