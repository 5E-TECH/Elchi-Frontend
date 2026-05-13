import { memo } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { X, Send, User, Phone, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import Popup from "../../../../shared/ui/Popup";
import { useAppNotification } from "../../../../app/providers/notification/NotificationProvider";
import { useDispatchPostToBranch } from "../../../../entities/mails";
import type { Branch } from "../../../../entities/branch";

interface SendPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  sourceBranchId: string;
  branches: Branch[];
  selectedIds: Set<string>;
  onSuccess: (sentIds?: string[]) => void;
}

interface SendPostFormValues {
  branchId: string;
}

const createSendPostSchema = (requiredMessage: string): yup.ObjectSchema<SendPostFormValues> =>
  yup.object({
    branchId: yup.string().required(requiredMessage),
  });

const BranchCard = memo(
  ({
    branch,
    selected,
    onSelect,
  }: {
    branch: Branch;
    selected: boolean;
    onSelect: (id: string) => void;
  }) => (
    <button
      type="button"
      onClick={() => onSelect(branch.id)}
      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left ${
        selected
          ? "border-main bg-main/10 dark:bg-main/15"
          : "border-gray-100 dark:border-white/10 bg-white dark:bg-white/4 hover:border-main/40 hover:bg-gray-50 dark:hover:bg-white/6"
      }`}
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-200 ${
          selected ? "bg-main text-white" : "bg-main/10 dark:bg-main/20 text-main"
        }`}
      >
        <User size={18} />
      </div>

      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span
          className={`text-sm font-semibold truncate ${
            selected ? "text-main" : "text-gray-800 dark:text-white"
          }`}
        >
          {branch.name}
        </span>
        <div className="flex items-center gap-1">
          <Phone size={11} className="text-gray-400 dark:text-white/40 shrink-0" />
          <span className="text-xs text-gray-400 dark:text-white/50 truncate">
            {branch.phone_number || "—"}
          </span>
        </div>
      </div>

      {selected && <CheckCircle2 size={20} className="text-main shrink-0" />}
    </button>
  ),
);

BranchCard.displayName = "BranchCard";

const SendPostModal = memo(
  ({ isOpen, onClose, postId, sourceBranchId, branches, selectedIds, onSuccess }: SendPostModalProps) => {
    const { t } = useTranslation("mails");
    const { apiRequest } = useAppNotification();

    const {
      control,
      handleSubmit,
      reset,
      setValue,
      watch,
    } = useForm<SendPostFormValues>({
      defaultValues: {
        branchId: "",
      },
      resolver: yupResolver(createSendPostSchema(t("branchRequired"))) as Resolver<SendPostFormValues>,
    });

    const dispatchPostToBranch = useDispatchPostToBranch();
    const orderIds = Array.from(selectedIds);
    const selectedBranchId = watch("branchId");

    const resetState = () => {
      reset({ branchId: "" });
      dispatchPostToBranch.reset();
    };

    const handleClose = () => {
      if (dispatchPostToBranch.isPending) return;
      resetState();
      onClose();
    };

    const submitForm = ({ branchId }: SendPostFormValues) => {
      if (!branchId || dispatchPostToBranch.isPending) return;
      if (!sourceBranchId) {
        apiRequest({
          request: () => Promise.reject(new Error("source_branch_missing")),
          errorMessage: t("sourceBranchNotFound"),
          successMessage: "",
        });
        return;
      }

      const branch = branches.find((item) => item.id === branchId);

      apiRequest({
        request: () =>
          dispatchPostToBranch.mutateAsync({
            postId,
            payload: {
              sourceBranchId,
              destinationBranchId: branchId,
              orderIds,
            },
          }),
        successMessage: t("sendBranchSuccess", { name: branch?.name ?? "" }),
        errorMessage: t("sendError"),
        onSuccess: () => {
          resetState();
          onSuccess(orderIds);
          onClose();
        },
      });
    };

    const showPopup = isOpen && branches.length > 0;

    return (
      <Popup isShow={showPopup} onClose={handleClose}>
        <div className="w-[90vw] max-w-md bg-white dark:bg-maindark rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-main flex items-center justify-center">
                <Send size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-white">
                  {t("selectBranch")}
                </p>
                <p className="text-xs text-gray-400 dark:text-white/50">
                  {t("selectedOrdersWillBeSent", { count: orderIds.length })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={dispatchPostToBranch.isPending}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/8 text-gray-400 dark:text-white/50 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 disabled:opacity-40 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="px-5 py-4">
            <p className="text-xs text-gray-400 dark:text-white/50 mb-3">
              {t("chooseOneBranch")}
            </p>
            <Controller
              control={control}
              name="branchId"
              render={() => (
                <div className="flex flex-col gap-2 max-h-70 overflow-y-auto custom-scrollbar pr-1">
                  {branches.map((branch) => (
                    <BranchCard
                      key={branch.id}
                      branch={branch}
                      selected={selectedBranchId === branch.id}
                      onSelect={(id) =>
                        setValue("branchId", id, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        })
                      }
                    />
                  ))}
                </div>
              )}
            />
          </div>

          <div className="px-5 pb-5">
            <button
              type="button"
              disabled={!selectedBranchId || dispatchPostToBranch.isPending}
              onClick={handleSubmit(submitForm)}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed enabled:cursor-pointer enabled:bg-main enabled:text-white enabled:hover:bg-primarydark enabled:hover:shadow-lg enabled:hover:shadow-main/30 enabled:hover:scale-[1.01]"
            >
              {dispatchPostToBranch.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("sending")}
                </>
              ) : (
                <>
                  <Send size={16} />
                  {t("send")}
                  {selectedBranchId && (
                    <span className="px-2 py-0.5 rounded-md bg-white/20 text-xs font-bold">
                      {orderIds.length}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      </Popup>
    );
  },
);

SendPostModal.displayName = "SendPostModal";

export default SendPostModal;
