import { memo } from "react";
import HeaderName from "../../../shared/components/headerName";
import { ScanLine } from "lucide-react";

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
           aaaa
         </div>
       </div>
  );
};

export default memo(ProductTable);
