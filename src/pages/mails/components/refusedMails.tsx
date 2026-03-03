import { memo } from 'react';
import { useMails } from '../../../entities/mails';

const RefusedMails = () => {
  const {getRefusedMails} = useMails()
  const data = getRefusedMails()
  console.log(data?.data?.data);

  
  return (
    <div>
      <h2>RefusedMails</h2>
    </div>
  );
};

export default memo(RefusedMails);