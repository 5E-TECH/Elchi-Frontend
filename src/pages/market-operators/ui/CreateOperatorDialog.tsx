// dizayn-v2: market-operators-create-dialog
import { useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  parseCommissionInput,
  useCreateMarketOperator,
  useRefreshMarketOperators,
  useUpdateMarketOperatorCommission,
  type CommissionInputError,
  type CommissionType,
  type MarketOperator,
} from "../../../entities/market-operator";
import { notify } from "../../../shared/lib/notify";
import { UZBEKISTAN_PHONE_PREFIX } from "../../../shared/lib/phone";
import { Button, Dialog, Field, IconButton, TextInput } from "../../../shared/ui/primitives";
import {
  buildCreateMarketOperatorPayload,
  validateCreateOperator,
  type CreateOperatorErrors,
  type MarketOperatorCreateFormValues,
} from "../model/createMarketOperator";
import { httpStatusOf } from "../model/httpStatus";
import { useCommissionErrorText, useCommissionText } from "../model/useCommissionText";
import { CommissionTypeSwitch, CommissionValueInput } from "./CommissionParts";

const EMPTY: MarketOperatorCreateFormValues = { name: "", phone_number: UZBEKISTAN_PHONE_PREFIX, password: "" };

type CreateOperatorDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Market nomi (sarlavha ostidagi «<market> uchun yangi xodim»); yo'q bo'lsa — umumiy matn. */
  marketName: string | null;
  /** Komissiya PATCH'i yiqilganda xabardagi «Belgilash» — shu operatorning Komissiya oynasi. */
  onSetCommission: (operator: MarketOperator) => void;
};

/**
 * «OPERATOR QO'SHISH» (maket `market-operators-create-dialog`; telefonda pastki varaqa — `Dialog` o'zi).
 *
 * Ism familiya · Telefon (+998) · Parol (ko'rsatish/yashirish, kamida 4 belgi) · ixtiyoriy «Komissiya» (ega MO-S5:
 * Foiz | Qat'iy summa + qiymat; bo'sh — belgilanmagan). Backend bilan ikki so'rov: avval `POST /market-operators`
 * (faqat 3 maydon — `forbidNonWhitelisted`), so'ng qiymat bo'lsa `PATCH :id/commission`. PATCH yiqilsa operator
 * baribir qo'shilgan: oyna yopiladi, «Operator qo'shildi, komissiya saqlanmadi» + «Belgilash» (Komissiya oynasi).
 * 409 — telefon maydonida «Bu telefon raqam band», 403 — «Market bloklangan». Xom backend matni ko'rsatilmaydi.
 */
