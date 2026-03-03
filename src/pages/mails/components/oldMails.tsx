import { memo } from 'react';
import { useMails } from '../../../entities/mails';

const OldMails = () => {

  const {getOldMails} = useMails()
  const data = getOldMails()
  console.log(data?.data?.data);

  return (
    <div>
      <h2>OldMails</h2>
    </div>
  );
};

export default memo(OldMails);