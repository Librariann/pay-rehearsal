# Pay Rehearsal React

[한국어](https://github.com/Librariann/pay-rehearsal/blob/main/README.ko.md)

A TypeScript Mock checkout UI SDK for React and Next.js that lets you build domestic payment gateway and PayPal-style payment flows before connecting a live payment provider.

> The Mock adapter does not perform real authorizations, charges, or card-data collection. For production, replace the simulated authentication UI with the payment provider's official checkout experience and verify every payment on your server.

## Features

- Responsive payment modal with baseline accessibility support
- UI flows for cards, bank transfers, virtual accounts, mobile payments, and PayPal
- Card issuer selection for KB Kookmin, Shinhan, Samsung, Hyundai, Lotte, Hana, Woori, NH Nonghyup, and BC
- One-time and installment payment selection with card issuer authentication simulation
- Major bank selection with bank transfer authentication simulation
- Virtual account details with a deposit-pending (`pending`) result
- A PayPal-inspired checkout theme with order creation, buyer approval, and capture stages
- Success, failure, cancellation, and random test scenarios
- Promise-based `requestPayment()` API
- Prebuilt `PaymentButton`
- A replaceable `PaymentAdapter` interface for custom test and integration experiments
- Theme configuration for color, border radius, and font family
- Compatible with React 18/19 and the Next.js App Router

## Installation

Install the package from npm:

```bash
npm install pay-rehearsal
```

The package injects its styles automatically when imported. You do not need to import a separate CSS file.

To install a local checkout in another project, build it first and install its directory:

```bash
npm install
npm run build
npm install /absolute/path/to/pay-rehearsal
```

## Using It with the Next.js App Router

Create a client-side provider.

```tsx
// app/payment-provider.tsx
"use client";

import { MockPaymentProvider } from "pay-rehearsal";
import type { ReactNode } from "react";

export function AppPaymentProvider({ children }: { children: ReactNode }) {
  return (
    <MockPaymentProvider
      result="success"
      delayMs={900}
      paymentMethods={["card", "bank-transfer", "virtual-account", "paypal"]}
      defaultPaymentMethod="card"
      theme={{ accentColor: "#4f46e5", borderRadius: 24 }}
    >
      {children}
    </MockPaymentProvider>
  );
}
```

Add the provider to your root layout.

```tsx
// app/layout.tsx
import { AppPaymentProvider } from "./payment-provider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppPaymentProvider>{children}</AppPaymentProvider>
      </body>
    </html>
  );
}
```

Call the API from any client component that needs to initiate a payment.

```tsx
"use client";

import { usePayment } from "pay-rehearsal";

export function CheckoutButton() {
  const { requestPayment, isOpen } = usePayment();

  const checkout = async () => {
    const result = await requestPayment({
      orderId: `ORDER-${Date.now()}`,
      orderName: "Pro Plan — 1 Month",
      amount: 29_000,
      currency: "KRW",
      customer: { email: "developer@example.com" },
    });

    if (result.status === "success") {
      console.log(result.paymentId, result.testMode);
    }

    if (result.status === "pending") {
      // Issuing a virtual account does not complete the payment.
      console.log(result.virtualAccount);
    }
  };

  return (
    <button type="button" disabled={isOpen} onClick={checkout}>
      Pay now
    </button>
  );
}
```

For simpler use cases, you can use `PaymentButton`.

```tsx
<PaymentButton
  request={{
    orderId: "ORDER-1001",
    orderName: "Pro Plan",
    amount: 29_000,
  }}
  onResult={(result) => console.log(result)}
>
  Pay KRW 29,000
</PaymentButton>
```

## Configuring Payment Methods and Their Order

Use the provider's `paymentMethods` property to choose which methods appear in the modal and in what order. When omitted, cards, bank transfers, virtual accounts, mobile payments, and PayPal are all displayed.

```tsx
<MockPaymentProvider
  paymentMethods={["virtual-account", "card"]}
  defaultPaymentMethod="virtual-account"
>
  {children}
</MockPaymentProvider>
```

To override the list for a single payment, pass options as the second argument to `requestPayment`.

```ts
requestPayment(order, {
  paymentMethods: ["card", "bank-transfer"],
});
```

To lock a payment to one method, use `paymentMethod`. The method selection UI is skipped and the modal starts at that method's detail step.

```ts
requestPayment(order, {
  paymentMethod: "card",
});
```

Configuration precedence is request-level `paymentMethod` → request-level `paymentMethods` → provider-level `paymentMethods`. Array order determines display order. In production, your server must verify that a selected payment method is enabled under your gateway contract regardless of whether the method appears in the UI.

## Rehearsing PayPal Checkout

Add `paypal` to the provider's payment method list:

```tsx
<MockPaymentProvider
  paymentMethods={["paypal", "card"]}
  defaultPaymentMethod="paypal"
>
  {children}
</MockPaymentProvider>
```

You can also lock an individual request to PayPal:

```ts
requestPayment(
  {
    orderId: "ORDER-PAYPAL-1001",
    orderName: "Global Pro Plan",
    amount: 29,
    currency: "USD",
  },
  { paymentMethod: "paypal" },
);
```

When PayPal is active, the modal automatically switches to a PayPal-inspired navy and yellow theme. It returns to the configured provider theme when another payment method is selected.

The Mock PayPal flow reproduces these stages:

1. **Create order** — displays a short server-order creation state and generates a `PAYPAL-MOCK-*` order ID.
2. **Buyer approval** — displays the simulated PayPal login and approval step.
3. **Capture payment** — uses the configured Mock adapter to process the approved order.
4. **Show result** — returns `success`, `failed`, or `cancelled` according to the selected test scenario.

```text
Select PayPal
  → Create a Mock order
  → Simulate buyer approval
  → Capture and verify
  → Return the payment result
```

The progress indicator and Mock order ID are UI simulation data. The final `PaymentResult` continues to use the adapter-generated `paymentId`.

This package does not load the PayPal JavaScript SDK, open a real PayPal window, create a PayPal order, capture funds, or require PayPal credentials. For a live integration, your server must create the order and capture it after buyer approval. Validate supported currencies, buyer country availability, amount, merchant account, and the final capture status on your server.

## Test Scenarios

```tsx
<MockPaymentProvider result="success">...</MockPaymentProvider>
<MockPaymentProvider result="failure">...</MockPaymentProvider>
<MockPaymentProvider result="cancelled">...</MockPaymentProvider>
<MockPaymentProvider result="random" randomSuccessRate={0.7}>...</MockPaymentProvider>
```

You can also configure the failure code, failure message, and simulated delay.

```ts
createMockPaymentAdapter({
  result: "failure",
  delayMs: 1_500,
  failureCode: "CARD_DECLINED",
  failureMessage: "The card authorization was declined.",
});
```

The account holder and deposit deadline for virtual accounts are configurable as well.

```tsx
<MockPaymentProvider
  result="success"
  virtualAccountHolder="Test Merchant"
  virtualAccountDueHours={24}
>
  {children}
</MockPaymentProvider>
```

To test a different outcome for a single payment, pass options as the second argument to `requestPayment`. This value takes precedence over the provider's default `result`.

```ts
const result = await requestPayment(
  {
    orderId: "ORDER-FAILURE-TEST",
    orderName: "Failure Screen Test",
    amount: 29_000,
  },
  { mockResult: "failure" },
);
```

## Test Flow by Payment Method

- Credit or debit card: select issuer → select one-time or installment payment → simulate issuer authentication → confirm authorization → `success`
- Bank transfer: select withdrawal bank → simulate bank app or BankPay authentication → confirm transfer → `success`
- Virtual account: select deposit bank → issue account → display account number and deposit deadline → `pending`
- Mobile payment: simulate authorization → `success`
- PayPal: simulate server-side order creation → simulate buyer approval → simulate capture and verification → `success`

A real virtual account payment is not complete when the account is issued. The order should be marked as paid only after your server verifies the payment gateway's webhook following the deposit. `pay-rehearsal` reproduces this distinction by returning `pending` when a virtual account is issued.

## Custom Adapters and Production Boundaries

The adapter interface can be used as a starting point for connecting a payment gateway. The included modal remains a rehearsal UI; a production integration must replace simulated authentication with the provider's official checkout experience and verify the result on the server.

```ts
import type { PaymentAdapter } from "pay-rehearsal";

export const realPgAdapter: PaymentAdapter = {
  name: "My Payment Gateway",
  testMode: false,

  async pay({ request, method, cardIssuer, installmentMonths, bank }, signal) {
    // 1. Open the payment gateway SDK checkout UI.
    // 2. Send paymentKey, orderId, and amount to your application server.
    // 3. Have the server call the gateway's confirmation API and verify the amount.
    // 4. Return only the server-verified result.
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
        message: "Payment authorization failed.",
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

Follow these rules before switching to production:

- Never collect or store card numbers, passwords, or government-issued identification numbers in this UI.
- Verify the order amount and authorization status on your application server, not from browser results.
- Use a unique, server-generated `orderId`.
- Apply idempotency to your server-side authorization endpoint to prevent duplicate charges.
- Confirm that the Mock adapter is not connected in production builds.

## Commands

```bash
npm run typecheck
npm test
npm run build
```

A working Next.js example is available in `examples/nextjs`.

## Disclaimer

Pay Rehearsal is not provided, sponsored, or endorsed by any payment gateway, card issuer, or financial institution. Financial institution names are used only to describe simulated payment flows.
