import { memo } from "react";
import HeaderName from "../../shared/components/headerName";
import { ListOrdered, Plus } from "lucide-react";
import Button from "../../shared/components/button";
import { useNavigate } from "react-router-dom";

const Orders = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-sidebar h-full rounded-2xl dark:bg-maindark">
      <div className="flex items-center justify-between pr-4">
        <HeaderName
          name="Buyurtmalar ro'yxati"
          description="Barcha buyurtmalar ro'yxati"
          icon={<ListOrdered />}
        />
        <Button
          label="Yangi buyurtma"
          icon={<Plus />}
          onClick={() => navigate("add")}
        />
      </div>
    </div>
  );
};

export default memo(Orders);
