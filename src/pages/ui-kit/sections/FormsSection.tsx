import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "../../../shared/ui/primitives/Field";
import { TextInput } from "../../../shared/ui/primitives/TextInput";
import { KitSection } from "../KitSection";
import { ThemePair } from "../ThemePair";

/**
 * «Forma elementlari» bo'limi (`?section=forms`) — 3-bosqich: `Field` + `TextInput`.
 *
 * Namunalar taxtadan: `tizim-states-forms` 01 «Matn maydoni» (holatlar matritsasi) va 02 «Maxsus
 * maydonlar» (qidiruv, telefon raqam, ko'p qatorli matn); summa — `admin-balance-entry-dialog`.
 * «Kursor ustida» va «Fokus» holatlarini majburlab chizib bo'lmaydi — ular haqiqiy hover / Tab'da.
 * Ikkala panel bitta holatni bo'lishadi.
 */

const DemoBlock = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 flex-col gap-0.5">
      <h3 className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{title}</h3>
      {note ? <p className="text-[13px] text-text-muted">{note}</p> : null}
    </div>
    {children}
  </div>
);

/** Bitta holat: ustida holat nomi (maketdagi `.el-overline`), ostida maydon. */
const State = ({ name, children }: { name: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-2.5">
    <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{name}</span>
    {children}
  </div>
);

const GRID = "grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-x-6 gap-y-5";

export const FormsSection = () => {
  const { t } = useTranslation("ui");
  const [name, setName] = useState("");
  const [filled, setFilled] = useState(() => t("forms.demo.nameValue"));
  const [search, setSearch] = useState("");
  const [searchFilled, setSearchFilled] = useState(() => t("forms.demo.searchValue"));
  const [phone, setPhone] = useState("+998");
  const [phoneFilled, setPhoneFilled] = useState("+998901234567");
  const [phoneInvalid, setPhoneInvalid] = useState("+9989012");
  const [phoneLarge, setPhoneLarge] = useState("+998934561208");
  const [amount, setAmount] = useState("45000");
  const [note, setNote] = useState("");
  const [sms, setSms] = useState(() => t("forms.demo.smsValue"));

  return (
    <KitSection id="forms" title={t("kit.sections.forms.title")} description={t("kit.sections.forms.description")}>
      <ThemePair layout="stack">
        {() => (
          <div className="flex min-w-0 flex-col gap-8">
            <DemoBlock title={t("forms.groups.matrix")} note={t("forms.notes.matrix")}>
              <div className={GRID}>
                <State name={t("forms.states.empty")}>
                  <Field label={t("forms.demo.nameLabel")} required hint={t("forms.demo.nameHint")}>
                    <TextInput value={name} onValueChange={setName} placeholder={t("forms.demo.namePlaceholder")} />
                  </Field>
                </State>
                <State name={t("forms.states.filled")}>
                  <Field label={t("forms.demo.nameLabel")} required hint={t("forms.demo.nameHint")}>
                    <TextInput value={filled} onValueChange={setFilled} placeholder={t("forms.demo.namePlaceholder")} />
                  </Field>
                </State>
                <State name={t("forms.states.invalid")}>
                  <Field label={t("forms.demo.nameLabel")} required error={t("forms.demo.nameError")}>
                    <TextInput value="" onValueChange={() => {}} placeholder={t("forms.demo.namePlaceholder")} />
                  </Field>
                </State>
                <State name={t("forms.states.success")}>
                  <Field label={t("forms.demo.nameLabel")} required hint={t("forms.demo.nameHint")}>
                    <TextInput success defaultValue={t("forms.demo.nameValue")} />
                  </Field>
                </State>
                <State name={t("forms.states.disabled")}>
                  <Field label={t("forms.demo.nameLabel")} required disabled hint={t("forms.demo.disabledHint")}>
                    <TextInput defaultValue={t("forms.demo.nameValue")} />
                  </Field>
                </State>
                <State name={t("forms.states.readonly")}>
                  <Field label={t("forms.demo.nameLabel")} required readOnly hint={t("forms.demo.readonlyHint")}>
                    <TextInput copyable copyLabel={t("forms.demo.copyName")} defaultValue={t("forms.demo.nameValue")} />
                  </Field>
                </State>
              </div>
            </DemoBlock>

            <DemoBlock title={t("forms.groups.search")} note={t("forms.notes.search")}>
              <div className={GRID}>
                <State name={t("forms.states.empty")}>
                  <Field label={t("forms.demo.searchLabel")}>
                    <TextInput
                      mode="search"
                      value={search}
                      onValueChange={setSearch}
                      placeholder={t("forms.demo.searchPlaceholder")}
                    />
                  </Field>
                </State>
                <State name={t("forms.states.filled")}>
                  <Field label={t("forms.demo.searchLabel")}>
                    <TextInput
                      mode="search"
                      value={searchFilled}
                      onValueChange={setSearchFilled}
                      placeholder={t("forms.demo.searchPlaceholder")}
                    />
                  </Field>
                </State>
              </div>
            </DemoBlock>

            <DemoBlock title={t("forms.groups.phone")} note={t("forms.notes.phone")}>
              <div className={GRID}>
                <State name={t("forms.states.empty")}>
                  <Field label={t("forms.demo.phoneLabel")} required hint={t("forms.demo.phoneHint")}>
                    <TextInput mode="phone" value={phone} onValueChange={setPhone} />
                  </Field>
                </State>
                <State name={t("forms.states.filled")}>
                  <Field label={t("forms.demo.phoneLabel")} required hint={t("forms.demo.phoneHint")}>
                    <TextInput mode="phone" value={phoneFilled} onValueChange={setPhoneFilled} />
                  </Field>
                </State>
                <State name={t("forms.states.invalid")}>
                  <Field label={t("forms.demo.phoneLabel")} required error={t("forms.demo.phoneError")}>
                    <TextInput mode="phone" value={phoneInvalid} onValueChange={setPhoneInvalid} />
                  </Field>
                </State>
                <State name={t("forms.states.large")}>
                  <Field label={t("forms.demo.phoneLabel")} required hint={t("forms.demo.phoneLargeHint")}>
                    <TextInput mode="phone" size="lg" value={phoneLarge} onValueChange={setPhoneLarge} />
                  </Field>
                </State>
              </div>
            </DemoBlock>

            <DemoBlock title={t("forms.groups.money")} note={t("forms.notes.money")}>
              <div className={GRID}>
                <State name={t("forms.states.filled")}>
                  <Field label={t("forms.demo.amountLabel")} required>
                    <TextInput mode="money" value={amount} onValueChange={setAmount} />
                  </Field>
                </State>
              </div>
            </DemoBlock>

            <DemoBlock title={t("forms.groups.textarea")}>
              <div className={GRID}>
                <State name={t("forms.states.optional")}>
                  <Field label={t("forms.demo.noteLabel")} optional>
                    <TextInput
                      multiline
                      value={note}
                      onValueChange={setNote}
                      placeholder={t("forms.demo.notePlaceholder")}
                    />
                  </Field>
                </State>
                <State name={t("forms.states.counter")}>
                  <Field
                    label={t("forms.demo.smsLabel")}
                    required
                    hintLive
                    hint={t("forms.demo.smsCounter", { count: sms.length })}
                  >
                    <TextInput multiline value={sms} onValueChange={setSms} />
                  </Field>
                </State>
              </div>
            </DemoBlock>
          </div>
        )}
      </ThemePair>
    </KitSection>
  );
};
