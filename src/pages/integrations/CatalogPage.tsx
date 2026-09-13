import { useNavigate } from 'react-router-dom';
import { Button, Card, Tag } from 'antd';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
} from 'lucide-react';
import { CATEGORY_LABEL, ROLE_META } from '../../entities/integrations';
import { CONNECTION_TYPES, type ConnectionTypeMeta } from './connections';
import { PAGE_SUBTITLE, PAGE_TITLE } from './ui';

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
        <Button
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/integrations')}
          title="Ulanishlarga qaytish"
        />
        <div>
          <h1 className={`m-0 ${PAGE_TITLE}`}>Yangi ulanish</h1>
          <p className={`m-0 ${PAGE_SUBTITLE}`}>
            Avval yo'nalishni tanlang — kalit kimdan chiqishi shunga bog'liq.
          </p>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.kind}>
          <header className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/25 text-indigo-700 dark:text-indigo-300">
              {DIRECTION[group.kind].icon}
            </span>
            <div>
              <p className="m-0 text-sm font-extrabold text-gray-800 dark:text-white">
                {DIRECTION[group.kind].label}
              </p>
              <p className="m-0 text-[11px] text-gray-500 dark:text-gray-400">
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
  <Card
    hoverable
    onClick={onPick}
    className="h-full"
    title={
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-bold">{type.label}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
      </div>
    }
  >
    <div className="mb-2 flex flex-wrap gap-1.5">
      <Tag color="blue">{ROLE_META[type.role].label}</Tag>
      <Tag>{CATEGORY_LABEL[type.category]}</Tag>
    </div>

    <p className="m-0 text-sm text-gray-500 dark:text-gray-400">{type.desc}</p>

    {/* "Sizga nima kerak bo'ladi" — ustaga KIRISHDAN OLDIN. Bu eng ko'p
        uchraydigan to'xtash nuqtasi: odam ustaga kirib, "menda bu yo'q" deb
        chiqib ketardi. */}
    <div className="mt-3 border-t border-gray-100 pt-2.5 dark:border-gray-700">
      <p className="m-0 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
        Sizga kerak bo'ladi
      </p>
      <ul className="m-0 list-none space-y-1 p-0">
        {type.prereqs.map((item) => (
          <li
            key={item}
            className="flex items-start gap-1.5 text-[11px] leading-snug text-gray-600 dark:text-gray-300"
          >
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  </Card>
);

export default CatalogPage;
