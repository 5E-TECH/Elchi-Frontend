// dizayn-v2: superadmin-regions-sato-codes, superadmin-regions-sato-codes-not-found, superadmin-regions-sato-codes-edit, admin-regions-sato-codes, admin-regions-sato-codes-edit
import type { ReactNode } from "react";
import { Keyboard, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, DataTable, IconButton, type DataTableColumn } from "../../../../shared/ui/primitives";
import type { SatoDistrictRow, SatoMissingRow, SatoRow, SatoTab } from "../../model/satoModel";
import { SatoCodeActions, SatoCodeEditorBlock, SatoCodeField } from "./SatoCodeEditor";
import type { SatoCodeEditorState } from "./useSatoCodeEditor";

const TITLE = "whitespace-nowrap text-sm font-semibold text-text";
const SUB = "text-[13px] leading-[18px] text-text-muted";
const CODE = "whitespace-nowrap font-semibold text-text tabular-nums tracking-[.04em]";
const NO_CODE = "whitespace-nowrap text-text-subtle";

type Props = {
  tab: SatoTab;
  rows: readonly SatoRow[];
  editor: SatoCodeEditorState;
  /** Qatorlar qayta yuklanmoqda (eski qatorlar xira). */
  busy?: boolean;
  label: string;
};

/**
 * SATO tabining jadvali (desktop/planshet) va kartalari (telefon). Kodli qatorda — «✎» (kodni o'zgartirish),
 * kodsizda — «Kod kiritish»; tahrirlanayotgan qatorda maydon + «Bekor» / «Saqlash» (bir vaqtda bitta qator).
 * «Bazada yo'q» (SA-1) — faqat ko'rish: «Tuman qo'shish» SA-2 da.
 */
export const SatoCodesTable = ({ tab, rows, editor, busy, label }: Props) => {
  const { t } = useTranslation("region");
  const withRegion = tab === "duplicates";

  const trigger = (row: SatoDistrictRow, phone: boolean) => {
    const name = withRegion ? t("v2.sato.row.nameWithRegion", { name: row.name, region: row.regionName }) : row.name;
    const hasCode = Boolean(row.satoCode ?? row.foundCode);
    if (hasCode || phone)
      return (
        <IconButton
          data-sato-edit={row.id}
          size={phone ? "lg" : "sm"}
          variant={phone ? "secondary" : "ghost"}
          icon={hasCode ? Pencil : Keyboard}
          label={t(hasCode ? "v2.sato.row.editAria" : "v2.sato.row.enterAria", { name })}
          onClick={() => editor.start(row)}
        />
      );
    return (
      <Button
        data-sato-edit={row.id}
        variant="ghost"
        size="sm"
        leftIcon={Keyboard}
        aria-label={t("v2.sato.row.enterAria", { name })}
        onClick={() => editor.start(row)}
      >
        {t("v2.sato.row.enter")}
      </Button>
    );
  };

  const codeCell = (row: SatoDistrictRow) => {
    if (editor.editingId === row.id) return <SatoCodeField row={row} editor={editor} />;
    const code = row.satoCode ?? row.foundCode;
    return code ? <span className={CODE}>{code}</span> : <span className={NO_CODE}>{t("v2.sato.row.noCode")}</span>;
  };

  const actionsCell = (row: SatoDistrictRow) =>
    editor.editingId === row.id ? (
      <SatoCodeActions row={row} editor={editor} />
    ) : (
      <div className="flex justify-end">{trigger(row, false)}</div>
    );

  const columns = ((): DataTableColumn<SatoRow>[] => {
    const district = (render: (row: SatoDistrictRow) => ReactNode) => (row: SatoRow) =>
      row.kind === "district" ? render(row) : null;
    const missing = (render: (row: SatoMissingRow) => ReactNode) => (row: SatoRow) =>
      row.kind === "missing" ? render(row) : null;
    const actions: DataTableColumn<SatoRow> = {
      id: "actions",
      header: <span className="sr-only">{t("v2.sato.columns.actions")}</span>,
      align: "end",
      cell: district(actionsCell),
    };

    if (tab === "missing")
      return [
        { id: "code", header: t("v2.sato.columns.satoCode"), cell: missing((row) => <span className={CODE}>{row.satoCode}</span>) },
        { id: "official", header: t("v2.sato.columns.officialName"), cell: missing((row) => row.satoName) },
        { id: "region", header: t("v2.sato.columns.region"), cell: missing((row) => row.regionName) },
      ];

    if (tab === "found")
      return [
        {
          id: "district",
          header: t("v2.sato.columns.district"),
          cell: district((row) => (
            <div className="flex min-w-0 flex-col">
              <span className={TITLE}>{row.name}</span>
              <span className={SUB}>{row.regionName}</span>
            </div>
          )),
        },
        { id: "code", header: t("v2.sato.columns.foundCode"), cell: district(codeCell) },
        {
          id: "official",
          header: t("v2.sato.columns.officialName"),
          hideBelow: "lg",
          cell: district((row) => <span className="whitespace-nowrap">{row.officialName ?? "—"}</span>),
        },
        actions,
      ];

    return [
      {
        id: "district",
        header: t("v2.sato.columns.district"),
        cell: district((row) =>
          tab === "duplicates" ? (
            <div className="flex min-w-0 flex-col">
              <span className={TITLE}>{row.name}</span>
              <span className={SUB}>{t("v2.sato.row.id", { id: row.id })}</span>
            </div>
          ) : (
            <span className={TITLE}>{row.name}</span>
          ),
        ),
      },
      { id: "region", header: t("v2.sato.columns.region"), cell: district((row) => row.regionName) },
      { id: "code", header: t("v2.sato.columns.satoCode"), cell: district(codeCell) },
      actions,
    ];
  })();

  const renderCard = (row: SatoRow) => {
    if (row.kind === "missing")
      return (
        <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
          <span className="text-sm font-semibold text-text">{row.satoName}</span>
          <span className={SUB}>{t("v2.sato.row.meta", { region: row.regionName, code: row.satoCode })}</span>
        </div>
      );
    const editing = editor.editingId === row.id;
    const code = row.satoCode ?? row.foundCode ?? t("v2.sato.row.noCode");
    const meta =
      tab === "duplicates"
        ? t("v2.sato.row.metaWithId", { region: row.regionName, id: row.id, code })
        : t("v2.sato.row.meta", { region: row.regionName, code });
    return (
      <div className="flex min-w-0 flex-col gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-semibold text-text">{row.name}</span>
            <span className={SUB}>{meta}</span>
          </div>
          {editing ? null : trigger(row, true)}
        </div>
        {editing ? <SatoCodeEditorBlock row={row} editor={editor} /> : null}
      </div>
    );
  };

  return (
    <DataTable<SatoRow>
      rows={rows}
      columns={columns}
      getRowKey={(row) => (row.kind === "missing" ? `missing-${row.satoCode}` : row.id)}
      label={label}
      cardsLabel={label}
      renderCard={renderCard}
      rowClassName={(row) => (row.kind === "district" && editor.editingId === row.id ? "bg-row-hover" : null)}
      busy={busy}
    />
  );
};
