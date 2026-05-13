import { memo } from 'react';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../../entities/user/api/userApi';
import { unwrapUserResponse } from '../../../entities/user/lib/normalizeUser';
import HeaderName from '../../../shared/components/headerName';
import { UserDetailWidget } from '../../../widgets/user-detail/ui/UserDetailWidget';
import PageContainer from '../../../shared/ui/PageContainer';

const ProfilePage = () => {
  const { t } = useTranslation("users");
  const { getMyProfile } = useUser();
  const { data, isLoading, isError, error } = getMyProfile();
  const user = unwrapUserResponse(data);

  return (
    <PageContainer>
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
    </PageContainer>
  );
};

export default memo(ProfilePage);
