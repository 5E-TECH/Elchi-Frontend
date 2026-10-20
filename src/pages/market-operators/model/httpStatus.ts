import axios from "axios";

/** So'rov xatosining HTTP holati (tarmoq xatosi yoki boshqa xato — `null`). Xom backend matni o'qilmaydi. */
export const httpStatusOf = (error: unknown): number | null =>
  axios.isAxiosError(error) ? (error.response?.status ?? null) : null;
