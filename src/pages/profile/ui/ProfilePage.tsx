import { memo } from 'react';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../../entities/user/api/userApi';
import { unwrapUserResponse } from '../../../entities/user/lib/normalizeUser';
import HeaderName from '../../../shared/components/headerName';
import { UserDetailWidget } from '../../../widgets/user-detail/ui/UserDetailWidget';

const ProfilePage = () => {
  const { t } = useTranslation("users");
  const { getMyProfile } = useUser();
  const { data, isLoading, isError, error } = getMyProfile();
  const user = unwrapUserResponse(data);

  return (
    <div className="p-6 bg-sidebar dark:bg-maindark min-h-full rounded-2xl">
      <div className="mb-6">
        <HeaderName
          name={t("profile")}
          description={t("profileDescription")}
          icon={<User />}
        />
      </div>

      <UserDetailWidget
        user={user}
        isLoading={isLoading}
        isError={isError}
        error={error}
        isOwnProfile
      />
    </div>
  );
};

export default memo(ProfilePage);
