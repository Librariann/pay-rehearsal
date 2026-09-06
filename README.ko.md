# Pay Rehearsal React

PG사 계약과 심사를 기다리는 동안에도 주문부터 결제 완료까지의 화면과 로직을 개발할 수 있는 React/Next.js용 TypeScript 결제 UI SDK입니다.

> 이 패키지의 Mock 어댑터는 실제 승인, 청구, 카드정보 수집을 수행하지 않습니다. 운영 환경에서는 반드시 실제 PG 어댑터와 서버 측 결제 검증을 연결해야 합니다.

## 제공 기능

- 반응형 결제 모달과 접근성 기본 지원
- 카드, 계좌이체, 가상계좌, 휴대폰 결제 UI
- KB국민, 신한, 삼성, 현대, 롯데, 하나, 우리, NH농협, BC 카드사 선택
- 일시불·할부 선택과 카드사 인증 단계 시뮬레이션
- 주요 은행 선택과 계좌이체 인증 단계 시뮬레이션
- 가상계좌 발급 정보와 입금 대기(`pending`) 결과
- 성공, 실패, 취소, 무작위 시나리오
- Promise 기반 `requestPayment()` API
- 미리 구성된 `PaymentButton`
- 실제 PG 구현으로 교체 가능한 `PaymentAdapter` 인터페이스
- 색상, 모서리, 글꼴 테마 설정
- React 18/19 및 Next.js App Router 호환

## 설치

로컬에서 패키지를 빌드한 뒤 애플리케이션에 연결합니다.

```bash
npm install
npm run build
```

다른 프로젝트에서 로컬 패키지를 설치하는 경우:

```bash
npm install /absolute/path/to/pay-rehearsal
```

## Next.js App Router에서 사용하기

루트 레이아웃에서 스타일을 한 번 가져옵니다.

```tsx
// app/layout.tsx
import "pay-rehearsal/styles.css";
```

클라이언트 Provider를 만듭니다.

```tsx
// app/payment-provider.tsx
"use client";

import {
  MockPaymentProvider,
} from "pay-rehearsal";
import type { ReactNode } from "react";

export function AppPaymentProvider({ children }: { children: ReactNode }) {
  return (
    <MockPaymentProvider
      result="success"
      delayMs={900}
      paymentMethods={["card", "bank-transfer", "virtual-account"]}
      defaultPaymentMethod="card"
      theme={{ accentColor: "#4f46e5", borderRadius: 24 }}
    >
      {children}
    </MockPaymentProvider>
  );
}
```

루트 레이아웃에서 Provider를 연결합니다.

```tsx
// app/layout.tsx
import "pay-rehearsal/styles.css";
import { AppPaymentProvider } from "./payment-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AppPaymentProvider>{children}</AppPaymentProvider>
      </body>
    </html>
  );
}
```

결제가 필요한 클라이언트 컴포넌트에서 호출합니다.

```tsx
"use client";

import { usePayment } from "pay-rehearsal";

export function CheckoutButton() {
  const { requestPayment, isOpen } = usePayment();

  const checkout = async () => {
    const result = await requestPayment({
      orderId: `ORDER-${Date.now()}`,
      orderName: "프로 플랜 1개월",
      amount: 29_000,
      currency: "KRW",
      customer: { email: "developer@example.com" },
    });

    if (result.status === "success") {
      console.log(result.paymentId, result.testMode);
    }

    if (result.status === "pending") {
      // 가상계좌는 발급 시점에 결제가 완료되지 않습니다.
      console.log(result.virtualAccount);
    }
  };

  return (
    <button type="button" disabled={isOpen} onClick={checkout}>
      결제하기
    </button>
  );
}
```

간단한 경우에는 `PaymentButton`을 사용할 수도 있습니다.

```tsx
<PaymentButton
  request={{
    orderId: "ORDER-1001",
    orderName: "프로 플랜",
    amount: 29_000,
  }}
  onResult={(result) => console.log(result)}
>
  29,000원 결제하기
</PaymentButton>
```

## 결제수단 노출과 순서 설정

Provider의 `paymentMethods`로 결제창에 표시할 수단과 순서를 정할 수 있습니다. 생략하면 카드, 계좌이체, 가상계좌, 휴대폰을 모두 표시합니다.

```tsx
<MockPaymentProvider
  paymentMethods={["virtual-account", "card"]}
  defaultPaymentMethod="virtual-account"
>
  {children}
</MockPaymentProvider>
```

특정 결제에서만 목록을 바꾸려면 `requestPayment`의 두 번째 매개변수로 덮어씁니다.

```ts
requestPayment(order, {
  paymentMethods: ["card", "bank-transfer"],
});
```

결제수단을 하나로 고정하면 결제수단 선택 UI를 생략하고 해당 수단의 상세 단계부터 시작합니다.

