# Pay Rehearsal React

[한국어](https://github.com/Librariann/pay-rehearsal/blob/main/README.kr.md)

A TypeScript Mock checkout UI SDK for React and Next.js. Open a realistic checkout by calling one function—no Provider, hook, credentials, or separate CSS import required.

> Pay Rehearsal does not authorize payments, charge customers, or collect real card data. Replace the rehearsal flow with the payment provider's official SDK and server-side verification before production.

## Features

- One-call `requestPayment()` API with automatic modal mounting and cleanup
- No React Provider or separate stylesheet import
- Card, bank transfer, virtual account, mobile payment, and PayPal-style flows
- Success, failure, cancellation, pending, and random scenarios
- Card issuer, installment, and bank selection
- PayPal-inspired order creation, buyer approval, and capture stages
- Focus trap, Escape-to-close, scroll lock, and focus restoration
- Promise-based typed results
- Custom themes and payment-method ordering
- React 18/19 and Next.js App Router support

## Installation

```bash
npm install pay-rehearsal
```

Importing the package injects its styles automatically.

## React

Call `requestPayment()` from a browser event handler. The library mounts the checkout modal when needed and removes it after completion.

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
            orderName: "Pro Plan — 1 Month",
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
        Pay now
      </button>
      {result && <output>{result.status}</output>}
    </>
  );
}
```

Run the complete Vite example:

```bash
cd examples/react
npm install
npm run dev
```

## Next.js App Router

`requestPayment()` is browser-only. Call it from a Client Component; no root-layout Provider is needed.

```tsx
// app/checkout-button.tsx
"use client";

import { requestPayment } from "pay-rehearsal";

export function CheckoutButton() {
  const checkout = async () => {
    const result = await requestPayment(
      {
        orderId: `ORDER-${Date.now()}`,
        orderName: "Global Pro Plan",
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

  return <button onClick={checkout}>Open test checkout</button>;
}
```

Run the complete Next.js example:

```bash
cd examples/nextjs
npm install
npm run dev
```

## Request API

```ts
const result = await requestPayment(payment, options);
```

### Payment request

```ts
const payment = {
  orderId: "ORDER-1001",
  orderName: "Pro Plan",
  amount: 29_000,
  currency: "KRW",
  customer: {
    id: "USER-42",
    name: "Jane Doe",
    email: "jane@example.com",
  },
  metadata: { planId: "pro-monthly" },
};
```

Supported currencies are `KRW`, `USD`, `JPY`, and `EUR`.

### Options

```ts
requestPayment(payment, {
  result: "failure",
  delayMs: 1_200,
  failureCode: "CARD_DECLINED",
  failureMessage: "The card authorization was declined.",
  paymentMethods: ["card", "bank-transfer", "virtual-account", "paypal"],
  defaultPaymentMethod: "card",
  theme: {
    accentColor: "#4f46e5",
    borderRadius: 24,
    fontFamily: "Inter, sans-serif",
  },
});
```

| Option | Description |
| --- | --- |
| `result` | `success`, `failure`, `cancelled`, or `random` |
| `delayMs` | Simulated adapter delay |
| `paymentMethods` | Visible methods in display order |
| `defaultPaymentMethod` | Initially selected visible method |
| `paymentMethod` | Locks the checkout to one method and skips method selection |
| `randomSuccessRate` | Success probability when `result` is `random` |
| `virtualAccountHolder` | Mock virtual-account holder |
| `virtualAccountDueHours` | Mock deposit deadline in hours |
| `theme` | Accent color, radius, and font |
| `adapter` | Optional custom `PaymentAdapter` |

Only one checkout can be active at a time. A second call rejects until the current checkout completes.

## Results

`requestPayment()` resolves to a discriminated `PaymentResult` union.

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

Every result includes `orderId`, `amount`, `method`, and `testMode`. Method-specific fields such as `cardIssuer`, `installmentMonths`, and `bank` are included when selected.

Note that the configured scenario is named `failure`, while the returned status is `failed`.

## Sending Results to Your Backend

Send the request and result as JSON to your normal backend API. The example intentionally does not depend on a database or ORM.

```ts
const result = await requestPayment(payment, { result: "success" });

await fetch("/api/payments", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ payment, result }),
});
```

Keep test records visibly separated with `testMode: true`. `PaymentResult` does not repeat `orderName`, `currency`, `customer`, or `metadata`, so persist the original request alongside the result when those values are needed.

Never trust this browser result in production. A production server must verify the order ID, amount, currency, authorization status, and webhook signature with the real payment provider.

## PayPal Rehearsal

Lock a request to PayPal:

```ts
const result = await requestPayment(
  {
    orderId: "ORDER-PAYPAL-1001",
    orderName: "Global Pro Plan",
    amount: 29,
    currency: "USD",
  },
  { paymentMethod: "paypal" },
);
```

The modal simulates these stages:

1. Create a Mock PayPal order.
2. Simulate buyer approval.
3. Simulate capture and verification.
4. Resolve with the configured result.

No PayPal SDK is loaded and no credentials or real funds are involved. In production, create and capture PayPal orders on your server and verify the final capture status there.

## PaymentButton

The optional `PaymentButton` component also works without a Provider.

```tsx
import { PaymentButton } from "pay-rehearsal";

<PaymentButton
  request={{
    orderId: "ORDER-1001",
    orderName: "Pro Plan",
    amount: 29_000,
  }}
  options={{ result: "success" }}
  onResult={(result) => console.log(result)}
>
  Pay KRW 29,000
</PaymentButton>;
```

## Production Boundary

- Do not collect or store card numbers, passwords, or identity numbers in this UI.
- Use a unique, server-generated `orderId`.
- Verify the expected amount and final authorization status on your server.
- Apply idempotency to confirmation endpoints to prevent duplicate charges.
- Replace simulated authentication with the provider's official checkout experience.
- Ensure Mock results cannot update production orders.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Disclaimer

Pay Rehearsal is not provided, sponsored, or endorsed by any payment gateway, card issuer, or financial institution. Financial institution names are used only to describe simulated payment flows.
