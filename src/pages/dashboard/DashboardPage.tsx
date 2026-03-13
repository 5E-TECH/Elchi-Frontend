import { memo } from 'react';
import HeaderName from '../../shared/components/headerName';
import { LayoutDashboard } from 'lucide-react';
import DashboardStatistics from '../../widgets/dashboard-statistics/ui/DashboardStatistics';
import FinancialAnalysis from '../../widgets/financial-analysis/ui/FinancialAnalysis';

const DashboardPage = () => {
  return (
    <div className='dark:bg-maindark p-6 rounded-2xl'>
      <HeaderName name="Today's Statistics" description='Date Range' icon={<LayoutDashboard/>}/>
      <DashboardStatistics />
      <FinancialAnalysis/>
    </div>
  );
};

export default memo(DashboardPage);