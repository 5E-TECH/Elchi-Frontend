import { memo } from "react";
import HeaderName from "../../../shared/components/headerName";
import { Plus, ScanLine } from "lucide-react";
import Button from "../../../shared/components/button";

const ProductTable = () => {
  return (
    <div className="flex justify-between">
      <div>
        <HeaderName
          name="Create Product"
          description="Create a new product"
          icon={<ScanLine />}
        />
      </div>
      <div>
        <Button label="Create Product" icon={<Plus />} />
      </div>
    </div>
  );
};

export default memo(ProductTable);
