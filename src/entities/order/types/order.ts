export interface OrderItem {
    // Katalogdan tanlangan mahsulot id'si, YOKI erkin-matnli ("maxsus")
    // mahsulot uchun null — bunda nomi `product_name` da keladi (#1).
    product_id: string | null;
    product_name?: string;
    quantity: number;
}

export type DeliveryType = "center" | "address";

/**
 * 6kHnNH9j: buyurtma qayerdan ketadi — `HQ` (odatiy oqim: HQ qabuli, pochta) yoki `WAREHOUSE` (viloyat filiali
 * omboridan, HQ va pochtasiz — darhol filialda «qabul qilingan»).
 */
export type OrderFulfillmentSource = "HQ" | "WAREHOUSE";

/** Yaratishda manba: `auto` (sukut — ombor yetsa ombordan, aks holda HQ), `hq` — har doim HQ. */
export type OrderFulfillmentChoice = "auto" | "hq";

/** Buyurtma ombori (ro'yxat va tafsilot javobida; HQ buyurtmasida `null`). */
export interface OrderWarehouseRef {
    id: string;
    name: string;
    branch_id?: string | null;
}

export type OrderStatus =
    | "created"
    | "new"
    | "received"
    | "on the road"
    | "waiting"
    | "waiting_customer"
    | "sold"
    | "cancelled"
    | "cancelled (sent)"
    | "returned_to_market"
    | "paid"
    | "partly_paid"
    | "closed"
    /** Bekor qilingan posilka marketga topshirildi (terminal; «Marketga topshirildi», neytral). */
    | "returned_to_market";

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
    /** Mijozga ko'rinadigan raqam («EL-100081», `enrichOrders`; yorliqdagi) — ro'yxatda shu ko'rsatiladi (rwAy8Qyk). */
    order_number?: string | null;
    market_id: string;
    customer_id: string;
    product_quantity: number;
    status: OrderStatus;
    where_deliver: DeliveryType;
    total_price: number;
    to_be_paid: number;
    /**
     * Sotishda «Marketga to'langan summa» chegarasi (uguUEhin): kutilayotgan buyurtmada `to_be_paid` hali 0, chegara
     * shu maydonda. Ro'yxat va detalda menejerga ham keladi (vbu7Wr3o); logistga yo'q.
     */
    sale_market_paid_max?: number | string | null;
    paid_amount: number;
    district_id: string | null;
    region_id: string | null;
    address: string | null;
    operator: string | null;
    comment: string | null;
    post_id: string | null;
    /** Saqlash (custody) zanjiri — ro'yxat javobida to'liq yozuv bilan keladi. */
    courier_id?: string | null;
    holder_type?: "HQ" | "BRANCH" | "COURIER" | "MARKET" | null;
    holder_branch_id?: string | null;
    holder_courier_id?: string | null;
    /** Bekor posilka qaytarish pochtasida (`cancelled (sent)` yoki uning pochtasi). */
    canceled_post_id?: string | null;
    /** Kuryer ro'yxati: `cancelled` + `transport_status: "cancelled (sent)"` (gateway). */
    transport_status?: string | null;
    /** Oxirgi custody o'tishi (bekor bosqichidagi «N kun»). */
    last_handover_at?: string | null;
    qr_code_token?: string | null;
    sell_requires_media?: boolean;
    cancel_requires_media?: boolean;
    /**
     * Kuryer sotish / qisman sotish / bekor qilishda biriktirgan DALIL
     * fayllari (MinIO kalitlari, `proof-...`). Maxfiy: ochiq `files/view`
     * ularni bermaydi — imzolangan URL `GET files/:key` (JWT) orqali olinadi.
     */
    proof_files?: string[] | null;
    /** HQ marketga qaytarishni boshlagan (`POST orders/:id/initiate-return`). */
    return_requested?: boolean;
    /** Qaytarish sababi (initiate-return `reason`). */
    return_reason?: string | null;
    /** 6kHnNH9j: manba (eski javobda yo'q — HQ). */
    fulfillment_source?: OrderFulfillmentSource | null;
    warehouse?: OrderWarehouseRef | null;
    createdAt: string;
    updatedAt: string;
    deleted: boolean;
    items: {
        id: string;
        /**
         * Katalogdagi mahsulot id'si. Hamkor (Partner API) buyurtmalarida
         * BO'SH — mahsulot bizning katalogda yo'q, nomi `product_name` da
         * matn bo'lib keladi.
         */
        product_id: string | null;
        product_name?: string | null;
        order_id: string;
        quantity: number;
        createdAt: string;
        updatedAt: string;
        /** Katalog bog'lanishi yo'q bo'lsa kelmaydi — `product_name`ga qarang. */
        product?: {
            id: string;
            name: string;
            image_url?: string | null;
        } | null;
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
    /** `courier_id` yoki pochta kuryeri (`enrichOrders`): faqat {id, name, phone_number}. */
    courier?: {
        id: string;
        name?: string | null;
        phone_number?: string | null;
    } | null;
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
    /** Qidiruvga 1000 tadan ortiq mijoz mos keldi — natija to'liq emas. */
    search_truncated?: boolean;
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
    courier_ids?: string[];
    where_deliver?: DeliveryType | "";
    search?: string;
    start_day?: string;
    end_day?: string;
    fetch_all?: boolean | string;
    sort_by?: "created_at" | "total_price" | "status";
    sort_dir?: "asc" | "desc";
    /** 6kHnNH9j: `WAREHOUSE` — faqat ombordan ketganlar, `HQ` — odatiy oqim. */
    fulfillment_source?: OrderFulfillmentSource;
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
    /**
     * Taklifdan tanlangan va o'zgartirilmagan mavjud mijoz (`GET customers/suggest`, hiqRNhkI). Backend uni
     * qabul qilsa `customer` e'tiborsiz — identity'dagi mijoz kartasi ustidan yozilmaydi; doiradan tashqari
     * bo'lsa `customer` obyekti bo'yicha avvalgidek aniqlanadi.
     */
    customer_id?: string;
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
    /** 6kHnNH9j: manba tanlovi (yuborilmasa — `auto`). Faqat manba bloki ko'rinadigan rollarda yuboriladi. */
    fulfillment?: OrderFulfillmentChoice;
}
