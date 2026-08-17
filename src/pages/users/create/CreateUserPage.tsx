import { memo } from 'react';
import { UserPlus } from 'lucide-react';
import { CreateUserWidget } from '../../../widgets/user-create/ui/CreateUserWidget';
import HeaderName from '../../../shared/components/headerName';
import { useTranslation } from 'react-i18next';
import BackButton from '../../../shared/ui/BackButton';

const CreateUserPage = memo(() => {
    const { t } = useTranslation("users");

    return (
        <div className="rounded-2xl">
            <div className="flex items-center gap-3 px-3 py-3 sm:px-4 sm:py-4 md:px-5">
                <BackButton className="h-10 min-w-10 shrink-0 rounded-xl px-2" label="" />
                <HeaderName
                    name={t("createNewUser")}
                    icon={<UserPlus />}
                    description={t("createNewUserDescription")}
                />
            </div>

            <CreateUserWidget />
        </div>
    );
});

export default CreateUserPage;