export const CreateOperatorDialog = ({ open, onClose, marketName, onSetCommission }: CreateOperatorDialogProps) => {
  const { t } = useTranslation("marketOperators");
  const createOperator = useCreateMarketOperator();
  const updateCommission = useUpdateMarketOperatorCommission();
  const refresh = useRefreshMarketOperators();
  const commissionError = useCommissionErrorText();
  const { maxFixed } = useCommissionText();

  const [values, setValues] = useState<MarketOperatorCreateFormValues>(EMPTY);
  const [commissionType, setCommissionType] = useState<CommissionType>("percent");
  const [commissionText, setCommissionText] = useState("");
  const [errors, setErrors] = useState<CreateOperatorErrors>({});
  const [commissionCode, setCommissionCode] = useState<CommissionInputError | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);

  // Har ochilishda toza forma (yopilgan oynada parol qolmasin) — render paytida, effektsiz.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setValues(EMPTY);
      setCommissionType("percent");
      setCommissionText("");
      setErrors({});
      setCommissionCode(null);
      setShowPassword(false);
    }
  }

  const close = () => {
    if (busy) return;
    onClose();
  };

  const setField = (field: keyof MarketOperatorCreateFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const nextErrors = validateCreateOperator(values);
    const commission = parseCommissionInput(commissionType, commissionText, { optional: true });
    setErrors(nextErrors);
    setCommissionCode(commission.ok ? null : commission.error);
    if (Object.keys(nextErrors).length > 0 || !commission.ok) return;

    submittingRef.current = true;
    setBusy(true);
    let created: MarketOperator;
    try {
      created = await createOperator.mutateAsync(buildCreateMarketOperatorPayload(values));
    } catch (error) {
      const status = httpStatusOf(error);
      if (status === 409) setErrors({ phone_number: "phoneTaken" });
      else if (status === 403) notify.error(t("create.blocked"));
      else notify.error(t("create.failed"), { description: t("create.failedText") });
      submittingRef.current = false;
      setBusy(false);
      return;
    }

    const name = created.name || buildCreateMarketOperatorPayload(values).name;
    // Javobda `id` bo'lmasa (kutilmagan shakl) PATCH yuborib bo'lmaydi — komissiya saqlanmagan deb aytiladi.
    let commissionSaved = commission.value === null || Boolean(created.id);
    if (commission.value !== null && created.id) {
      try {
        await updateCommission.mutateAsync({
          id: created.id,
          commission: { commission_type: commissionType, commission_value: commission.value },
        });
      } catch {
        commissionSaved = false;
      }
    }
    void refresh();
    submittingRef.current = false;
    setBusy(false);
    onClose();

    if (commissionSaved) {
      notify.success(t("create.created"), { description: t("create.createdText", { name }) });
    } else {
      const operator: MarketOperator = { ...created, name, commission_type: null, commission_value: null };
      notify.error(t("create.commissionFailed"), {
        description: t("create.commissionFailedText", { name }),
        // `id` siz operatorga Komissiya oynasi ochilmaydi (PATCH manzili yo'q) — ro'yxatdagi qator menyusidan.
        ...(created.id
          ? { action: { label: t("create.setCommission"), onClick: () => onSetCommission(operator) } }
          : {}),
      });
    }
  };

  const errorText = (field: keyof MarketOperatorCreateFormValues) => {
    const code = errors[field];
    return code ? t(`create.errors.${code}`) : undefined;
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={busy}
      size="md"
      icon={UserPlus}
      title={t("create.title")}
      description={marketName ? t("create.description", { market: marketName }) : t("create.descriptionFallback")}
      onSubmit={submit}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            {t("create.cancel")}
          </Button>
          <Button type="submit" loading={busy} loadingText={t("create.submitting")}>
            {t("create.submit")}
          </Button>
        </>
      }
    >
      <Field label={t("create.name")} required error={errorText("name")}>
        <TextInput
          value={values.name}
          onValueChange={(value) => setField("name", value)}
          placeholder={t("create.namePlaceholder")}
          autoComplete="off"
          maxLength={100}
        />
      </Field>
      <Field label={t("create.phone")} required error={errorText("phone_number")}>
        <TextInput
          mode="phone"
          value={values.phone_number}
          onValueChange={(value) => setField("phone_number", value)}
        />
      </Field>
      <Field
        label={t("create.password")}
        required
        hint={t("create.passwordHint")}
        error={errorText("password")}
      >
        <TextInput
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={values.password}
          onValueChange={(value) => setField("password", value)}
          placeholder={t("create.passwordPlaceholder")}
          suffix={
            <IconButton
              size="sm"
              icon={showPassword ? EyeOff : Eye}
              label={showPassword ? t("create.hidePassword") : t("create.showPassword")}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
              className="-mr-2"
            />
          }
        />
      </Field>
      <Field
        label={t("create.commission")}
        optional
        hint={
          commissionType === "percent"
            ? t("create.percentHint")
            : t("create.fixedHint", { max: maxFixed })
        }
        error={commissionError(commissionType, commissionCode)}
      >
        <div className="flex flex-wrap gap-3">
          <CommissionTypeSwitch
            ariaLabel={t("commissionForm.type")}
            value={commissionType}
            onChange={(next) => {
              setCommissionType(next);
              setCommissionCode(null);
            }}
            className="min-w-0 flex-[1_1_200px]"
          />
          <CommissionValueInput
            type={commissionType}
            value={commissionText}
            onValueChange={(next) => {
              setCommissionText(next);
              if (commissionCode) setCommissionCode(null);
            }}
            className="min-w-0 flex-[1_1_140px]"
          />
        </div>
      </Field>
    </Dialog>
  );
};

export default CreateOperatorDialog;
