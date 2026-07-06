import type { PaymentRow } from "./patmentHistoryTable";

const getActorName = (actor?: PaymentRow["created_by_user"]) => {
  if (!actor) return "";

  return (
    actor.name?.trim() ||
    actor.full_name?.trim() ||
    [actor.first_name, actor.last_name].filter(Boolean).join(" ").trim()
  );
};

const isMeaningfulName = (value: string) => {
  const normalized = value.trim();
  return Boolean(normalized) && normalized !== "-" && normalized !== "—" && !/^\d+$/.test(normalized);
};

export const resolvePaymentActorName = (row: PaymentRow) => {
  const actorName = [
    row.created_by_user,
    row.createdByUser,
    row.user,
    row.source_user,
    row.sourceUser,
  ]
    .map(getActorName)
    .find(Boolean);

  if (actorName) return actorName;

  const createdBy = String(row.created_by ?? "").trim();
  return isMeaningfulName(createdBy) ? createdBy : "-";
};
