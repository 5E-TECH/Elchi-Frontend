import { useParams } from 'react-router-dom';
import { User } from 'lucide-react';
import { useUser } from '../../../entities/user/api/userApi';
import { UserDetailWidget } from '../../../widgets/user-detail/ui/UserDetailWidget';
import HeaderName from '../../../shared/components/headerName';
import { useTranslation } from 'react-i18next';
import { unwrapUserResponse } from '../../../entities/user/lib/normalizeUser';
import PageContainer from '../../../shared/ui/PageContainer';
import BackButton from '../../../shared/ui/BackButton';

export const UserDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("users");
  const { useGetUserById } = useUser();
  const { data, isLoading, isError, error } = useGetUserById(id || '');
  const user = unwrapUserResponse(data);

  return (
    <PageContainer>
      <div className="mb-4 flex items-start gap-3 sm:mb-6">
        <BackButton className="mt-1 h-10 min-w-10 rounded-xl px-2" label="" />
        <HeaderName
          name={t("userDetailsTitle")}
          description={t("userDetailsDescription")}
          icon={<User />}
        />
      </div>

      {/* Widget */}
      <UserDetailWidget
        user={user}
        isLoading={isLoading}
        isError={isError}
        error={error}
      />
    </PageContainer>
  );
};

export default UserDetailPage;
