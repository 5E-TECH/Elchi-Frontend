import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CreateUserWidget } from '../../../widgets/user-create/ui/CreateUserWidget';
import HeaderName from '../../../shared/components/headerName';
import { useTranslation } from 'react-i18next';

const CreateUserPage = memo(() => {
    const navigate = useNavigate();
    const { t } = useTranslation("users");

    return (
        <div className="bg-sidebar rounded-2xl dark:bg-maindark">
            <div className='p-5' onClick={() => navigate(-1)}>
                <HeaderName name={t("createNewUser")} icon={<ArrowLeft/>} description={t("createNewUserDescription")} />
            </div>

            <CreateUserWidget />
        </div>
    );
});

export default CreateUserPage;
