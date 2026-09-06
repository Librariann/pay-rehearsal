import type {
  PaymentAdapter,
  PaymentAttempt,
  PaymentFailure,
  PaymentResult,
  PaymentSuccess,
  MockPaymentScenario,
} from "../types";

export interface MockPaymentAdapterOptions {
  /** @deprecated Use `result` instead. */
  scenario?: MockPaymentScenario;
  /** Default Mock outcome for payments without a request-level override. */
  result?: MockPaymentScenario;
  delayMs?: number;
  failureCode?: string;
  failureMessage?: string;
  randomSuccessRate?: number;
  virtualAccountDueHours?: number;
  virtualAccountHolder?: string;
}

function wait(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Payment was aborted", "AbortError"));
      return;
    }

    const timeoutId = globalThis.setTimeout(resolve, delayMs);

    signal.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timeoutId);
        reject(new DOMException("Payment was aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `mock_${crypto.randomUUID()}`;
  }

  return `mock_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** A controllable payment adapter intended for development and testing only. */
export function createMockPaymentAdapter(
  options: MockPaymentAdapterOptions = {},
): PaymentAdapter {
  const {
    scenario,
    result = scenario ?? "success",
    delayMs = 900,
    failureCode = "MOCK_PAYMENT_FAILED",
    failureMessage = "테스트 결제가 실패하도록 설정되었습니다.",
    randomSuccessRate = 0.8,
    virtualAccountDueHours = 24,
    virtualAccountHolder = "페이리허설",
  } = options;

  return {
    name: "Pay Rehearsal Mock",
    testMode: true,
    async pay(
      {
        request,
        method,
        cardIssuer,
        installmentMonths,
        bank,
        options: requestOptions,
      }: PaymentAttempt,
      signal: AbortSignal,
    ): Promise<PaymentResult> {
      await wait(delayMs, signal);

      const requestedResult = requestOptions?.mockResult ?? result;
      const resolvedScenario =
        requestedResult === "random"
          ? Math.random() < randomSuccessRate
            ? "success"
            : "failure"
          : requestedResult;

      if (resolvedScenario === "cancelled") {
        return {
          status: "cancelled",
          orderId: request.orderId,
          amount: request.amount,
          method,
          cardIssuer,
          installmentMonths,
          bank,
          testMode: true,
          reason: "adapter",
        };
      }

      if (resolvedScenario === "failure") {
        const failure: PaymentFailure = {
          status: "failed",
          orderId: request.orderId,
          amount: request.amount,
          method,
          cardIssuer,
          installmentMonths,
          bank,
          testMode: true,
          code: failureCode,
          message: failureMessage,
          retryable: true,
        };
        return failure;
      }

      if (method === "virtual-account") {
        if (!bank) {
          return {
            status: "failed",
            orderId: request.orderId,
            amount: request.amount,
            method,
            testMode: true,
            code: "BANK_REQUIRED",
            message: "가상계좌를 발급할 은행을 선택해 주세요.",
            retryable: true,
          };
        }

        const dueAt = new Date(
          Date.now() + virtualAccountDueHours * 60 * 60 * 1_000,
        ).toISOString();
        const accountDigits = Array.from({ length: 14 }, () =>
          Math.floor(Math.random() * 10),
        ).join("");
        const accountNumber = `${accountDigits.slice(0, 3)}-${accountDigits.slice(3, 9)}-${accountDigits.slice(9, 11)}-${accountDigits.slice(11)}`;

        return {
          status: "pending",
          orderId: request.orderId,
          amount: request.amount,
          method,
          bank,
          testMode: true,
          paymentId: createId(),
          pendingReason: "virtual-account-deposit",
          virtualAccount: {
            bank,
            accountNumber,
            accountHolder: virtualAccountHolder,
            dueAt,
          },
        };
      }

      const success: PaymentSuccess = {
        status: "success",
        orderId: request.orderId,
        amount: request.amount,
        method,
        cardIssuer,
        installmentMonths,
        bank,
        testMode: true,
        paymentId: createId(),
        approvedAt: new Date().toISOString(),
      };
      return success;
    },
  };
}
