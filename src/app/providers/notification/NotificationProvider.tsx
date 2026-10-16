import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { getBackendErrorMessage } from '../../../shared/lib/backendError';
import { QUERY_ERROR_EVENT, type QueryErrorDetail } from '../../../shared/lib/queryErrorEvents';
import { notify } from '../../../shared/lib/notify';
import { getErrorKind } from '../../../shared/lib/errorKind';

/**
 * Ilova darajasidagi xabarlar (dizayn v2, 3-bosqich): tarmoq va so'rov xatolari hamda `apiRequest`
 * natijasi — hammasi `notify()` orqali (`<Toaster />`, `app/providers/UiHost.tsx`). antd `notification`
 * ishlatilmaydi. Komponent ichidagi oddiy xabar uchun to'g'ridan-to'g'ri `notify.*` dan foydalaning.
 */

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
    /** Universal API request wrapper — avtomatik xabar (`notify`) ko'rsatadi */
    apiRequest: <T = unknown>(options: ApiRequestOptions<T>) => Promise<T | undefined>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const queryClient = useQueryClient();
    const { t } = useTranslation('common');
    const lastNetworkToastAtRef = useRef(0);

    useEffect(() => {
        const handleNetworkError = (event: Event) => {
            const now = Date.now();
            if (now - lastNetworkToastAtRef.current < 4000) {
                return;
            }

            lastNetworkToastAtRef.current = now;
            // Matn — taxta `tizim-errors` 03: javob kelmadi → «Internet aloqasi yo'q» (barcha sahifalarda shu nom);
            // vaqt tugadi (20 s, internet bor) → «Server javob bermadi» — foydalanuvchiga internetni tekshir demaymiz.
            const code = (event as CustomEvent<{ code?: string } | null>).detail?.code;
            const timedOut = getErrorKind({ code }) === 'timeout';
            // Barqaror `id`: takroriy tarmoq xatosi bitta xabarga qo'shiladi (yangisi qo'shilmaydi).
            notify.error(timedOut ? t('toast.timeoutTitle', { ns: 'ui' }) : t('states.error.offline.title', { ns: 'ui' }), {
                id: 'network-error',
                description: timedOut
                    ? t('states.error.generic.descriptionNoStatus', { ns: 'ui' })
                    : t('states.error.offline.description', { ns: 'ui' }),
                // ⚠️ `window.location.reload()` EMAS: internet hali qaytmagan bo'lsa
                // to'liq qayta yuklash sessiyani xavf ostiga qo'yardi (9w5Fq94s).
                action: { label: t('retry'), onClick: () => void queryClient.refetchQueries({ type: "active" }) },
            });
        };

        window.addEventListener("elchi:network-error", handleNetworkError);
        return () => window.removeEventListener("elchi:network-error", handleNetworkError);
    }, [queryClient, t]);

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
            notify.error(t('queryErrorTitle'), { description });
        };
        window.addEventListener(QUERY_ERROR_EVENT, handleQueryError);
        return () => window.removeEventListener(QUERY_ERROR_EVENT, handleQueryError);
    }, [t]);

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

            notify.success(t('success'), { description });

            onSuccess?.(data);
            return data;
        } catch (error: unknown) {
            const backendMessage = getBackendErrorMessage(error);

            notify.error(t('error'), {
                description: backendMessage ?? errorMessage ?? t('serverRequestError'),
            });

            onError?.(error);
            return undefined;
        }
    };

    return (
        <NotificationContext.Provider value={{ apiRequest }}>
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
