import { useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
} from 'lucide-react';
import { CATEGORY_LABEL, ROLE_META } from '../../entities/integrations';
import { CONNECTION_TYPES, type ConnectionTypeMeta } from './connections';

/**
 * KATALOG — "qanday tizim ulaymiz?" degan savolga javob.
 *
 * NEGA KERAK. Ilgari "Yangi ulanish" tugmasi bitta forma ochardi va
 * foydalanuvchi o'zi tanlashi kerak edi: bu hamkormi yoki tashqi tizimmi,
 * kalit bizdanmi yoki ulardanmi. Bu savol TEXNIK — operator javobini
 * bilmaydi. Natijada ulanish noto'g'ri jadvalga tushardi.
 *
 * Endi savol boshqacha qo'yiladi: "kim kimga murojaat qiladi?". Har kartada
 * YO'NALISH o'qi bor va "sizga nima kerak bo'ladi" ro'yxati — ya'ni operator
 * ustaga KIRISHDAN OLDIN tayyor emasligini biladi.
 *
 * Kartalar registrdan chiziladi: yangi tur qo'shilsa bu fayl o'zgarmaydi.
 */

/** Yo'nalishni SO'Z bilan ham aytamiz — o'q o'zi yetarli emas. */
const DIRECTION: Record<
  'partner' | 'integration',
  { label: string; detail: string; icon: React.ReactNode }
> = {
  partner: {
    label: 'Ular bizga',
    detail: 'Kalitni BIZ beramiz. Ular buyurtma yuboradi, biz status qaytaramiz.',
    icon: <ArrowDownLeft className="h-4 w-4" />,
  },
  integration: {
    label: 'Biz ularga',
    detail: "Kalit ULARDA. So'rovni biz yuboramiz va javobini o'zimizga moslaymiz.",
    icon: <ArrowUpRight className="h-4 w-4" />,
  },
};

const CatalogPage = () => {
  const navigate = useNavigate();

  /** Yo'nalish bo'yicha guruh — eng muhim farq shu, tur emas. */
  const groups = (['partner', 'integration'] as const).map((kind) => ({
    kind,
    items: CONNECTION_TYPES.filter((t) => t.kind === kind),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/integrations')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--color-border-soft)] text-maindark dark:text-white"
          title="Manzaraga qaytish"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="m-0 text-lg font-extrabold text-maindark dark:text-white">
            Yangi ulanish
          </h1>
          <p className="m-0 mt-0.5 text-xs text-[color:var(--color-text-muted)]">
            Avval yo'nalishni tanlang — kalit kimdan chiqishi shunga bog'liq.
          </p>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.kind}>
          <header className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-main/12 text-main">
              {DIRECTION[group.kind].icon}
            </span>
            <div>
              <p className="m-0 text-sm font-extrabold text-maindark dark:text-white">
                {DIRECTION[group.kind].label}
              </p>
              <p className="m-0 text-[11px] text-[color:var(--color-text-muted)]">
                {DIRECTION[group.kind].detail}
              </p>
            </div>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((type) => (
              <TypeCard
                key={type.key}
                type={type}
                onPick={() => navigate(`/integrations/new/${type.key}`)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

const TypeCard = ({
  type,
  onPick,
}: {
  type: ConnectionTypeMeta;
  onPick: () => void;
}) => (
  <button
    type="button"
    onClick={onPick}
    className="flex h-full flex-col rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4 text-left transition hover:border-main/50 hover:shadow-sm dark:bg-primarydark"
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="m-0 text-sm font-extrabold text-maindark dark:text-white">
          {type.label}
        </p>
        <p className="m-0 mt-0.5 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
          <span>{ROLE_META[type.role].label}</span>
          <span>·</span>
          <span>{CATEGORY_LABEL[type.category]}</span>
        </p>
      </div>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-text-muted)]" />
    </div>

    <p className="m-0 mt-2 text-xs text-[color:var(--color-text-muted)]">
      {type.desc}
    </p>

    {/* "Sizga nima kerak bo'ladi" — ustaga kirishdan OLDIN. */}
    <div className="mt-3 border-t border-[color:var(--color-border-soft)] pt-2.5">
      <p className="m-0 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
        Sizga kerak bo'ladi
      </p>
      <ul className="m-0 list-none space-y-1 p-0">
        {type.prereqs.map((item) => (
          <li
            key={item}
            className="flex items-start gap-1.5 text-[11px] leading-snug text-maindark/80 dark:text-primary/80"
          >
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-main" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  </button>
);

export default CatalogPage;
