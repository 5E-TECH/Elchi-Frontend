import { useNavigate, useParams } from 'react-router-dom';
import { User } from 'lucide-react';
import { useUser } from '../../../entities/user/api/userApi';
import { UserDetailWidget } from '../../../widgets/user-detail/ui/UserDetailWidget';
import HeaderName from '../../../shared/components/headerName';
import { useTranslation } from 'react-i18next';
import { unwrapUserResponse } from '../../../entities/user/lib/normalizeUser';

export const UserDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("users");
  const navigate = useNavigate()
  const { getUserById } = useUser();
  const { data, isLoading, isError, error } = getUserById(id || '');
  const user = unwrapUserResponse(data);

  return (
    <div className="rounded-2xl bg-sidebar p-3 min-h-full dark:bg-maindark sm:p-4 lg:p-6">
      {/* Page Header */}
      <div className="mb-4 sm:mb-6" onClick={() => navigate(-1)}>
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
    </div>
  );
};

export default UserDetailPage;
