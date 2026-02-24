export interface OrderItem {
    product_id: string;
    quantity: number;
}

export type DeliveryType = "center" | "home";

export interface CreateOrderRequest {
    market_id: string;
    customer_id?: string;
    where_deliver: DeliveryType;
    total_price: number;
    to_be_paid: number;
    paid_amount: number;
    status: string;
    comment: string;
    operator: string;
    district_id: string;
    post_id?: string;
    address: string;
    qr_code_token?: string;
    items: OrderItem[];
    // Customer fields (if no customer_id)
    phone?: string;
    extra_phone?: string;
    name?: string;
    region_id?: string;
}
