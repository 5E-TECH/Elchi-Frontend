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
    | "cancelled (sent)"
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
    qr_code_token?: string | null;
    sell_requires_media?: boolean;
    cancel_requires_media?: boolean;
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
        product?: {
            id: string;
            name: string;
            image_url?: string | null;
        };
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
        expense_proof_conditions?: string[] | null;
        cancelled_handover_qr_required?: boolean | null;
    };
    branch?: {
        id: string;
        name: string;
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
    status?: OrderStatus | OrderStatus[] | "";
    market_id?: string;
    branch_id?: string;
    customer_id?: string;
    region_id?: string;
    district_id?: string;
    courier_id?: string;
    search?: string;
    start_day?: string;
    end_day?: string;
}

export interface ExternalOrderItem {
    id: string;
    external_id?: string | null;
    order_number?: string | null;
    status?: string | null;
    total_price?: number | null;
    amount?: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    created_at?: string | null;
    store_name?: string | null;
    shop_name?: string | null;
    integration_name?: string | null;
    marketplace_name?: string | null;
    products_count?: number | null;
    items_count?: number | null;
    items?: Array<{
        id?: string;
        name?: string | null;
        product_name?: string | null;
        quantity?: number | null;
    }>;
}

export interface PaginatedMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface ExternalOrdersResponse {
    statusCode?: number;
    message?: string;
    data?: {
        items?: ExternalOrderItem[];
        meta?: PaginatedMeta;
        pagination?: PaginatedMeta;
    };
}

export interface ExternalOrdersParams {
    page?: number;
    limit?: number;
    status?: string;
    from_date?: string;
    to_date?: string;
    search?: string;
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
    market_id?: string;
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
    sell_requires_media?: boolean;
    cancel_requires_media?: boolean;
}
