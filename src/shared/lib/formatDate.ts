import dayjs from "dayjs";

export const formatDate = (value?: string | null, format = "DD.MM.YYYY HH:mm") => {
  if (!value) return "—";
  return dayjs(value).format(format);
};
