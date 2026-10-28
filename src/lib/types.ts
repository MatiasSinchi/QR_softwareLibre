export type PaymentStatus = "pendiente" | "pagado";
export type DeliveryStatus = "pendiente" | "entregado";

export interface Combo {
  id: string;
  name: string;
  price: number;
  active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  short_code: string;
  coupon_token: string | null;
  buyer_name: string;
  buyer_contact: string | null;
  combo_id: string;
  combo_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  payment_status: PaymentStatus;
  paid_at: string | null;
  delivery_status: DeliveryStatus;
  delivered_at: string | null;
  created_at: string;
}

export interface AdminStats {
  total_orders: number;
  paid_orders: number;
  pending_payment_orders: number;
  pending_delivery_orders: number;
  delivered_orders: number;
  total_collected: number;
}
