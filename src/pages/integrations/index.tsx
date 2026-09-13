import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Tabs } from 'antd';
import { Cable, LayoutGrid } from 'lucide-react';

/**
 * INTEGRATSIYALAR UYI — PCS (BeePost) `IntegrationsRoot` shakli.
 *
 * PCS'da ildiz shunchaki antd `Tabs size="large"`: alohida sahifa sarlavhasi
 * YO'Q, har bir tabning mazmuni o'z sarlavhasini olib yuradi. Biz ham
 * shunday qildik — aks holda ikki sarlavha ustma-ust tushardi (uyning
 * sarlavhasi + kartalar sahifasining sarlavhasi).
 *
 * IKKI YUZA:
 *   Ulanishlar — "hammasi qalay?" → kartalar to'ri
 *   Boshqaruv  — "bu ulanish qalay?" → panellar
 *
 * ⚠️ ESKI SAHIFALAR NAVIGATSIYADAN OLINDI, MARSHRUTLAR QOLDI.
 * Ular ko'chirish davrida zaxira bo'lib turgan edi; yangi yuza to'liq
 * ishlaydi (katalog + usta + 4 panel), shu bois menyuda turishi shovqin.
 * `/integrations/partners` va `/integrations/sources` marshrutlari ishlashda
 * davom etadi — xatcho'p va tashqi havolalar buzilmaydi.
 *
 * ⚠️ Tab HOLATI URL'dan keladi, ichki state'dan emas: sahifani yangilash
 * yoki havola yuborish tanlangan yuzani yo'qotmasligi kerak.
 */

const SURFACES = [
  {
    key: 'overview',
    path: '/integrations',
    label: 'Ulanishlar',
    icon: <LayoutGrid className="h-4 w-4" />,
  },
  {
    key: 'console',
    path: '/integrations/connections',
    label: 'Boshqaruv',
    icon: <Cable className="h-4 w-4" />,
  },
] as const;

const IntegrationsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * Faol yuza. `connections` dan boshqa hamma yo'l (eski sahifalar ham)
   * "Ulanishlar" deb hisoblanadi — tab hech qachon bo'sh qolmasligi kerak.
   */
  const active = useMemo(
    () =>
      location.pathname.startsWith('/integrations/connections')
        ? 'console'
        : 'overview',
    [location.pathname],
  );

  return (
    <div>
      {/*
        ⚠️ `Tabs` faqat NAVIGATSIYA — panel mazmuni unga berilmaydi.
        Har tabga `<Outlet/>` bersak, antd nofaol panelni birinchi
        ko'rsatishdan keyin MOUNT QILIB QOLDIRADI
        (`destroyInactiveTabPane` sukut bo'yicha `false`) — natijada ayni
        marshrut ikki marta chizilib, so'rovlar ham ikki marta ketardi.
        Shu bois `Outlet` tablardan TASHQARIDA, bir marta.
      */}
      <Tabs
        size="large"
        activeKey={active}
        onChange={(key) => {
          const surface = SURFACES.find((s) => s.key === key);
          if (surface) navigate(surface.path);
        }}
        items={SURFACES.map((s) => ({
          key: s.key,
          label: (
            <span className="flex items-center gap-2">
              {s.icon}
              {s.label}
            </span>
          ),
        }))}
      />
      <Outlet />
    </div>
  );
};

export default IntegrationsPage;
