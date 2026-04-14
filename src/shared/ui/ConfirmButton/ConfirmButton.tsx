import { Button } from "antd";
import type { ButtonProps } from "antd";
import { memo, useState, type ReactNode } from "react";
import PopupConfirm from "../../components/popupConfirm";

interface ConfirmButtonProps extends ButtonProps {
  confirmTitle: ReactNode;
  confirmDescription?: ReactNode;
  onConfirm: () => void | Promise<void>;
  popupTheme?: "default" | "branch";
}

const ConfirmButton = ({
  confirmTitle,
  confirmDescription,
  onConfirm,
  popupTheme = "default",
  children,
  ...buttonProps
}: ConfirmButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button {...buttonProps} onClick={() => setIsOpen(true)}>
        {children}
      </Button>
      <PopupConfirm
        isOpen={isOpen}
        onClose={() => {
          if (!buttonProps.loading) {
            setIsOpen(false);
          }
        }}
        onConfirm={async () => {
          await onConfirm();
          setIsOpen(false);
        }}
        title={confirmTitle}
        message={confirmDescription}
        isLoading={Boolean(buttonProps.loading)}
        variant={buttonProps.danger ? "danger" : "warning"}
        theme={popupTheme}
      />
    </>
  );
};

export default memo(ConfirmButton);
