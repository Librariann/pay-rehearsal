import { useState } from "react";
import { requestPayment, type PaymentResult } from "pay-rehearsal";

export function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);

  const checkout = async () => {
    try {
      setIsOpen(true);
      setResult(
        await requestPayment(
          {
            orderId: `ORDER-${Date.now()}`,
            orderName: "React Starter",
            amount: 19_000,
            currency: "KRW",
          },
          {
            result: "success",
            paymentMethods: ["card", "virtual-account", "paypal"],
            theme: { accentColor: "#5b4df5", borderRadius: 22 },
          },
        ),
      );
    } finally {
      setIsOpen(false);
    }
  };

  return (
    <main>
      <section className="checkout-card">
        <span>React example</span>
        <h1>Provider 없이 결제 흐름을 테스트하세요.</h1>
        <p>`requestPayment()`를 호출하면 필요한 순간에 결제창이 열립니다.</p>
        <button type="button" disabled={isOpen} onClick={checkout}>
          {isOpen ? "결제 진행 중" : "테스트 결제창 열기"}
        </button>
        {result && (
          <pre aria-label="결제 결과">{JSON.stringify(result, null, 2)}</pre>
        )}
      </section>
    </main>
  );
}
