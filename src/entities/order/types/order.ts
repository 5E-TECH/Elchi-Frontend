export interface OrderItem {
    product_id: string;
    quantity: number;
}

export type DeliveryType = "center" | "address";

export type OrderStatus =
    | "created"
    | "new"
    | "received"
    | "on the road"
    | "waiting"
    | "sold"
    | "cancelled"
    | "paid"
    | "partly_paid"
    | "closed";

export interface OrderCustomer {
    id: string;
    name: string;
    phone_number: string;
    extra_number?: string;
    district_id?: string;
    address?: string;
}

export interface OrderListItem {
    id: string;
    market_id: string;
    customer_id: string;
    product_quantity: number;
    status: OrderStatus;
    where_deliver: DeliveryType;
    total_price: number;
    to_be_paid: number;
    paid_amount: number;
    district_id: string | null;
    region_id: string | null;
    address: string | null;
    operator: string | null;
    comment: string | null;
    post_id: string | null;
    createdAt: string;
    updatedAt: string;
    deleted: boolean;
    items: {
        id: string;
        product_id: string;
        order_id: string;
        quantity: number;
        createdAt: string;
        updatedAt: string;
    }[];
    customer?: {
        id: string;
        name: string;
        phone_number: string;
        extra_number?: string | null;
    };
    market?: {
        id: string;
        name: string;
        phone_number?: string;
    };
    district?: {
        id: string;
        name: string;
        region?: { id: string; name: string };
    };
}

export interface OrderListResponse {
    data: OrderListItem[];
    total: number;
    page: number;
    limit: number;
}

export interface OrderListParams {
    page?: number;
    limit?: number;
    status?: OrderStatus | "";
    market_id?: string;
    customer_id?: string;
    region_id?: string;
    courier_id?: string;
    search?: string;
    start_day?: string;
    end_day?: string;
}

// Mijoz ma'lumotlari (nested object)
export interface CustomerPayload {
    name: string;
    phone_number: string;   // +998XXXXXXXXX formati
    district_id: string;
    extra_number?: string;  // XX-XXX-XX-XX formati (ixtiyoriy)
    address?: string;       // ixtiyoriy
}

export interface CreateOrderRequest {
    market_id: string;
    customer: CustomerPayload;
    items: OrderItem[];
    address?: string;       // ixtiyoriy
    district_id: string;
    region_id: string;
    status?: string;
    total_price: number;
    comment?: string;
    operator?: string;
    where_deliver: DeliveryType;
    paid_amount?: number;
    post_id?: string;
    qr_code_token?: string;
}
