import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { requestPayment } from "../requestPayment";
import type { PaymentResult, RequestPaymentOptions } from "../types";

function Checkout({ options }: { options?: RequestPaymentOptions }) {
  const [result, setResult] = useState<PaymentResult | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          setResult(
            await requestPayment(
              {
                orderId: "ORDER-1004",
                orderName: "프로 플랜",
                amount: 29_000,
              },
              options,
            ),
          );
        }}
      >
        결제 열기
      </button>
      <output>{result?.status}</output>
    </>
  );
}

describe("requestPayment 결제 흐름", () => {
  it("결제수단 선택부터 성공 결과 반환까지 처리한다", async () => {
    render(<Checkout options={{ delayMs: 0, result: "success" }} />);
    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));
    expect(await screen.findByRole("dialog", { name: "결제하기" })).toBeVisible();
    expect(screen.getByText("프로 플랜")).toBeVisible();

    fireEvent.click(screen.getByText("계좌이체"));
    fireEvent.click(screen.getByRole("radio", { name: /KB국민/ }));
    fireEvent.click(screen.getByLabelText("주문 내용과 테스트 결제 조건을 확인했습니다."));
    fireEvent.click(screen.getByRole("button", { name: /계좌이체/ }));
    fireEvent.click(screen.getByRole("button", { name: "테스트 인증 완료" }));
    expect(await screen.findByText("테스트 결제가 완료됐어요")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() => expect(screen.getByText("success")).toBeVisible());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("닫기 버튼으로 취소 결과를 반환한다", async () => {
    render(<Checkout options={{ delayMs: 0 }} />);
    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));
    fireEvent.click(await screen.findByRole("button", { name: "결제창 닫기" }));
    await waitFor(() => expect(screen.getByText("cancelled")).toBeVisible());
  });

  it("모달 안에서 포커스를 순환시키고 닫힌 뒤 실행 버튼으로 복원한다", async () => {
    render(<Checkout options={{ delayMs: 0 }} />);
    const trigger = screen.getByRole("button", { name: "결제 열기" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "결제하기" });
    const closeButton = screen.getByRole("button", { name: "결제창 닫기" });
    await waitFor(() => expect(closeButton).toHaveFocus());
    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.tabIndex >= 0);
    const lastElement = focusableElements[focusableElements.length - 1];

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(lastElement).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(closeButton).toHaveFocus();
    fireEvent.click(closeButton);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("카드 결제는 카드사를 선택해야 진행할 수 있다", async () => {
    render(<Checkout options={{ delayMs: 0 }} />);
    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));
    await screen.findByRole("dialog", { name: "결제하기" });
    fireEvent.click(screen.getByLabelText("주문 내용과 테스트 결제 조건을 확인했습니다."));
    const payButton = screen.getByRole("button", { name: /테스트 결제/ });
    expect(payButton).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /KB국민/ }));
    expect(payButton).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "결제창 닫기" }));
    await waitFor(() => expect(screen.getByText("cancelled")).toBeVisible());
  });

  it("카드사와 할부를 선택한 뒤 카드 인증을 거쳐 승인한다", async () => {
    render(<Checkout options={{ delayMs: 0 }} />);
    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));
    await screen.findByRole("dialog", { name: "결제하기" });
    fireEvent.click(screen.getByRole("radio", { name: /신한/ }));
    fireEvent.change(screen.getByLabelText("할부 선택"), { target: { value: "3" } });
    fireEvent.click(screen.getByLabelText("주문 내용과 테스트 결제 조건을 확인했습니다."));
    fireEvent.click(screen.getByRole("button", { name: /테스트 결제/ }));
    expect(screen.getByText("신한 · 3개월 할부")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "테스트 카드 인증 완료" }));
    expect(await screen.findByText("테스트 결제가 완료됐어요")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    await waitFor(() => expect(screen.getByText("success")).toBeVisible());
  });

  it("가상계좌는 계좌를 발급하고 입금 대기 결과를 반환한다", async () => {
    render(<Checkout options={{ delayMs: 0, virtualAccountHolder: "테스트상점" }} />);
    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));
    await screen.findByRole("dialog", { name: "결제하기" });
    fireEvent.click(screen.getByText("가상계좌"));
    fireEvent.click(screen.getByRole("radio", { name: /신한/ }));
    fireEvent.click(screen.getByLabelText("가상계좌 발급 조건과 입금기한을 확인했습니다."));
    fireEvent.click(screen.getByRole("button", { name: "가상계좌 발급" }));
    expect(await screen.findByText("가상계좌가 발급됐어요")).toBeVisible();
    expect(screen.getByText("테스트상점")).toBeVisible();
    expect(screen.getByText(/^\d{3}-\d{6}-\d{2}-\d{3}$/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    await waitFor(() => expect(screen.getByText("pending")).toBeVisible());
  });

  it("PayPal 사용자 승인을 거쳐 성공 결과를 반환한다", async () => {
    render(<Checkout options={{ delayMs: 0, result: "success", paymentMethod: "paypal" }} />);
    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));
    const dialog = await screen.findByRole("dialog", { name: "결제하기" });
    expect(dialog.parentElement).toHaveAttribute("data-payment-method", "paypal");
    fireEvent.click(screen.getByLabelText("주문 내용과 테스트 결제 조건을 확인했습니다."));
    fireEvent.click(screen.getByRole("button", { name: "PayPal로 결제" }));
    expect(await screen.findByText("PayPal에서 결제를 승인해 주세요")).toBeVisible();
    expect(screen.getByText(/^Order ID · PAYPAL-MOCK-/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "테스트 PayPal 승인 완료" }));
    expect(await screen.findByText("테스트 결제가 완료됐어요")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    await waitFor(() => expect(screen.getByText("success")).toBeVisible());
  });

  it("호출 옵션대로 결제수단 순서와 기본 선택을 적용한다", async () => {
    render(
      <Checkout
        options={{
          delayMs: 0,
          paymentMethods: ["virtual-account", "card"],
          defaultPaymentMethod: "virtual-account",
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));
    const methodGroup = await screen.findByRole("group", { name: "결제수단" });
    const methods = within(methodGroup).getAllByRole("radio");
    expect(methods).toHaveLength(2);
    expect(methods[0]).toHaveAccessibleName("가상계좌 계좌 발급 후 입금");
    expect(methods[0]).toBeChecked();
    expect(methods[1]).toHaveAccessibleName("신용·체크카드 모든 카드사");
    fireEvent.click(screen.getByRole("button", { name: "결제창 닫기" }));
    await waitFor(() => expect(screen.getByText("cancelled")).toBeVisible());
  });

  it("paymentMethod로 결제수단을 고정하면 선택 UI를 생략한다", async () => {
    render(<Checkout options={{ delayMs: 0, paymentMethod: "bank-transfer" }} />);
    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));
    await screen.findByRole("dialog", { name: "결제하기" });
    expect(screen.queryByRole("group", { name: "결제수단" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "출금 은행 선택" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "결제창 닫기" }));
    await waitFor(() => expect(screen.getByText("cancelled")).toBeVisible());
  });

  it("진행 중에 다시 호출하면 중복 결제를 거부한다", async () => {
    render(<Checkout options={{ delayMs: 0 }} />);
    fireEvent.click(screen.getByRole("button", { name: "결제 열기" }));
    await screen.findByRole("dialog", { name: "결제하기" });
    await expect(
      requestPayment({
        orderId: "ORDER-DUPLICATE",
        orderName: "중복 결제",
        amount: 1_000,
      }),
    ).rejects.toThrow("이미 진행 중인 결제가 있습니다");
    fireEvent.click(screen.getByRole("button", { name: "결제창 닫기" }));
    await waitFor(() => expect(screen.getByText("cancelled")).toBeVisible());
  });
});
