import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CreateUserWidget } from '../../../widgets/user-create/ui/CreateUserWidget';

const CreateUserPage = memo(() => {
    const navigate = useNavigate();

    return (
        <div className="">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors group"
            >
                <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                    <ArrowLeft size={20} />
                </div>
                <span className="font-medium">Ortga qaytish</span>
            </button>

            <CreateUserWidget />
        </div>
    );
});

export default CreateUserPage;
