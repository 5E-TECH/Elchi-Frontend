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
        <div className="rounded-2xl">
            <div
                role="button"
                tabIndex={0}
                aria-label={t("back", { defaultValue: "Orqaga" })}
                className="cursor-pointer rounded-2xl px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-main sm:px-4 sm:py-4 md:px-5"
                onClick={() => navigate(-1)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(-1);
                    }
                }}
            >
                <HeaderName
                    name={t("createNewUser")}
                    icon={<ArrowLeft />}
                    description={t("createNewUserDescription")}
                />
            </div>

            <CreateUserWidget />
        </div>
    );
});

export default CreateUserPage;
