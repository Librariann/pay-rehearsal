# Pay Rehearsal React

[English](https://github.com/Librariann/pay-rehearsal/blob/main/README.md)

React와 Next.js에서 함수 하나로 테스트 결제창을 여는 TypeScript Mock 결제 UI SDK입니다. Provider, 훅, 결제사 인증정보, 별도의 CSS import가 필요하지 않습니다.

> Pay Rehearsal은 실제 승인이나 청구를 수행하지 않고 실제 카드정보도 수집하지 않습니다. 운영 환경에서는 결제사가 제공하는 공식 SDK와 서버 측 결제 검증으로 반드시 교체해야 합니다.

## 제공 기능

- 호출 시 모달을 자동으로 마운트하고 정리하는 `requestPayment()` API
- React Provider와 별도 스타일시트 import가 필요 없는 구성
- 카드, 계좌이체, 가상계좌, 휴대폰 및 PayPal 방식의 결제 흐름
- 성공, 실패, 취소, 입금 대기 및 무작위 시나리오
- 카드사, 할부 개월 및 은행 선택
- PayPal 방식의 주문 생성, 구매자 승인 및 결제 캡처 단계
- 포커스 트랩, Escape 닫기, 스크롤 잠금 및 포커스 복원
- Promise 기반 타입 안전 결과값
- 테마와 결제수단 노출 순서 설정
- React 18/19 및 Next.js App Router 지원

## 설치

```bash
npm install pay-rehearsal
```

패키지를 import하면 필요한 스타일도 자동으로 적용됩니다.

## React에서 사용하기

브라우저 이벤트 핸들러에서 `requestPayment()`를 호출합니다. 라이브러리가 필요한 순간에 결제 모달을 마운트하고 완료 후 자동으로 제거합니다.

```tsx
import { useState } from "react";
import { requestPayment, type PaymentResult } from "pay-rehearsal";

export function CheckoutButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);

  const checkout = async () => {
    try {
      setIsOpen(true);
      setResult(
        await requestPayment(
          {
            orderId: `ORDER-${Date.now()}`,
            orderName: "프로 플랜 1개월",
            amount: 29_000,
            currency: "KRW",
            customer: { email: "developer@example.com" },
          },
          {
            result: "success",
            paymentMethods: ["card", "virtual-account", "paypal"],
            theme: { accentColor: "#4f46e5", borderRadius: 24 },
          },
        ),
      );
    } finally {
      setIsOpen(false);
    }
  };

  return (
    <>
      <button type="button" disabled={isOpen} onClick={checkout}>
        결제하기
      </button>
      {result && <output>{result.status}</output>}
    </>
  );
}
```

전체 Vite 예제는 다음과 같이 실행합니다.

```bash
cd examples/react
npm install
npm run dev
```

## Next.js App Router에서 사용하기

`requestPayment()`는 브라우저 전용 API입니다. Client Component에서 호출하면 되며 루트 레이아웃을 Provider로 감쌀 필요가 없습니다.

```tsx
// app/checkout-button.tsx
"use client";

import { requestPayment } from "pay-rehearsal";

export function CheckoutButton() {
  const checkout = async () => {
    const result = await requestPayment(
      {
        orderId: `ORDER-${Date.now()}`,
        orderName: "글로벌 프로 플랜",
        amount: 29,
        currency: "USD",
      },
      {
        result: "success",
        paymentMethod: "paypal",
      },
    );

    if (result.status === "success") {
      console.log(result.paymentId, result.approvedAt);
    }
  };

  return <button onClick={checkout}>테스트 결제창 열기</button>;
}
```

전체 Next.js 예제는 다음과 같이 실행합니다.

```bash
cd examples/nextjs
npm install
npm run dev
```

## 호출 API

```ts
const result = await requestPayment(payment, options);
```

### 결제 요청

```ts
const payment = {
  orderId: "ORDER-1001",
  orderName: "프로 플랜",
  amount: 29_000,
  currency: "KRW",
  customer: {
    id: "USER-42",
    name: "홍길동",
    email: "developer@example.com",
  },
  metadata: { planId: "pro-monthly" },
};
```

지원 통화는 `KRW`, `USD`, `JPY`, `EUR`입니다.

### 옵션

```ts
requestPayment(payment, {
  result: "failure",
  delayMs: 1_200,
  failureCode: "CARD_DECLINED",
  failureMessage: "카드 승인이 거절되었습니다.",
  paymentMethods: ["card", "bank-transfer", "virtual-account", "paypal"],
  defaultPaymentMethod: "card",
  theme: {
    accentColor: "#4f46e5",
    borderRadius: 24,
    fontFamily: "Pretendard, sans-serif",
  },
});
```

| 옵션 | 설명 |
| --- | --- |
| `result` | `success`, `failure`, `cancelled`, `random` 중 하나 |
| `delayMs` | Mock 어댑터의 처리 지연 시간 |
| `paymentMethods` | 화면에 표시할 결제수단과 표시 순서 |
| `defaultPaymentMethod` | 처음 선택할 결제수단 |
| `paymentMethod` | 결제수단을 하나로 고정하고 선택 화면 생략 |
| `randomSuccessRate` | `random` 시나리오의 성공 확률 |
| `virtualAccountHolder` | 테스트 가상계좌 예금주 |
| `virtualAccountDueHours` | 테스트 가상계좌 입금기한 |
| `theme` | 강조 색상, 모서리 및 글꼴 설정 |
| `adapter` | 선택적으로 사용할 커스텀 `PaymentAdapter` |

한 번에 하나의 결제창만 열 수 있습니다. 결제가 진행 중일 때 다시 호출하면 Promise가 reject됩니다.

## 반환값

`requestPayment()`는 `status`로 구분되는 `PaymentResult`를 반환합니다.

```ts
const result = await requestPayment(payment);

switch (result.status) {
  case "success":
    console.log(result.paymentId, result.approvedAt);
    break;
  case "pending":
    console.log(result.virtualAccount, result.pendingReason);
    break;
  case "failed":
    console.log(result.code, result.message, result.retryable);
    break;
  case "cancelled":
    console.log(result.reason);
    break;
}
```

모든 결과에는 `orderId`, `amount`, `method`, `testMode`가 포함됩니다. 선택한 결제수단에 따라 `cardIssuer`, `installmentMonths`, `bank`도 포함됩니다.

테스트 시나리오 설정값은 `failure`지만 반환되는 상태값은 `failed`라는 점에 주의하세요.

## 백엔드로 결과 보내기

결제 요청과 결과를 JSON으로 일반 백엔드 API에 전송합니다. 이 예제는 특정 DB나 ORM에 의존하지 않습니다.

```ts
const result = await requestPayment(payment, { result: "success" });

await fetch("/api/payments", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ payment, result }),
});
```

테스트 레코드는 `testMode: true`로 명확히 구분하세요. `PaymentResult`에는 `orderName`, `currency`, `customer`, `metadata`가 반복해서 포함되지 않으므로 해당 값이 필요하면 원래 요청 객체를 결과와 함께 저장해야 합니다.

운영 환경에서는 브라우저가 반환한 결과를 신뢰하면 안 됩니다. 서버에서 실제 결제사를 통해 주문번호, 금액, 통화, 승인 상태와 웹훅 서명을 검증해야 합니다.

## PayPal 흐름 테스트하기

개별 결제를 PayPal로 고정할 수 있습니다.

```ts
const result = await requestPayment(
  {
    orderId: "ORDER-PAYPAL-1001",
    orderName: "글로벌 프로 플랜",
    amount: 29,
    currency: "USD",
  },
  { paymentMethod: "paypal" },
);
```

모달은 다음 단계를 재현합니다.

1. Mock PayPal 주문 생성
2. 구매자 승인
3. 결제 캡처와 검증
4. 설정된 최종 결과 반환

실제 PayPal SDK를 불러오지 않으며 인증정보나 실제 금액도 사용하지 않습니다. 운영 환경에서는 서버에서 PayPal 주문을 생성하고 캡처한 뒤 최종 상태를 검증해야 합니다.

## PaymentButton

선택적으로 제공하는 `PaymentButton`도 Provider 없이 사용할 수 있습니다.

```tsx
import { PaymentButton } from "pay-rehearsal";

<PaymentButton
  request={{
    orderId: "ORDER-1001",
    orderName: "프로 플랜",
    amount: 29_000,
  }}
  options={{ result: "success" }}
  onResult={(result) => console.log(result)}
>
  29,000원 결제하기
</PaymentButton>;
```

## 운영 전 확인사항

- 카드번호, 비밀번호 또는 신원정보를 이 UI에서 수집하거나 저장하지 마세요.
- 서버에서 생성한 고유한 `orderId`를 사용하세요.
- 서버에서 예상 금액과 최종 승인 상태를 검증하세요.
- 중복 승인을 막기 위해 결제 승인 API에 멱등성을 적용하세요.
- 모의 인증 화면을 결제사의 공식 결제 화면으로 교체하세요.
- Mock 결과로 운영 주문을 변경할 수 없도록 분리하세요.

## 개발 명령어

```bash
npm install
npm run typecheck
npm test
npm run build
```

## 고지

Pay Rehearsal은 어떠한 PG사, 카드사 또는 금융기관에서 제공하거나 후원하거나 보증하는 제품이 아닙니다. 금융기관명은 모의 결제 흐름을 설명하기 위한 용도로만 사용됩니다.
