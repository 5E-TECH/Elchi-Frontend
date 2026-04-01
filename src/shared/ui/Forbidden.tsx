import { memo } from "react";
import { ArrowLeft, House, LockKeyhole, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ErrorActions from "./error-page/ErrorActions";
import ErrorCode from "./error-page/ErrorCode";
import ErrorInfoCard from "./error-page/ErrorInfoCard";
import ErrorPageLayout from "./error-page/ErrorPageLayout";

const ForbiddenPage = () => {
  const navigate = useNavigate();

  return (
    <ErrorPageLayout>
      <ErrorCode leftDigit="4" rightDigit="3" subtitle="ACCESS DENIED" />

      <div className="mt-10 text-center">
        <h1 className="text-4xl font-black text-primary sm:text-5xl">
          Kirish taqiqlangan
        </h1>
        <p className="error-page-muted mx-auto mt-5 max-w-3xl text-sm leading-7 sm:text-base">
          Sizda bu sahifaga kirish huquqi yo'q. Administrator bilan bog'laning.
        </p>
      </div>

      <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        <ErrorInfoCard icon={<LockKeyhole size={22} />} label="HOLAT" value="Ruxsat yo'q" />
        <ErrorInfoCard icon={<ShieldAlert size={22} />} label="KOD" value="403 Forbidden" />
        <ErrorInfoCard icon={<House size={22} />} label="TAVSIYA" value="Dashboardga qayting" />
      </div>

      <ErrorActions
        primary={{
          label: "Asosiy sahifaga qaytish",
          icon: <House size={17} />,
          onClick: () => navigate("/"),
        }}
        secondary={{
          label: "Orqaga qaytish",
          icon: <ArrowLeft size={17} />,
          onClick: () => navigate(-1),
        }}
      />
    </ErrorPageLayout>
  );
};

export default memo(ForbiddenPage);
