import { Button } from 'antd';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { notification } from 'antd';
import type { NotificationInstance } from 'antd/es/notification/interface';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { getBackendErrorMessage } from '../../../shared/lib/backendError';
import { QUERY_ERROR_EVENT, type QueryErrorDetail } from '../../../shared/lib/queryErrorEvents';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiRequestOptions<T = unknown> {
    /** Chaqiriladigan request funksiyasi */
    request: () => Promise<T>;
    /**
     * Muvaffaqiyatli bo'lganda ko'rsatiladigan xabar. Funksiya bo'lsa — javobdan
     * quriladi (masalan backend haqiqatda bajargan son, tanlanganlar soni emas).
     */
    successMessage?: string | ((data: T) => string);
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
    const queryClient = useQueryClient();
    const { t } = useTranslation('common');
    const lastNetworkToastAtRef = useRef(0);

    useEffect(() => {
        const handleNetworkError = () => {
            const now = Date.now();
            if (now - lastNetworkToastAtRef.current < 4000) {
                return;
            }

            lastNetworkToastAtRef.current = now;
            api.error({
                message: t('networkError'),
                description: t('networkCheckConnection'),
                placement: "bottomRight",
                duration: 8,
                btn: (
                    // ⚠️ `window.location.reload()` EMAS: internet hali qaytmagan bo'lsa
                    // to'liq qayta yuklash sessiyani xavf ostiga qo'yardi (9w5Fq94s).
                    <Button size="small" danger onClick={() => void queryClient.refetchQueries({ type: "active" })}>
                        {t('retry')}
                    </Button>
                ),
            });
        };

        window.addEventListener("elchi:network-error", handleNetworkError);
        return () => window.removeEventListener("elchi:network-error", handleNetworkError);
    }, [api, queryClient, t]);

    const lastQueryErrorRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
    useEffect(() => {
        const handleQueryError = (event: Event) => {
            const { status, message } = (event as CustomEvent<QueryErrorDetail>).detail;
            const description =
                status === 403 ? t('queryErrorForbidden') : status >= 500 ? t('queryErrorServer', { status }) : message ?? t('queryErrorGeneric', { status });
            // Bir sahifadagi bir nechta so'rov bir xil sabab bilan yiqilsa — bitta bildirishnoma.
            const key = `${status}:${description}`;
            const now = Date.now();
            if (lastQueryErrorRef.current.key === key && now - lastQueryErrorRef.current.at < 4000) return;
            lastQueryErrorRef.current = { key, at: now };
            api.error({ message: t('queryErrorTitle'), description, placement: "bottomRight", duration: 8 });
        };
        window.addEventListener(QUERY_ERROR_EVENT, handleQueryError);
        return () => window.removeEventListener(QUERY_ERROR_EVENT, handleQueryError);
    }, [api, t]);

    /**
     * Universal API request wrapper.
     * Response statusCode ni avtomatik tahlil qiladi va notification ko'rsatadi.
     */
    const apiRequest = async <T = unknown>({
        request,
        successMessage = t('operationCompleted'),
        errorMessage,
        onSuccess,
        onError,
    }: ApiRequestOptions<T>): Promise<T | undefined> => {
        try {
            const data = await request();

            let description: string;
            try {
                description = typeof successMessage === 'function' ? successMessage(data) : successMessage;
            } catch {
                // So'rov bajarilgan — xabar quruvchining xatosi uni "xato" qilib
                // ko'rsatmasin (foydalanuvchi bajarilgan amalni qaytarmasin).
                description = t('operationCompleted');
            }

            api.success({
                message: t('success'),
                description,
                placement: 'topRight',
                duration: 4,
            });

            onSuccess?.(data);
            return data;
        } catch (error: unknown) {
            const backendMessage = getBackendErrorMessage(error);

            api.error({
                message: t('error'),
                description:
                    backendMessage ??
                    errorMessage ??
                    t('serverRequestError'),
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
