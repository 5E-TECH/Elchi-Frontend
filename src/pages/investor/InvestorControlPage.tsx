// dizayn-v2: (maket yo'q) investor-dashboard-home
import { useParams } from "react-router-dom";
import InvestorDashboardPage from "./InvestorDashboardPage";

/**
 * SUPERADMIN NAZORATI (vpKijXce) — `/investor/:investorId`: investor kabineti (ko'rsatkichlar faqat o'qish uchun; ega
 * 2026-11-28 dan «Ulush shartlari» kartasida ulush, foyda asosi va investorlik sanasini o'zgartirish mumkin) (`GET
 * investors/:id/dashboard`). Kirish ilgari Ops → «Investorlar» ro'yxatidagi «Kabinetni ko'rish» edi — tab LIuf0DcD da
 * olib tashlandi (ega 2026-11-18), hozir faqat URL orqali; «← Investorlar» — «Foydalanuvchilar → Investorlar». `key`:
 * boshqa investor ochilganda oyna va eski javob oldingisidan qolmaydi.
 */
const InvestorControlPage = () => {
  const { investorId = "" } = useParams();
  return <InvestorDashboardPage key={investorId} investorId={investorId} />;
};

export default InvestorControlPage;
