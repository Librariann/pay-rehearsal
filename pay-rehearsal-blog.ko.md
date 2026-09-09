# 결제 모듈을 기다리지 않고 MVP를 개발하기 위해 `pay-rehearsal`을 만들었다

프로젝트나 MVP를 만들다 보면 결제 기능이 필요한 순간이 꽤 자주 온다.

상품 목록과 주문 페이지를 만들고 결제 버튼까지 구현했는데, 실제 결제를 붙이려는 순간부터는 애플리케이션 코드 밖의 일이 많아진다. 어떤 PG사를 사용할지 정하고, 계정을 만들고, 계약과 심사를 진행하고, 사용할 결제수단을 신청해야 한다.

PG사에 따라 계약 전에도 공용 테스트 키나 샌드박스 환경을 제공한다. 따라서 모든 경우에 서비스 전체를 완성하고 심사를 통과해야만 테스트를 시작할 수 있는 것은 아니다.

하지만 PG사 선정과 계정 생성, 계약, 심사, 결제수단별 활성화에는 여전히 시간이 필요하다. 프로젝트마다 이 과정을 다시 진행하다 보면 MVP의 핵심 기능을 구현하던 흐름이 끊기기도 한다.

나는 이 절차가 끝날 때까지 기다리지 않고 주문 생성부터 결제 결과 처리까지 애플리케이션의 흐름을 먼저 구현하고 싶었다. 실제 PG 연동은 서비스가 어느 정도 완성되고 계약과 심사가 끝난 뒤 마지막에 교체할 수 있으면 좋겠다고 생각했다.