```ts
requestPayment(order, {
  paymentMethod: "card",
});
```

설정 우선순위는 요청별 `paymentMethod` → 요청별 `paymentMethods` → Provider의 `paymentMethods`이며, 배열의 순서가 화면 표시 순서가 됩니다. 실제 운영에서는 UI 노출 여부와 별개로 서버에서도 계약된 결제수단인지 검증해야 합니다.

## 테스트 시나리오

```ts
<MockPaymentProvider result="success">...</MockPaymentProvider>
<MockPaymentProvider result="failure">...</MockPaymentProvider>
<MockPaymentProvider result="cancelled">...</MockPaymentProvider>
<MockPaymentProvider result="random" randomSuccessRate={0.7}>...</MockPaymentProvider>
```

실패 코드와 지연 시간도 지정할 수 있습니다.

```ts
createMockPaymentAdapter({
  result: "failure",
  delayMs: 1_500,
  failureCode: "CARD_DECLINED",
  failureMessage: "카드 승인이 거절되었습니다.",
});
```

가상계좌의 예금주와 입금기한도 설정할 수 있습니다.

```tsx
<MockPaymentProvider
  result="success"
  virtualAccountHolder="테스트상점"
  virtualAccountDueHours={24}
>
  {children}
</MockPaymentProvider>
```

한 번의 결제만 다른 결과로 테스트하려면 `requestPayment`의 두 번째 매개변수를 사용합니다. 이 값이 Provider의 기본 `result`보다 우선합니다.

```ts
const result = await requestPayment(
  {
    orderId: "ORDER-FAILURE-TEST",
    orderName: "실패 화면 테스트",
    amount: 29_000,
  },
  { mockResult: "failure" },
);
```

## 결제수단별 테스트 흐름

- 신용·체크카드: 카드사 선택 → 일시불·할부 선택 → 카드사 인증 → 승인 확인 → `success`
- 계좌이체: 출금 은행 선택 → 은행 앱·뱅크페이 인증 화면 → 이체 결과 확인 → `success`
- 가상계좌: 입금 은행 선택 → 계좌 발급 → 계좌번호와 입금기한 안내 → `pending`
- 휴대폰: 테스트 승인 → `success`

실제 가상계좌 결제는 계좌 발급만으로 완료되지 않습니다. 입금 이후 PG사의 웹훅을 서버가 검증한 시점에 주문을 결제 완료로 변경해야 합니다. `pay-rehearsal`은 이 차이를 재현하기 위해 가상계좌 발급 결과를 `pending`으로 반환합니다.

## 실제 PG로 교체하기

UI와 사용하는 쪽의 코드는 유지하고 `PaymentAdapter` 구현만 교체합니다.

```ts
import type { PaymentAdapter } from "pay-rehearsal";

export const realPgAdapter: PaymentAdapter = {
  name: "My PG",
  testMode: false,

  async pay(
    { request, method, cardIssuer, installmentMonths, bank },
    signal,
  ) {
    // 1. PG SDK 결제창 호출
    // 2. 사용자 서비스 서버에 paymentKey/orderId/amount 전달
    // 3. 서버가 PG 승인 API 호출 및 금액 검증
    // 4. 서버에서 검증된 결과만 반환
    const response = await fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        request,
        method,
        cardIssuer,
        installmentMonths,
        bank,
      }),
      signal,
    });

    if (!response.ok) {
      return {
        status: "failed",
        orderId: request.orderId,
        amount: request.amount,
        method,
        cardIssuer,
        installmentMonths,
        bank,
        testMode: false,
        code: "PG_CONFIRM_FAILED",
        message: "결제 승인에 실패했습니다.",
        retryable: false,
      };
    }

    const data = await response.json();
    return {
      status: "success",
      orderId: request.orderId,
      amount: request.amount,
      method,
      cardIssuer,
      installmentMonths,
      bank,
      testMode: false,
      paymentId: data.paymentId,
      approvedAt: data.approvedAt,
    };
  },
};
```

운영 전환 시에는 다음 원칙을 지켜야 합니다.

- 카드번호, 비밀번호, 주민번호를 이 UI에서 직접 수집하거나 저장하지 않습니다.
- 주문 금액과 승인 상태는 브라우저 결과가 아니라 서비스 서버에서 검증합니다.
- `orderId`는 서버가 생성한 유일한 값을 사용합니다.
- 중복 승인 방지를 위해 서버 승인 API에 멱등성을 적용합니다.
- 운영 빌드에서 Mock 어댑터가 연결되지 않았는지 확인합니다.

## 명령어

```bash
npm run typecheck
npm test
npm run build
```

동작하는 Next.js 예제는 `examples/nextjs`에 있습니다.
