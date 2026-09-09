"use client";

import { useState } from "react";
import { requestPayment, type PaymentResult } from "pay-rehearsal";

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);

  const checkout = async () => {
    try {
      setIsOpen(true);
      setResult(
        await requestPayment(
          {
            orderId: `ORDER-${Date.now()}`,
            orderName: "Pay Rehearsal Pro · 1개월",
            amount: 29_000,
            currency: "KRW",
            customer: { email: "developer@example.com" },
          },
          {
            result: "success",
            delayMs: 1_200,
            paymentMethods: [
              "card",
              "bank-transfer",
              "virtual-account",
              "mobile",
              "paypal",
            ],
            theme: { accentColor: "#5b4df5" },
          },
        ),
      );
    } finally {
      setIsOpen(false);
    }
  };

  return (
    <main>
      <div className="demo-layout">
        <section className="checkout-card">
          <span className="chip">개발용 결제 환경</span>
          <h1>
            PG 승인 전에도
            <br />
            결제 흐름은 완성하세요.
          </h1>
          <p>
            실제 카드정보나 청구 없이 주문, 결제수단 선택, 로딩과 결과 처리를
            미리 개발할 수 있습니다.
          </p>

          <div className="product">
            <div>
              <small>결제 상품</small>
              <strong>Pay Rehearsal Pro · 1개월</strong>
            </div>
            <strong>₩29,000</strong>
          </div>

          <button className="checkout-button" disabled={isOpen} onClick={checkout}>
            테스트 결제창 열기
          </button>
          {result && (
            <p role="status">
              결과: <strong>{result.status}</strong> · {result.orderId}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
