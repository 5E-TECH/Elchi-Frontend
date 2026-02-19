import { createContext, useContext, type ReactNode } from 'react';
import { notification } from 'antd';
import type { NotificationInstance } from 'antd/es/notification/interface';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiRequestOptions<T = unknown> {
    /** Chaqiriladigan request funksiyasi */
    request: () => Promise<T>;
    /** Muvaffaqiyatli bo'lganda ko'rsatiladigan xabar */
    successMessage?: string;
    /** Xatolikda ko'rsatiladigan xabar */
    errorMessage?: string;
    /** Muvaffaqiyatdan keyin chaqiriladigan callback */
    onSuccess?: (data: T) => void;
    /** Xatolikda chaqiriladigan callback */
    onError?: (error: unknown) => void;
}

interface NotificationContextValue {
    /** Universal API request wrapper — avtomatik notification ko'rsatadi */
    apiRequest: <T = unknown>(options: ApiRequestOptions<T>) => Promise<T | undefined>;
    /** To'g'ridan-to'g'ri notification API (zarur bo'lsa) */
    api: NotificationInstance;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const [api, contextHolder] = notification.useNotification();

    /**
     * Universal API request wrapper.
     * Response statusCode ni avtomatik tahlil qiladi va notification ko'rsatadi.
     */
    const apiRequest = async <T = unknown>({
        request,
        successMessage = "Muvaffaqiyatli bajarildi",
        errorMessage,
        onSuccess,
        onError,
    }: ApiRequestOptions<T>): Promise<T | undefined> => {
        try {
            const data = await request();

            api.success({
                message: "Muvaffaqiyatli",
                description: successMessage,
                placement: 'topRight',
                duration: 4,
            });

            onSuccess?.(data);
            return data;
        } catch (error: unknown) {
            // Backend dan kelgan xabarni olish (Axios error structurasi)
            const backendMessage = getBackendErrorMessage(error);

            api.error({
                message: "Xatolik",
                description: errorMessage ?? backendMessage,
                placement: 'topRight',
                duration: 5,
            });

            onError?.(error);
            return undefined;
        }
    };

    return (
        <NotificationContext.Provider value={{ apiRequest, api }}>
            {contextHolder}
            {children}
        </NotificationContext.Provider>
    );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Notification tizimiga murojaat qilish uchun hook.
 * Faqat `<NotificationProvider>` ichida ishlatilishi shart.
 */
export const useAppNotification = (): NotificationContextValue => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useAppNotification must be used within <NotificationProvider>');
    }
    return context;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Axios yoki fetch xatoligidan backend xabarini oladi.
 * Fallback: standart xabar.
 */
function getBackendErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null) {
        const axiosError = error as {
            response?: { data?: { message?: string } };
            message?: string;
        };
        return (
            axiosError.response?.data?.message ??
            axiosError.message ??
            "Serverda xatolik yuz berdi"
        );
    }
    return "Kutilmagan xatolik yuz berdi";
}