그렇게 만든 라이브러리가 [`pay-rehearsal`](https://www.npmjs.com/package/pay-rehearsal)이다.

## 먼저 만들고 싶었던 것은 결제 자체가 아니라 결제 흐름이었다

사용자가 보는 결제 기능은 단순히 결제 버튼 하나로 끝나지 않는다.

- 주문 정보 생성
- 결제수단 선택
- 결제 진행 상태 표시
- 결제 성공 처리
- 결제 실패와 재시도 처리
- 사용자의 결제 취소 처리
- 가상계좌 발급 후 입금 대기 처리
- 결제 결과에 따른 주문 상태 변경과 화면 이동

실제 결제 모듈이 아직 없어도 이러한 흐름은 충분히 먼저 설계하고 구현할 수 있다.

물론 단순한 `alert()`나 임시 버튼으로 성공 결과를 반환하도록 만들 수도 있다. 하지만 그렇게 구현하면 실제 결제창이 연결됐을 때 사용자가 결제 도중 이탈하거나, 승인이 실패하거나, 결과가 즉시 확정되지 않는 상황을 뒤늦게 다루게 된다.

결제가 항상 성공한다고 가정한 화면과 실제 결제 과정 사이에는 생각보다 큰 차이가 있다.

그래서 성공 결과 하나만 돌려주는 함수보다 실제 결제창에 가까운 UI와 여러 결과 상태를 재현할 수 있는 도구가 필요했다.

## `pay-rehearsal`이 하는 일

`pay-rehearsal`은 React와 Next.js에서 사용할 수 있는 모의 결제 UI 라이브러리다.

현재 다음과 같은 결제 흐름을 테스트할 수 있다.

- 신용·체크카드
- 계좌이체
- 가상계좌
- 휴대폰 결제
- PayPal 방식의 결제
- 성공, 실패, 취소 및 무작위 결과

카드 결제에서는 카드사와 할부 개월을 선택하고 인증 단계를 진행할 수 있다. 계좌이체는 은행 선택과 인증 과정을, 가상계좌는 계좌 발급 후 `pending` 상태를 재현한다.

PayPal을 선택하면 일반 카드 결제와는 다른 순서도 테스트할 수 있다.

1. 서버의 주문 생성 단계
2. 구매자의 PayPal 승인 단계
3. 승인된 주문의 결제 캡처 단계
4. 최종 결과 확인

이 과정은 모두 UI 시뮬레이션이며 실제 PayPal API를 호출하거나 결제를 발생시키지는 않는다.

## 사용 방법

패키지는 npm으로 설치할 수 있다.

```bash
npm install pay-rehearsal
```

별도의 CSS 파일을 가져올 필요는 없다. 패키지를 불러오면 필요한 스타일도 함께 적용된다.

Provider를 연결하거나 전용 훅을 사용할 필요 없이 결제가 필요한 컴포넌트에서 `requestPayment()`를 바로 호출한다.

```tsx
"use client";

import { useState } from "react";
import { requestPayment } from "pay-rehearsal";

export function CheckoutButton() {
  const [isOpen, setIsOpen] = useState(false);

  const handlePayment = async () => {
    try {
      setIsOpen(true);
      const result = await requestPayment(
        {
          orderId: `ORDER-${Date.now()}`,
          orderName: "프로 플랜 1개월",
          amount: 29_000,
          currency: "KRW",
        },
        {
          result: "success",
          paymentMethods: ["card", "virtual-account", "paypal"],
        },
      );

      if (result.status === "success") {
        // 주문 완료 처리
      }

      if (result.status === "failed") {
        // 실패 안내 및 재시도 처리
      }

      if (result.status === "cancelled") {
        // 사용자 취소 처리
      }

      if (result.status === "pending") {
        // 가상계좌 입금 대기 처리
      }
    } finally {
      setIsOpen(false);
    }
  };

  return (
    <button type="button" disabled={isOpen} onClick={handlePayment}>
      결제하기
    </button>
  );
}
```

두 번째 인자의 `result`를 바꾸면 실패나 취소 상황도 반복해서 확인할 수 있다.

```ts
await requestPayment(order, { result: "failure" });
```

```ts
await requestPayment(order, { result: "cancelled" });
```

이렇게 하면 실제 결제를 발생시키지 않고도 각 결과에서 애플리케이션이 올바르게 동작하는지 확인할 수 있다.

## 반환값을 백엔드로 보내 저장 흐름까지 테스트하기

`requestPayment()`는 `Promise<PaymentResult>`를 반환한다. 결제창에서 선택과 인증 과정을 마치면 Promise가 완료되고, 반환된 `status`에 따라 결과를 처리할 수 있다.

성공한 결제는 다음과 같은 형태로 반환된다.

```ts
{
  status: "success",
  orderId: "ORDER-1001",
  amount: 29000,
  method: "card",
  cardIssuer: "shinhan",
  installmentMonths: 0,
  testMode: true,
  paymentId: "mock_...",
  approvedAt: "2026-09-07T12:00:00.000Z"
}
```

결과는 네 가지 상태 중 하나다.

| `status` | 의미 | 주요 추가 값 |
| --- | --- | --- |
| `success` | 결제 성공 | `paymentId`, `approvedAt` |
| `pending` | 가상계좌 발급 후 입금 대기 | `paymentId`, `virtualAccount` |
| `failed` | 결제 실패 | `code`, `message`, `retryable` |
| `cancelled` | 사용자 또는 어댑터가 결제 취소 | `reason` |

시나리오를 설정할 때는 `result="failure"`를 사용하지만, 반환되는 상태값은 `status: "failed"`라는 점에 주의해야 한다.

반환값을 백엔드 API로 보내면 실제 프로젝트에서 주문과 결제 내역을 처리하는 흐름도 함께 테스트할 수 있다. 프론트엔드에서는 특정 DB나 ORM을 직접 사용하지 않고 결제 요청과 결과를 일반 JSON API로 전달한다.

```tsx
const order = {
  orderId: `ORDER-${Date.now()}`,
  orderName: "프로 플랜 1개월",
  amount: 29_000,
  currency: "KRW" as const,
};

const result = await requestPayment(order);

await fetch("/api/payments", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ payment: order, result }),
});

if (result.status === "success") {
  router.push(`/orders/${result.orderId}/complete`);
}
```

`PaymentResult`에는 `orderName`, `currency`, `customer`, `metadata`가 포함되지 않는다. 백엔드에서 이 값들도 사용하려면 위 예제처럼 원래 결제 요청과 결과를 함께 전달하면 된다. 이후 어떤 DB에 어떤 방식으로 저장할지는 사용하는 백엔드 환경에서 결정한다.

이렇게 구성하면 결제 성공뿐 아니라 실패, 취소, 가상계좌 입금 대기 결과가 DB와 주문 화면에 올바르게 반영되는지 확인할 수 있다. 테스트 레코드에는 `testMode`를 반드시 저장해 운영 결제 데이터와 구분하는 것이 좋다.

이 API는 개발 환경에서 Mock 흐름을 확인하기 위한 예제다. 운영 환경에서는 클라이언트가 전송한 성공 결과를 그대로 저장하거나 신뢰해서는 안 된다. PG사 서버에 결제 상태와 금액을 다시 조회하거나 승인 API의 응답을 검증한 뒤 DB를 갱신해야 한다.

## 실제 PG 연동은 마지막에 교체한다

이 라이브러리를 만들면서 중요하게 생각한 부분은 사용하는 쪽의 결제 호출 방식을 최대한 단순하게 유지하는 것이었다.

MVP를 개발하는 동안에는 `requestPayment()`로 전체 흐름을 구현한다. 이후 사용할 PG사가 정해지고 계약과 심사가 완료되면 실제 결제 SDK와 서버 API를 연결한다.

```text
MVP 개발
  → pay-rehearsal로 주문 및 결제 흐름 구현
  → PG사 선정과 계약·심사 병행
  → 공식 SDK 및 서버 검증 연결
  → 운영 환경에서 최종 결제 테스트
```

실제 연동 단계에서는 공급사마다 API와 승인 방식이 다르기 때문에 코드 한 줄만 바꿔서 완전히 교체할 수 있는 것은 아니다. 특히 결제 주문 생성, 금액 검증, 승인, 웹훅 처리 등은 서버에서 안전하게 구현해야 한다.

그래도 화면과 주문 상태, 성공·실패·취소에 대한 애플리케이션 로직을 미리 만들어두면 실제 PG 연동 시점에 새로 결정해야 할 범위가 줄어든다.

## 이 라이브러리가 실제 결제 모듈을 대신하지는 않는다

`pay-rehearsal`은 실제 결제를 처리하는 PG SDK가 아니다. 결제 성공·실패·취소 등의 사용자 흐름을 미리 구현하고 테스트하기 위한 UI 모킹 라이브러리다.

실제 서비스 출시 전에는 반드시 PG사의 공식 SDK와 API를 연결해야 한다. 클라이언트에서 전달받은 결과만 신뢰해서도 안 된다. 서버에서 주문번호, 결제 금액, 통화, 결제 상태를 다시 검증하고 웹훅의 유효성도 확인해야 한다.

라이브러리에서 표시하는 카드사 인증이나 PayPal 승인 화면 역시 실제 인증 화면이 아니다. 운영 환경에서는 해당 결제사가 제공하는 공식 결제 경험으로 교체해야 한다.

## 만들고 배포하면서 느낀 점

처음에는 결제창 모양을 흉내 내고 성공이나 실패 결과만 반환하면 금방 만들 수 있을 것 같았다.

막상 라이브러리 형태로 만들기 시작하니 고려해야 할 것이 많았다. 타입과 공개 API를 정리해야 했고, React와 Next.js에서 모두 사용할 수 있어야 했다. 패키지를 설치한 사용자가 CSS를 별도로 가져오지 않아도 되도록 구성해야 했고, 모달의 포커스 트랩과 닫힌 후 원래 요소로 포커스를 돌려주는 접근성 처리도 필요했다.

README 작성, 테스트, 빌드 결과물, npm 메타데이터와 배포 설정까지 챙기고 나니 작은 라이브러리 하나를 공개하는 일도 생각보다 손이 많이 간다는 것을 알게 됐다.

다만 AI의 도움을 받아 반복 작업과 문서 정리, 테스트 케이스 작성을 빠르게 진행할 수 있었다. 덕분에 아이디어를 실제로 설치할 수 있는 npm 패키지까지 비교적 짧은 시간 안에 옮길 수 있었다.

## 마치며

테스트 키를 계약 전에 받을 수 있는 PG사도 있다. 그럼에도 PG사 선정, 계정 생성, 계약, 심사와 결제수단 활성화는 개발 일정과 별개로 시간이 걸릴 수 있다.

`pay-rehearsal`은 그 준비가 끝날 때까지 개발을 멈추지 않고 애플리케이션의 결제 경험을 먼저 설계하고 구현하기 위해 만든 라이브러리다.

실제 결제 연동을 대신할 수는 없지만, 프로젝트 초기나 MVP 단계에서 결제 흐름을 빠르게 만들고 성공뿐 아니라 실패, 취소, 대기 상태까지 확인하는 용도로 활용할 수 있다.

- npm: [pay-rehearsal](https://www.npmjs.com/package/pay-rehearsal)
- GitHub: [Librariann/pay-rehearsal](https://github.com/Librariann/pay-rehearsal)
