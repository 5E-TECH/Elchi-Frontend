import { Alert, Button, Card, Switch, Tag, Tooltip, message } from 'antd';
import {
  Activity,
  Info,
  PlugZap,
  PowerOff,
  RotateCw,
  Send,
} from 'lucide-react';
import { usePartnerActions } from '../../../entities/partners';
import { useUpdateIntegration } from '../../../entities/integrations';
import { useIntegrationHealthcheck } from '../../../entities/integrations/healthcheck';
import {
  useProcessQueue,
  useRetryFailed,
} from '../../../entities/integrations/shipments';
import { getBackendErrorMessage } from '../../../shared/lib/backendError';
import type { Connection } from '../useConnections';

/**
 * BOSHQARUV — kalitlar va qo'lda ishga tushirish.
 *
 * Shakl PCS `ElchiControlTab` dan: master kalit rangli chegarali kartada,
 * ostida jarayonlarni qo'lda yurgizish, oxirida qizil "to'xtatish" ogohi.
 *
 * NEGA KERAK BO'LDI. Bu amallar backendda bor edi, lekin UI'da HECH
 * QAYERDA yo'q: navbatni qo'lda yurgizish, yiqilganlarni qayta urinish,
 * aloqani tekshirish. Ya'ni CRON kechikkanda yoki tashqi tizim tuzalganda
 * operator kutishdan boshqa hech nima qila olmasdi.
 *
 * ⚠️ KALIT IKKI JOYDA KO'RINADI (bu yerda va Xavfsizlikda) — lekin YOZUV
 * bitta joyda: ikkisi ham ayni `setActive`/`PATCH` ni chaqiradi. Ataylab
 * takrorlangan, chunki "to'xtatish" ni ikki xil savol bilan izlashadi:
 * "xavfsizlik" va "boshqaruv".
 */

