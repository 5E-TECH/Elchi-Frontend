import { memo } from 'react';
import HeaderName from '../../shared/components/headerName';
import { LocateFixed } from 'lucide-react';

const Region = () => {
  return (
    <div>
      <HeaderName name='Viloyat Statistikalari' description="Viloyat ustiga bosib batafsil ma'lumotlarni ko'ring" icon={<LocateFixed/>}/>
    </div>
  );
};

export default memo(Region);