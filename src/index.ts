import "./styles.css";

export { createMockPaymentAdapter } from "./adapters/mock";
export type { MockPaymentAdapterOptions } from "./adapters/mock";
export { PaymentButton } from "./components/PaymentButton";
export type { PaymentButtonProps } from "./components/PaymentButton";
export { requestPayment } from "./requestPayment";
export type {
  Currency,
  CardIssuer,
  BankCode,
  MockPaymentScenario,
  PaymentAdapter,
  PaymentAttempt,
  PaymentCancelled,
  PaymentCustomer,
  PaymentFailure,
  PaymentMethod,
  PaymentPending,
  PaymentRequest,
  PaymentRequestOptions,
  PaymentResult,
  PaymentSuccess,
  PaymentTheme,
  RequestPaymentOptions,
  VirtualAccountInfo,
} from "./types";
