import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import {
    isNetworkFailure,
    markNetworkDown,
    NETWORK_ERROR_EVENT,
    NETWORK_RESTORED_EVENT,
    type NetworkDownKind,
    type NetworkErrorDetail,
    type NetworkRestoredDetail,
} from '../../../auth/networkError';
import { getBackendErrorMessage } from '../../../shared/lib/backendError';
import { QUERY_ERROR_EVENT, type QueryErrorDetail } from '../../../shared/lib/queryErrorEvents';
import { notify } from '../../../shared/lib/notify';
import { getErrorKind } from '../../../shared/lib/errorKind';

/** Tarmoq holati xabari (bitta, barqaror `id`). */
export const NETWORK_TOAST_ID = 'network-error';
/** «Aloqa tiklandi» (taxta `tizim-feedback` §04 — 3 s da yopiladi). */
export const NETWORK_RESTORED_TOAST_ID = 'network-restored';
export const NETWORK_RESTORED_DURATION_MS = 3000;
/** Bir xil sababli tarmoq xabari shu oraliqda qayta chiqmaydi (§01 dedupe). */
const NETWORK_TOAST_THROTTLE_MS = 4000;

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
    const lastNetworkToastRef = useRef<{ kind: NetworkDownKind | null; at: number }>({ kind: null, at: 0 });

    /**
     * TARMOQ HOLATI (G6F68ti6, 1/3/8-bandlar; taxta `tizim-feedback` §04, `tizim-errors` 03):
     *  - javob kelmadi → «Internet aloqasi yo'q», vaqt tugadi (20 s, internet bor) → «Server javob bermadi» —
     *    bitta `id`; bir xil sabab 4 s ichida qayta chiqmaydi, boshqa sabab o'sha xabarni yangilaydi;
     *  - aloqa holat: «Internet aloqasi yo'q» foydalanuvchi yopguncha emas, aloqa qaytguncha turadi («Qayta urinish»
     *    uni yopmaydi) va uzilishdan keyingi birinchi javobda o'zi yopiladi + «Aloqa tiklandi» (3 s);
     *  - «Server javob bermadi» fon javobidan yopilmaydi — yiqilgan amalning yagona xabari bo'lishi mumkin;
     *  - tiklanganda javobsiz yiqilgan faol so'rovlar «Qayta urinish»siz o'zi qayta so'raladi;
     *  - brauzer oflayn bo'lishi bilan (so'rov bo'lmasa ham) xabar darhol chiqadi; `online` da faol so'rovlar
     *    qayta yuboriladi, «tiklandi» esa faqat haqiqiy javobdan (captive portal — `auth/networkError.ts`).
     */
    useEffect(() => {
        const showNetworkToast = (kind: NetworkDownKind) => {
            const now = Date.now();
            const last = lastNetworkToastRef.current;
            if (last.kind === kind && now - last.at < NETWORK_TOAST_THROTTLE_MS) {
                return;
            }

            lastNetworkToastRef.current = { kind, at: now };
            notify.dismiss(NETWORK_RESTORED_TOAST_ID);
            const timedOut = kind === 'timeout';
            notify.error(timedOut ? t('toast.timeoutTitle', { ns: 'ui' }) : t('states.error.offline.title', { ns: 'ui' }), {
                id: NETWORK_TOAST_ID,
                description: timedOut
                    ? t('states.error.generic.descriptionNoStatus', { ns: 'ui' })
                    : t('states.error.offline.description', { ns: 'ui' }),
                // ⚠️ `window.location.reload()` EMAS: internet hali qaytmagan bo'lsa
                // to'liq qayta yuklash sessiyani xavf ostiga qo'yardi (9w5Fq94s).
                action: {
                    label: t('retry'),
                    onClick: () => void queryClient.refetchQueries({ type: 'active' }),
                    keepOpen: !timedOut,
                },
            });
        };

        const handleNetworkError = (event: Event) => {
            const detail = (event as CustomEvent<Partial<NetworkErrorDetail> | null>).detail;
            // Eski shakl (`kind` siz) — kod bo'yicha.
            const kind: NetworkDownKind =
                detail?.kind ?? (getErrorKind({ code: detail?.code }) === 'timeout' ? 'timeout' : 'offline');
            showNetworkToast(kind);
        };

        const handleNetworkRestored = (event: Event) => {
            const { kind } = (event as CustomEvent<NetworkRestoredDetail>).detail;
            lastNetworkToastRef.current = { kind: null, at: 0 };
            void queryClient.refetchQueries({
                type: 'active',
                predicate: (query) => query.state.status === 'error' && isNetworkFailure(query.state.error),
            });
            if (kind !== 'offline') {
                return;
            }

            notify.dismiss(NETWORK_TOAST_ID);
            notify.success(t('toast.restoredTitle', { ns: 'ui' }), {
                id: NETWORK_RESTORED_TOAST_ID,
                description: t('toast.restoredDescription', { ns: 'ui' }),
                duration: NETWORK_RESTORED_DURATION_MS,
            });
        };

        const unsubscribeOnline = onlineManager.subscribe((online) => {
            if (!online) {
                markNetworkDown('offline');
                showNetworkToast('offline');
                return;
            }
            // `refetchOnReconnect` 30 s `staleTime` ichidagilarni so'ramaydi — ochiq sahifa to'liq yangilansin.
            void queryClient.refetchQueries({ type: 'active' });
        });

        window.addEventListener(NETWORK_ERROR_EVENT, handleNetworkError);
        window.addEventListener(NETWORK_RESTORED_EVENT, handleNetworkRestored);
        return () => {
            unsubscribeOnline();
            window.removeEventListener(NETWORK_ERROR_EVENT, handleNetworkError);
            window.removeEventListener(NETWORK_RESTORED_EVENT, handleNetworkRestored);
        };
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
            // Javobsiz xato (G6F68ti6, 4-band): interceptor bitta «Internet aloqasi yo'q» / «Server javob bermadi»
            // xabarini ko'rsatgan — ikkinchi «Xatolik» chiqmaydi.
            if (!isNetworkFailure(error)) {
                notify.error(t('error'), {
                    description: getBackendErrorMessage(error) ?? errorMessage ?? t('serverRequestError'),
                });
            }

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
