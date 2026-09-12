import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  Package,
  RefreshCw,
} from "lucide-react";
import type { RootState } from "../../app/config/store";
import {
  sourceLabel,
  useIncomingSources,
  type IncomingSource,
} from "../../entities/incoming-orders";
import { waitingFor } from "./lib";

/**
 * QAYSI MANBADAN QABUL QILAMIZ?
 *
 * NEGA KERAK BO'LDI. Bu ekran ilgari to'g'ridan-to'g'ri skanerlash ro'yxatini
 * ochardi va unda BARCHA tashqi buyurtma aralash turardi. Amalda faqat bitta
 * hamkor (BeePost) yuborgani uchun bu sezilmasdi. Ikkinchi manba qo'shilishi
 * bilan muammo ochiladi: operator qo'lida BeePost qopi turadi, ro'yxatda esa
 * Uzum posilkasi ham ko'rinadi — qaysi biri qo'lida borligini faqat
 * skanerlab bilib olardi va "topilmadi" xabari nimani bildirishi
 * tushunarsiz bo'lardi.
 *
 * Endi: manba tanlanadi → o'sha manbaning posilkalari skanerlanadi.
 *
 * ⚠️ RO'YXAT BUYURTMALARDAN CHIQADI, ulanishlar sozlamasidan emas. Ya'ni
 * posilkasi yo'q manba ko'rinmaydi (bo'sh ekranga olib boradigan karta
 * bo'lardi), va ulanishi o'chirilgan manbaning kutayotgan posilkasi
 * YASHIRILMAYDI — u haqiqatan omborda turgan bo'lishi mumkin.
 */

/** Backend guardi bilan BIR XIL — MARKET bu yerda YO'Q (u qabul qilmaydi). */
const ALLOWED_ROLES = new Set([
  "superadmin",
  "admin",
  "registrator",
  "manager",
]);

const money = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`;

const SourcePicker = () => {
  const navigate = useNavigate();
  const role = useSelector((state: RootState) => state.role.role);
  const allowed = Boolean(role && ALLOWED_ROLES.has(role));

  const query = useIncomingSources();
  const sources = query.data ?? [];
  const totalParcels = sources.reduce((sum, s) => sum + s.orders_count, 0);

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-8 text-center dark:bg-primarydark">
        <AlertTriangle className="mx-auto text-amber-500" size={32} />
        <p className="m-0 mt-4 text-sm font-semibold text-maindark dark:text-white">
          Bu bo'limga ruxsatingiz yo'q
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4 shadow-sm sm:rounded-[28px] sm:p-6 dark:bg-primarydark">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-main/10 text-main dark:text-primary">
              <Inbox size={22} />
            </div>
            <div>
              <h1 className="m-0 text-lg font-extrabold text-maindark dark:text-white">
                Kiruvchi posilkalar
              </h1>
              <p className="m-0 mt-1 text-xs text-[color:var(--color-text-muted)]">
                Qaysi manbadan qabul qilamiz? Manbani tanlang, so'ng
                posilkalarni skanerlang.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
                Kutilmoqda
              </p>
              <p className="m-0 text-xl font-extrabold tabular-nums text-maindark dark:text-white">
                {totalParcels}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] text-maindark transition hover:bg-main/5 disabled:opacity-50 dark:text-white"
              title="Yangilash"
            >
              <RefreshCw
                size={18}
                className={query.isFetching ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex min-h-[220px] items-center justify-center">
          <Loader2 className="animate-spin text-main" size={28} />
        </div>
      ) : query.isError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm font-semibold text-red-700 dark:text-red-300">
          Manbalar ro'yxatini olib bo'lmadi.
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="ml-2 underline underline-offset-2"
          >
            Qayta urinish
          </button>
        </div>
      ) : sources.length === 0 ? (
        /*
          Bo'sh holat O'RGATADI. "Manba yo'q" deb qoldirish operatorni
          "tizim buzilganmi?" degan savol bilan qoldirardi.
        */
        <div className="rounded-2xl border border-dashed border-[color:var(--color-border-soft)] p-8 text-center">
          <Inbox
            size={32}
            className="mx-auto text-[color:var(--color-text-muted)]"
          />
          <p className="m-0 mt-3 text-sm font-bold text-maindark dark:text-white">
            Qabul kutayotgan posilka yo'q
          </p>
          <p className="m-0 mt-1.5 text-xs leading-relaxed text-[color:var(--color-text-muted)]">
            Tashqi tizim posilka yuborganda u shu yerda manbasi bilan
            ko'rinadi. Manba ulanmagan bo'lsa — Integratsiyalar bo'limida
            ulanish qo'shiladi.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => (
            <SourceCard
              key={source.market_id}
              source={source}
              onPick={() =>
                navigate(`/new-orders/incoming/${source.market_id}`)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

const SourceCard = ({
  source,
  onPick,
}: {
  source: IncomingSource;
  onPick: () => void;
}) => {
  const waiting = waitingFor(source.oldest_at);

  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4 text-left transition hover:border-main/50 hover:shadow-sm dark:bg-primarydark"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-main/10 text-main">
        <Package size={20} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-maindark dark:text-white">
          {sourceLabel(source)}
        </span>
        <span className="mt-0.5 block text-xs text-[color:var(--color-text-muted)]">
          {source.orders_count} posilka · {money(source.total_price_sum)}
        </span>
        {/* Uzoq kutgan posilka alohida belgilanadi. */}
        <span
          className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${
            waiting.stale
              ? "text-amber-600 dark:text-amber-300"
              : "text-[color:var(--color-text-muted)]"
          }`}
        >
          <Clock size={11} />
          {waiting.text}
          {waiting.stale ? " kutmoqda" : ""}
        </span>
      </span>

      <ChevronRight
        size={18}
        className="shrink-0 text-[color:var(--color-text-muted)]"
      />
    </button>
  );
};

export default memo(SourcePicker);
