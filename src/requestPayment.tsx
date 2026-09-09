"use client";

import { createRoot, type Root } from "react-dom/client";

import { createMockPaymentAdapter } from "./adapters/mock";
import { PaymentModal } from "./components/PaymentModal";
import type {
  PaymentMethod,
  PaymentRequest,
  PaymentRequestOptions,
  PaymentResult,
  RequestPaymentOptions,
} from "./types";

const ALL_PAYMENT_METHODS: readonly PaymentMethod[] = [
  "card",
  "bank-transfer",
  "virtual-account",
  "mobile",
  "paypal",
];

const PAYMENT_METHOD_SET = new Set<PaymentMethod>(ALL_PAYMENT_METHODS);
let activePayment = false;

function normalizePaymentMethods(
  methods: readonly PaymentMethod[],
): PaymentMethod[] {
  const normalized = [...new Set(methods)].filter((method) =>
    PAYMENT_METHOD_SET.has(method),
  );

  if (normalized.length === 0) {
    throw new Error("paymentMethods에는 하나 이상의 결제수단이 필요합니다.");
  }

  return normalized;
}

function validateRequest(request: PaymentRequest) {
  if (!request.orderId.trim()) throw new Error("orderId는 필수입니다.");
  if (!request.orderName.trim()) throw new Error("orderName은 필수입니다.");
  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    throw new Error("amount는 0보다 큰 유한한 숫자여야 합니다.");
  }
}

function cleanup(root: Root, container: HTMLElement) {
  root.unmount();
  container.remove();
  activePayment = false;
}

/** Opens a Mock checkout modal and resolves with its final result. */
export function requestPayment(
  request: PaymentRequest,
  options: RequestPaymentOptions = {},
): Promise<PaymentResult> {
  if (typeof document === "undefined" || !document.body) {
    return Promise.reject(
      new Error("requestPayment는 브라우저의 사용자 이벤트 안에서 호출해야 합니다."),
    );
  }

  try {
    validateRequest(request);
  } catch (error) {
    return Promise.reject(error);
  }

  if (activePayment) {
    return Promise.reject(
      new Error("이미 진행 중인 결제가 있습니다. 현재 결제를 먼저 완료해 주세요."),
    );
  }

  let paymentMethods: PaymentMethod[];
  try {
    paymentMethods = options.paymentMethod
      ? normalizePaymentMethods([options.paymentMethod])
      : normalizePaymentMethods(options.paymentMethods ?? ALL_PAYMENT_METHODS);

    if (
      options.defaultPaymentMethod &&
      !paymentMethods.includes(options.defaultPaymentMethod)
    ) {
      throw new Error(
        "defaultPaymentMethod는 paymentMethods에 포함된 결제수단이어야 합니다.",
      );
    }
  } catch (error) {
    return Promise.reject(error);
  }

  const initialPaymentMethod =
    options.paymentMethod ?? options.defaultPaymentMethod ?? paymentMethods[0];
  const adapter =
    options.adapter ??
    createMockPaymentAdapter({
      result: options.result,
      delayMs: options.delayMs,
      failureCode: options.failureCode,
      failureMessage: options.failureMessage,
      randomSuccessRate: options.randomSuccessRate,
      virtualAccountDueHours: options.virtualAccountDueHours,
      virtualAccountHolder: options.virtualAccountHolder,
    });
  const requestOptions: PaymentRequestOptions = {
    mockResult: options.mockResult,
    paymentMethods: options.paymentMethods,
    paymentMethod: options.paymentMethod,
  };
  const container = document.createElement("div");
  container.dataset.payRehearsalRoot = "";
  document.body.appendChild(container);
  const root = createRoot(container);
  activePayment = true;

  return new Promise((resolve) => {
    const complete = (result: PaymentResult) => {
      queueMicrotask(() => {
        cleanup(root, container);
        resolve(result);
      });
    };

    root.render(
      <PaymentModal
        adapter={adapter}
        request={request}
        options={requestOptions}
        paymentMethods={paymentMethods}
        initialPaymentMethod={initialPaymentMethod}
        isPaymentMethodLocked={options.paymentMethod !== undefined}
        theme={options.theme}
        onComplete={complete}
      />,
    );
  });
}
