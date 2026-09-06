export type Currency = "KRW" | "USD" | "JPY" | "EUR";

export type PaymentMethod =
  | "card"
  | "bank-transfer"
  | "virtual-account"
  | "mobile";

export type CardIssuer =
  | "kb-kookmin"
  | "shinhan"
  | "samsung"
  | "hyundai"
  | "lotte"
  | "hana"
  | "woori"
  | "nh-nonghyup"
  | "bc";

export type BankCode =
  | "kb-kookmin"
  | "shinhan"
  | "woori"
  | "hana"
  | "nh-nonghyup"
  | "ibk"
  | "kakaobank"
  | "tossbank";

export type MockPaymentScenario =
  | "success"
  | "failure"
  | "cancelled"
  | "random";

export interface PaymentRequestOptions {
  /** Mock 어댑터를 사용할 때 이번 결제의 결과만 덮어씁니다. */
  mockResult?: MockPaymentScenario;
  /** 이번 결제창에 표시할 결제수단과 순서입니다. */
  paymentMethods?: readonly PaymentMethod[];
  /** 특정 결제수단으로 고정하고 결제수단 선택 UI를 생략합니다. */
  paymentMethod?: PaymentMethod;
}

export interface PaymentCustomer {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface PaymentRequest {
  orderId: string;
  orderName: string;
  amount: number;
  currency?: Currency;
  customer?: PaymentCustomer;
  metadata?: Record<string, unknown>;
}

export interface PaymentAttempt {
  request: PaymentRequest;
  method: PaymentMethod;
  cardIssuer?: CardIssuer;
  /** 0은 일시불, 2 이상은 할부 개월 수입니다. */
  installmentMonths?: number;
  bank?: BankCode;
  options?: PaymentRequestOptions;
}

interface PaymentResultBase {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  cardIssuer?: CardIssuer;
  installmentMonths?: number;
  bank?: BankCode;
  /** Mock 결과와 실제 PG 결과를 애플리케이션에서 구별하기 위한 값입니다. */
  testMode: boolean;
}

export interface PaymentSuccess extends PaymentResultBase {
  status: "success";
  paymentId: string;
  approvedAt: string;
}

export interface VirtualAccountInfo {
  bank: BankCode;
  accountNumber: string;
  accountHolder: string;
  dueAt: string;
}

export interface PaymentPending extends PaymentResultBase {
  status: "pending";
  paymentId: string;
  pendingReason: "virtual-account-deposit";
  virtualAccount: VirtualAccountInfo;
}

export interface PaymentFailure extends PaymentResultBase {
  status: "failed";
  code: string;
  message: string;
  retryable: boolean;
}

export interface PaymentCancelled extends PaymentResultBase {
  status: "cancelled";
  reason: "user" | "adapter";
}

export type PaymentResult =
  | PaymentSuccess
  | PaymentPending
  | PaymentFailure
  | PaymentCancelled;

export interface PaymentAdapter {
  readonly name: string;
  readonly testMode: boolean;
  pay(attempt: PaymentAttempt, signal: AbortSignal): Promise<PaymentResult>;
}

export interface PaymentTheme {
  accentColor?: string;
  borderRadius?: number;
  fontFamily?: string;
}

export interface PaymentContextValue {
  requestPayment(
    request: PaymentRequest,
    options?: PaymentRequestOptions,
  ): Promise<PaymentResult>;
  isOpen: boolean;
}
