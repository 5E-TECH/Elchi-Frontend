import { memo } from "react";
import HeaderName from "../../../shared/components/headerName";
import { ScanLine } from "lucide-react";
import Button from "../../../shared/components/button";

const ProductCreate = () => {
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
        <Button label="Create Product" icon={<ScanLine />} />
      </div>
    </div>
  );
};

export default memo(ProductCreate);
