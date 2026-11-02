// dizayn-v2: (maket yo'q) investor-dashboard-home
import { useParams } from "react-router-dom";
import InvestorDashboardPage from "./InvestorDashboardPage";

/**
 * SUPERADMIN NAZORATI (vpKijXce) — `/investor/:investorId`: investor kabineti faqat o'qish uchun (`GET
 * investors/:id/dashboard`). Kirish — Ops → «Investorlar» ro'yxatidagi «Kabinetni ko'rish». `key`: boshqa investor
 * ochilganda oyna va eski javob oldingisidan qolmaydi.
 */
const InvestorControlPage = () => {
  const { investorId = "" } = useParams();
  return <InvestorDashboardPage key={investorId} investorId={investorId} />;
};

export default InvestorControlPage;
