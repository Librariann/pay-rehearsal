import { describe, expect, it } from "vitest";

import { createMockPaymentAdapter } from "../adapters/mock";
import type { PaymentAttempt } from "../types";

const attempt: PaymentAttempt = {
  request: {
    orderId: "ORDER-1",
    orderName: "테스트 상품",
    amount: 29_000,
  },
  method: "card",
};

describe("createMockPaymentAdapter", () => {
  it("성공 시나리오에서 식별 가능한 테스트 결과를 반환한다", async () => {
    const adapter = createMockPaymentAdapter({
      result: "success",
      delayMs: 0,
    });

    const result = await adapter.pay(attempt, new AbortController().signal);

    expect(result).toMatchObject({
      status: "success",
      orderId: "ORDER-1",
      amount: 29_000,
      method: "card",
      testMode: true,
    });
    if (result.status === "success") {
      expect(result.paymentId).toMatch(/^mock_/);
    }
  });

  it("실패 시나리오를 결정적으로 재현한다", async () => {
    const adapter = createMockPaymentAdapter({
      result: "failure",
      delayMs: 0,
      failureCode: "CARD_DECLINED",
    });

    const result = await adapter.pay(attempt, new AbortController().signal);

    expect(result).toMatchObject({
      status: "failed",
      code: "CARD_DECLINED",
      retryable: true,
    });
  });

  it("호출자가 취소하면 대기 중인 결제를 중단한다", async () => {
    const adapter = createMockPaymentAdapter({ delayMs: 1_000 });
    const controller = new AbortController();
    const payment = adapter.pay(attempt, controller.signal);

    controller.abort();

    await expect(payment).rejects.toMatchObject({ name: "AbortError" });
  });

  it("개별 결제 매개변수로 Provider의 기본 결과를 덮어쓴다", async () => {
    const adapter = createMockPaymentAdapter({ result: "failure", delayMs: 0 });
    const result = await adapter.pay(
      { ...attempt, options: { mockResult: "success" } },
      new AbortController().signal,
    );

    expect(result.status).toBe("success");
  });

  it("선택한 카드사를 결제 결과에 포함한다", async () => {
    const adapter = createMockPaymentAdapter({ result: "success", delayMs: 0 });
    const result = await adapter.pay(
      { ...attempt, cardIssuer: "kb-kookmin", installmentMonths: 3 },
      new AbortController().signal,
    );

    expect(result).toMatchObject({
      status: "success",
      method: "card",
      cardIssuer: "kb-kookmin",
      installmentMonths: 3,
    });
  });

  it("가상계좌는 결제 완료가 아닌 입금 대기 결과를 반환한다", async () => {
    const adapter = createMockPaymentAdapter({
      result: "success",
      delayMs: 0,
      virtualAccountHolder: "테스트상점",
      virtualAccountDueHours: 12,
    });
    const result = await adapter.pay(
      { ...attempt, method: "virtual-account", bank: "shinhan" },
      new AbortController().signal,
    );

    expect(result).toMatchObject({
      status: "pending",
      method: "virtual-account",
      bank: "shinhan",
      pendingReason: "virtual-account-deposit",
      virtualAccount: {
        bank: "shinhan",
        accountHolder: "테스트상점",
      },
    });
  });

  it("PayPal 결제수단을 성공 결과에 포함한다", async () => {
    const adapter = createMockPaymentAdapter({ result: "success", delayMs: 0 });
    const result = await adapter.pay(
      { ...attempt, method: "paypal" },
      new AbortController().signal,
    );

    expect(result).toMatchObject({
      status: "success",
      method: "paypal",
      testMode: true,
    });
  });
});
