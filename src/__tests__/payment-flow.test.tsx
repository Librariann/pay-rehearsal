import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { createMockPaymentAdapter } from "../adapters/mock";
import { PaymentProvider } from "../components/PaymentProvider";
import { usePayment } from "../components/usePayment";
import type { PaymentRequestOptions, PaymentResult } from "../types";

function Checkout() {
  const { requestPayment } = usePayment();
  const [result, setResult] = useState<PaymentResult | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          setResult(
            await requestPayment({
              orderId: "ORDER-1004",
              orderName: "프로 플랜",
              amount: 29_000,
            }),
          );
        }}
      >
        결제 열기
      </button>
      <output>{result?.status}</output>
    </>
  );
}

function CheckoutWithOptions({ options }: { options: PaymentRequestOptions }) {
  const { requestPayment } = usePayment();

  return (
    <button
      type="button"
      onClick={() =>
        void requestPayment(
          {
            orderId: "ORDER-CONFIG",
            orderName: "결제수단 설정 테스트",
            amount: 10_000,
          },
          options,
        )
      }
    >
      설정 결제 열기
    </button>
  );
}

describe("PaymentProvider 결제 흐름", () => {
  it("결제수단 선택부터 성공 결과 반환까지 처리한다", async () => {
    render(
      <PaymentProvider
        adapter={createMockPaymentAdapter({ delayMs: 0, result: "success" })}
      >
        <Checkout />
      </PaymentProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));
    expect(screen.getByRole("dialog", { name: "결제하기" })).toBeVisible();
    expect(screen.getByText("프로 플랜")).toBeVisible();

    fireEvent.click(screen.getByText("계좌이체"));
    fireEvent.click(screen.getByRole("radio", { name: /KB국민/ }));
    fireEvent.click(
      screen.getByLabelText("주문 내용과 테스트 결제 조건을 확인했습니다."),
    );
    fireEvent.click(screen.getByRole("button", { name: /계좌이체/ }));

    expect(screen.getByText("이체 인증을 완료해 주세요")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "테스트 인증 완료" }));

    expect(
      await screen.findByText("테스트 결제가 완료됐어요"),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() => expect(screen.getByText("success")).toBeVisible());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("닫기 버튼으로 취소 결과를 반환한다", async () => {
    render(
      <PaymentProvider adapter={createMockPaymentAdapter({ delayMs: 0 })}>
        <Checkout />
      </PaymentProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));
    fireEvent.click(screen.getByRole("button", { name: "결제창 닫기" }));

    await waitFor(() => expect(screen.getByText("cancelled")).toBeVisible());
  });

  it("카드 결제는 카드사를 선택해야 진행할 수 있다", () => {
    render(
      <PaymentProvider adapter={createMockPaymentAdapter({ delayMs: 0 })}>
        <Checkout />
      </PaymentProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));
    fireEvent.click(
      screen.getByLabelText("주문 내용과 테스트 결제 조건을 확인했습니다."),
    );

    const payButton = screen.getByRole("button", { name: /테스트 결제/ });
    expect(payButton).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /KB국민/ }));
    expect(payButton).toBeEnabled();
  });

  it("카드사와 할부를 선택한 뒤 카드 인증을 거쳐 승인한다", async () => {
    render(
      <PaymentProvider adapter={createMockPaymentAdapter({ delayMs: 0 })}>
        <Checkout />
      </PaymentProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));
    fireEvent.click(screen.getByRole("radio", { name: /신한/ }));
    fireEvent.change(screen.getByLabelText("할부 선택"), {
      target: { value: "3" },
    });
    fireEvent.click(
      screen.getByLabelText("주문 내용과 테스트 결제 조건을 확인했습니다."),
    );
    fireEvent.click(screen.getByRole("button", { name: /테스트 결제/ }));

    expect(screen.getByText("신한 · 3개월 할부")).toBeVisible();
    expect(screen.getByText("카드사 인증을 완료해 주세요")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "테스트 카드 인증 완료" }),
    );

    expect(
      await screen.findByText("테스트 결제가 완료됐어요"),
    ).toBeVisible();
  });

  it("가상계좌는 계좌를 발급하고 입금 대기 결과를 반환한다", async () => {
    render(
      <PaymentProvider
        adapter={createMockPaymentAdapter({
          delayMs: 0,
          virtualAccountHolder: "테스트상점",
        })}
      >
        <Checkout />
      </PaymentProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));
    fireEvent.click(screen.getByText("가상계좌"));
    fireEvent.click(screen.getByRole("radio", { name: /신한/ }));
    fireEvent.click(
      screen.getByLabelText("가상계좌 발급 조건과 입금기한을 확인했습니다."),
    );
    fireEvent.click(screen.getByRole("button", { name: "가상계좌 발급" }));

    expect(await screen.findByText("가상계좌가 발급됐어요")).toBeVisible();
    expect(screen.getByText("테스트상점")).toBeVisible();
    expect(screen.getByText(/^\d{3}-\d{6}-\d{2}-\d{3}$/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    await waitFor(() => expect(screen.getByText("pending")).toBeVisible());
  });

  it("Provider 설정대로 결제수단 순서와 기본 선택을 적용한다", () => {
    render(
      <PaymentProvider
        adapter={createMockPaymentAdapter({ delayMs: 0 })}
        paymentMethods={["virtual-account", "card"]}
        defaultPaymentMethod="virtual-account"
      >
        <Checkout />
      </PaymentProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));

    const methodGroup = screen.getByRole("group", { name: "결제수단" });
    const methods = within(methodGroup).getAllByRole("radio");
    expect(methods).toHaveLength(2);
    expect(methods[0]).toHaveAccessibleName("가상계좌 계좌 발급 후 입금");
    expect(methods[0]).toBeChecked();
    expect(methods[1]).toHaveAccessibleName("신용·체크카드 모든 카드사");
  });

  it("요청에서 결제수단을 고정하면 선택 UI를 생략한다", () => {
    render(
      <PaymentProvider adapter={createMockPaymentAdapter({ delayMs: 0 })}>
        <CheckoutWithOptions options={{ paymentMethod: "bank-transfer" }} />
      </PaymentProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "설정 결제 열기" }));

    expect(
      screen.queryByRole("group", { name: "결제수단" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "출금 은행 선택" })).toBeVisible();
  });

  it("요청별 결제수단 목록이 Provider 설정을 덮어쓴다", () => {
    render(
      <PaymentProvider
        adapter={createMockPaymentAdapter({ delayMs: 0 })}
        paymentMethods={["card"]}
        defaultPaymentMethod="card"
      >
        <CheckoutWithOptions
          options={{ paymentMethods: ["mobile", "virtual-account"] }}
        />
      </PaymentProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "설정 결제 열기" }));

    const methods = within(
      screen.getByRole("group", { name: "결제수단" }),
    ).getAllByRole("radio");
    expect(methods[0]).toHaveAccessibleName("휴대폰 통신사 결제");
    expect(methods[0]).toBeChecked();
    expect(methods[1]).toHaveAccessibleName("가상계좌 계좌 발급 후 입금");
  });
});
