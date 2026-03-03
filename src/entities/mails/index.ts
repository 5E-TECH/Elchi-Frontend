import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";

const mails = "mails";

export const useMails = () => {
  const getNewMails = () =>
    useQuery({
      queryKey: [mails, "new"],
      queryFn: () => api.get("post/new").then((res) => res.data),
    });

  const getRefusedMails = () =>
    useQuery({
      queryKey: [mails, "refused"],
      queryFn: () => api.get("post/rejected").then((res) => res.data),
    });

  const getOldMails = () =>
    useQuery({
      queryKey: [mails, "old"],
      queryFn: () => api.get("post/old").then((res) => res.data),
    });

  return { getNewMails, getRefusedMails, getOldMails };
};
