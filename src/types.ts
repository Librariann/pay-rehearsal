export type Currency = "KRW" | "USD" | "JPY" | "EUR";

export type PaymentMethod =
  | "card"
  | "bank-transfer"
  | "virtual-account"
  | "mobile"
  | "paypal";

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
  /** Overrides the outcome of this payment when using the Mock adapter. */
  mockResult?: MockPaymentScenario;
  /** Payment methods to display for this payment, in display order. */
  paymentMethods?: readonly PaymentMethod[];
  /** Locks this payment to one method and skips the method selection UI. */
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
  /** 0 means a one-time payment; values of 2 or more are installment months. */
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
  /** Distinguishes Mock results from real payment gateway results. */
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

export interface RequestPaymentOptions extends PaymentRequestOptions {
  /** Default Mock outcome for this payment. */
  result?: MockPaymentScenario;
  delayMs?: number;
  failureCode?: string;
  failureMessage?: string;
  randomSuccessRate?: number;
  virtualAccountDueHours?: number;
  virtualAccountHolder?: string;
  /** Payment method selected when the checkout modal first opens. */
  defaultPaymentMethod?: PaymentMethod;
  theme?: PaymentTheme;
  /** Uses a custom adapter instead of the built-in Mock adapter. */
  adapter?: PaymentAdapter;
}
