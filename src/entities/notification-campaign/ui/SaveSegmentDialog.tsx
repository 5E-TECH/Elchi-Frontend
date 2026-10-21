// dizayn-v2: superadmin-notifications-send-audience-save-dialog, superadmin-notifications-send-states
import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NoticeAlert } from "../../notification";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { cx } from "../../../shared/lib/cx";
import { Button, Dialog, Field, TextInput } from "../../../shared/ui/primitives";
import { useCreateAudienceSegment } from "../api/hooks";
import type { SavedAudienceSegment } from "../api/campaignApi";
import { isAudienceSegmentEmpty, type AudienceDraft, type AudienceTarget } from "../model/audience";
import { useAudienceDescription } from "../model/useAudienceDescription";

/** Backend chegaralari (`CreateAudienceSegmentRequestDto`). */
export const SEGMENT_NAME_MAX = 120;
export const SEGMENT_NOTE_MAX = 500;

export type SaveSegmentDialogProps = {
  open: boolean;
  draft: AudienceDraft;
  target: AudienceTarget | null;
  /** Jonli son («Hozir»); noma'lum — qator chizilmaydi. */
  total: number | null;
  marketLabel?: string | null;
  onClose: () => void;
  onSaved: (segment: SavedAudienceSegment) => void;
};

/**
 * «SEGMENTNI SAQLASH» (maket `superadmin-notifications-send-audience-save-dialog`): Nomi* (120), Izoh (500), shartlar
 * xulosasi va hozirgi son. Saqlanadi faqat SHART — son keyingi safar qayta sanaladi. Nom band (409) — maydon xatosi
 * (maket `-send-states` «Segment nomi band»); boshqa xato — oynada tushunarli matn (backend matni ko'rsatilmaydi).
 */
export const SaveSegmentDialog = ({
  open,
  draft,
  target,
  total,
  marketLabel,
  onClose,
  onSaved,
}: SaveSegmentDialogProps) => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const create = useCreateAudienceSegment();
  const description = useAudienceDescription(draft, { marketLabel, enabled: open });
  const withCustomers = draft.kinds.includes("customer");

  const reset = () => {
    setName("");
    setNote("");
    setNameError(null);
    setFormError(null);
    create.reset();
  };

  const close = () => {
    if (create.isPending) return;
    onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (create.isPending || !target) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t("campaign.saveDialog.nameRequired"));
      return;
    }
    setNameError(null);
    setFormError(null);
    create.mutate(
      { ...target, name: trimmed, ...(note.trim() ? { description: note.trim() } : {}) },
      {
        onSuccess: (segment) => {
          notify.success(t("campaign.saveDialog.saved"), { description: trimmed });
          onSaved(segment);
          onClose();
        },
        onError: (error) => {
          const status = getErrorStatus(error);
          if (status === 409) setNameError(t("campaign.saveDialog.nameTaken"));
          else if (status === 400) setFormError(t("campaign.saveDialog.badRequest"));
          else setFormError(t("campaign.saveDialog.failed"));
        },
      },
    );
  };

  const rows: Array<{ label: string; value: string }> = [
    { label: t("campaign.saveDialog.kinds"), value: description.kinds },
    ...(description.staffRoles
      ? [{ label: t("campaign.saveDialog.staffRoles"), value: description.staffRoles }]
      : []),
    ...(withCustomers
      ? isAudienceSegmentEmpty(draft.customerSegment)
        ? [{ label: t("campaign.saveDialog.region"), value: t("campaign.saveDialog.allCustomers") }]
        : [
            { label: t("campaign.saveDialog.region"), value: description.area },
            { label: t("campaign.saveDialog.market"), value: description.market },
            { label: t("campaign.saveDialog.lastOrder"), value: description.lastOrder },
            { label: t("campaign.saveDialog.orders"), value: description.orders },
          ]
      : []),
    ...(total !== null
      ? [
          {
            label: t("campaign.saveDialog.now"),
            value: t("campaign.saveDialog.nowValue", { value: num(total) }),
          },
        ]
      : []),
  ];

  return (
    <Dialog
      open={open}
      onClose={close}
      onExited={reset}
      busy={create.isPending}
      title={t("campaign.saveDialog.title")}
      description={t("campaign.saveDialog.description")}
      icon={Save}
      size="md"
      onSubmit={submit}
      formProps={{ noValidate: true, "aria-label": t("campaign.saveDialog.title") }}
      footer={
        <>
          <Button variant="secondary" disabled={create.isPending} onClick={close}>
            {t("campaign.saveDialog.cancel")}
          </Button>
          <Button type="submit" leftIcon={Save} loading={create.isPending}>
            {t("campaign.saveDialog.submit")}
          </Button>
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-4" data-testid="save-segment">
        <Field
          label={t("campaign.saveDialog.name")}
          required
          error={nameError ?? undefined}
          hintLive
          hint={
            <span className="block text-right text-text-subtle tabular-nums">
              {`${num(name.length)} / ${num(SEGMENT_NAME_MAX)}`}
            </span>
          }
        >
          <TextInput value={name} onValueChange={setName} maxLength={SEGMENT_NAME_MAX} />
        </Field>
        <Field label={t("campaign.saveDialog.note")} optional>
          <TextInput
            multiline
            rows={2}
            value={note}
            onValueChange={setNote}
            maxLength={SEGMENT_NOTE_MAX}
            placeholder={t("campaign.saveDialog.notePlaceholder")}
          />
        </Field>
        <dl className="m-0 flex min-w-0 flex-col rounded-xl bg-sunken px-4 py-1 text-sm">
          {rows.map((row, index) => (
            <div
              key={row.label}
              className={cx(
                "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2",
                index > 0 && "border-t border-border",
              )}
            >
              <dt className="min-w-0 text-text-muted">{row.label}</dt>
              <dd className="m-0 ml-auto text-right font-semibold text-text [overflow-wrap:anywhere]">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        {formError ? <NoticeAlert tone="danger">{formError}</NoticeAlert> : null}
      </div>
    </Dialog>
  );
};
