import { Alert, Button, Card, Switch, Tag, Tooltip, message } from "antd";
import { useTranslation } from "react-i18next";
import { Activity, Info, PlugZap, PowerOff, RotateCw, Send } from "lucide-react";
import { usePartnerActions } from "../../../entities/partners";
import { useUpdateIntegration } from "../../../entities/integrations";
import { useIntegrationHealthcheck } from "../../../entities/integrations/healthcheck";
import { useProcessQueue, useRetryFailed } from "../../../entities/integrations/shipments";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import type { Connection } from "../useConnections";

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
  const { t } = useTranslation("integrations");
  const { setActive } = usePartnerActions();
  const updateIntegration = useUpdateIntegration();
  const healthcheck = useIntegrationHealthcheck();
  const processQueue = useProcessQueue();
  const retryFailed = useRetryFailed();

  const isPartner = connection.kind === "partner";
  const raw = connection.raw as Record<string, unknown>;

  const setMaster = async (next: boolean) => {
    try {
      if (isPartner) {
        await setActive.mutateAsync({ id: connection.id, is_active: next });
      } else {
        await updateIntegration.mutateAsync({
          id: connection.id,
          payload: {
            slug: String(raw.slug ?? ""),
            type: String(raw.type ?? "api"),
            is_active: next,
          } as never,
        });
      }
      message.success(next ? t("ctlEnabled") : t("ctlDisabled"));
      onChanged();
    } catch (error) {
      message.error(getBackendErrorMessage(error) || t("toggleFailed"));
    }
  };

  /** Amalni ishga tushirib, natijasini bir xil shaklda xabar qiladi. */
  const run = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn();
      message.success(t("ctlDone", { label }));
    } catch (error) {
      message.error(getBackendErrorMessage(error) || t("ctlFailed", { label }));
    }
  };

  const togglePending = setActive.isPending || updateIntegration.isPending;

  return (
    <div className="space-y-4">
      {/* ═══════ MASTER KALIT ═══════ */}
      <Card
        className={
          connection.is_active
            ? "border-green-200 dark:border-green-800"
            : "border-red-200 dark:border-red-800"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="m-0 flex items-center gap-2 text-base font-semibold">
              <Activity className="h-4 w-4" /> {t("ctlMasterKey")}
              <Tag color={connection.is_active ? "green" : "red"}>
                {connection.is_active ? t("secTagActive") : t("secTagOff")}
              </Tag>
            </h3>
            <p className="m-0 mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              {isPartner ? t("ctlMasterPartner") : t("ctlMasterOutbound")}
            </p>
          </div>
          <Switch
            checked={connection.is_active}
            loading={togglePending}
            onChange={setMaster}
            checkedChildren={t("ctlSwitchOn")}
            unCheckedChildren={t("ctlSwitchOff")}
          />
        </div>
      </Card>

      {/* ═══════ QO'LDA ISHGA TUSHIRISH ═══════ */}
      <Card title={t("ctlManualTitle")}>
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
              message={t("ctlNoManual")}
              description={t("ctlNoManualDesc")}
            />
          ) : (
            <>
              <Tooltip title={t("ctlQueueTip")}>
                <Button
                  icon={<Send className="h-4 w-4" />}
                  loading={processQueue.isPending}
                  onClick={() =>
                    void run(t("ctlQueueAction"), () => processQueue.mutateAsync(connection.id))
                  }
                >
                  {t("ctlQueueBtn")}
                </Button>
              </Tooltip>

              <Tooltip title={t("ctlRetryTip")}>
                <Button
                  icon={<RotateCw className="h-4 w-4" />}
                  loading={retryFailed.isPending}
                  onClick={() =>
                    void run(t("ctlRetryBtn"), () => retryFailed.mutateAsync(connection.id))
                  }
                >
                  {t("ctlRetryBtn")}
                </Button>
              </Tooltip>

              <Tooltip title={t("ctlPingTip")}>
                <Button
                  icon={<PlugZap className="h-4 w-4" />}
                  loading={healthcheck.isPending}
                  onClick={() =>
                    void run(t("ctlPingBtn"), async () => {
                      const res = await healthcheck.mutateAsync(connection.id);
                      // ⚠️ Backend yiqilganda HTTP xato BERMAYDI — natijani
                      // `ok` bo'yicha o'qish kerak, aks holda "bajarildi"
                      // deb yolg'on xabar chiqardi.
                      if (!res.ok) {
                        throw new Error(res.message ?? `HTTP ${res.status ?? "—"}`);
                      }
                    })
                  }
                >
                  {t("ctlPingBtn")}
                </Button>
              </Tooltip>
            </>
          )}
        </div>

        {!isPartner && (
          <p className="m-0 mt-3 flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("ctlQueueNoteA")} <b>{t("ctlQueueNoteBold")}</b> {t("ctlQueueNoteB")}
          </p>
        )}
      </Card>

      {/* ═══════ TO'XTATISH ═══════ */}
      {connection.is_active && (
        <Alert
          type="error"
          showIcon
          message={t("ctlStopTitle")}
          description={t("ctlStopDesc")}
          action={
            <Button
              danger
              icon={<PowerOff className="h-4 w-4" />}
              loading={togglePending}
              onClick={() => void setMaster(false)}
            >
              {t("ctlStopBtn")}
            </Button>
          }
        />
      )}
    </div>
  );
};

export default ConnectionControl;