const ConnectionControl = ({
  connection,
  onChanged,
}: {
  connection: Connection;
  onChanged: () => void;
}) => {
  const { setActive } = usePartnerActions();
  const updateIntegration = useUpdateIntegration();
  const healthcheck = useIntegrationHealthcheck();
  const processQueue = useProcessQueue();
  const retryFailed = useRetryFailed();

  const isPartner = connection.kind === 'partner';
  const raw = connection.raw as Record<string, unknown>;

  const setMaster = async (next: boolean) => {
    try {
      if (isPartner) {
        await setActive.mutateAsync({ id: connection.id, is_active: next });
      } else {
        await updateIntegration.mutateAsync({
          id: connection.id,
          payload: {
            slug: String(raw.slug ?? ''),
            type: String(raw.type ?? 'api'),
            is_active: next,
          } as never,
        });
      }
      message.success(next ? 'Yoqildi' : "O'chirildi");
      onChanged();
    } catch (error) {
      message.error(
        getBackendErrorMessage(error) || "Holatni o'zgartirib bo'lmadi",
      );
    }
  };

  /** Amalni ishga tushirib, natijasini bir xil shaklda xabar qiladi. */
  const run = async (
    label: string,
    fn: () => Promise<unknown>,
  ): Promise<void> => {
    try {
      await fn();
      message.success(`${label} — bajarildi`);
    } catch (error) {
      message.error(getBackendErrorMessage(error) || `${label} — xatolik`);
    }
  };

  const togglePending = setActive.isPending || updateIntegration.isPending;

  return (
    <div className="space-y-4">
      {/* ═══════ MASTER KALIT ═══════ */}
      <Card
        className={
          connection.is_active
            ? 'border-green-200 dark:border-green-800'
            : 'border-red-200 dark:border-red-800'
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="m-0 flex items-center gap-2 text-base font-semibold">
              <Activity className="h-4 w-4" /> MASTER kalit
              <Tag color={connection.is_active ? 'green' : 'red'}>
                {connection.is_active ? 'FAOL' : "O'CHIQ"}
              </Tag>
            </h3>
            <p className="m-0 mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              {isPartner
                ? "O'chirilsa hamkorning so'rovlari rad etiladi va status hodisalari yuborilmaydi."
                : "O'chirilsa bu tizimga hech qanday so'rov yuborilmaydi — navbat to'planib turadi."}
            </p>
          </div>
          <Switch
            checked={connection.is_active}
            loading={togglePending}
            onChange={setMaster}
            checkedChildren="Faol"
            unCheckedChildren="O'chiq"
          />
        </div>
      </Card>

      {/* ═══════ QO'LDA ISHGA TUSHIRISH ═══════ */}
      <Card title="Qo'lda ishga tushirish">
        <div className="flex flex-wrap gap-2">
          {isPartner ? (
            /*
              Hamkorda jarayon YO'Q: hodisalar outbox orqali o'zi ketadi va
              har birini alohida "Hodisalar" bo'limidan qayta urinish mumkin.
              Soxta tugma qo'yishdan ko'ra shuni aytish to'g'ri.
            */
            <Alert
              className="w-full"
              type="info"
              showIcon
              message="Bu ulanishda qo'lda yurgiziladigan jarayon yo'q"
              description="Hodisalar navbat orqali o'zi yuboriladi. Bitta hodisani qayta urinish uchun 'Hodisalar' bo'limidagi 'Qayta' tugmasi ishlatiladi."
            />
          ) : (
            <>
              <Tooltip title="Navbatdagi status o'zgarishlarini HOZIROQ tashqi tizimga yuboradi (CRON'ni kutmasdan)">
                <Button
                  icon={<Send className="h-4 w-4" />}
                  loading={processQueue.isPending}
                  onClick={() =>
                    void run('Navbatni yuborish', () =>
                      processQueue.mutateAsync(connection.id),
                    )
                  }
                >
                  Navbatni hoziroq yuborish
                </Button>
              </Tooltip>

              <Tooltip title="Yiqilgan navbat qatorlarini qayta urinishga qo'yadi">
                <Button
                  icon={<RotateCw className="h-4 w-4" />}
                  loading={retryFailed.isPending}
                  onClick={() =>
                    void run('Yiqilganlarni qayta urinish', () =>
                      retryFailed.mutateAsync(connection.id),
                    )
                  }
                >
                  Yiqilganlarni qayta urinish
                </Button>
              </Tooltip>

              <Tooltip title="Tashqi tizim manziliga sinov so'rovi yuboradi">
                <Button
                  icon={<PlugZap className="h-4 w-4" />}
                  loading={healthcheck.isPending}
                  onClick={() =>
                    void run('Aloqani tekshirish', async () => {
                      const res = await healthcheck.mutateAsync(connection.id);
                      // ⚠️ Backend yiqilganda HTTP xato BERMAYDI — natijani
                      // `ok` bo'yicha o'qish kerak, aks holda "bajarildi"
                      // deb yolg'on xabar chiqardi.
                      if (!res.ok) {
                        throw new Error(
                          res.message ?? `HTTP ${res.status ?? '—'}`,
                        );
                      }
                    })
                  }
                >
                  Aloqani tekshirish
                </Button>
              </Tooltip>
            </>
          )}
        </div>

        {!isPartner && (
          <p className="m-0 mt-3 flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            "Navbatni yuborish" tashqi tizimdan buyurtma <b>tortib olmaydi</b> —
            u faqat bizdagi status o'zgarishlarini ularga yuboradi. Backendda
            bu amal `sync` deb atalgan va nomi chalg'itadi.
          </p>
        )}
      </Card>

      {/* ═══════ TO'XTATISH ═══════ */}
      {connection.is_active && (
        <Alert
          type="error"
          showIcon
          message="Ulanishni butunlay to'xtatish"
          description="Master kalitni o'chiradi. Ma'lumot o'chirilmaydi — sozlama, posilka bog'lanishi va pul izi saqlanadi."
          action={
            <Button
              danger
              icon={<PowerOff className="h-4 w-4" />}
              loading={togglePending}
              onClick={() => void setMaster(false)}
            >
              To'xtatish
            </Button>
          }
        />
      )}
    </div>
  );
};

export default ConnectionControl;
