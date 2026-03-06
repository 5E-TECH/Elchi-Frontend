import { memo } from 'react';
import UserDetailPage from '../../users/detail/UserDetailPage';

const ProfilePage = () => {
  return (
    <div>
      <UserDetailPage />
    </div>
  );
};

export default memo(ProfilePage);