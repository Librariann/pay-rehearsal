"use client";

import { useMemo, type ReactNode } from "react";

import {
  createMockPaymentAdapter,
  type MockPaymentAdapterOptions,
} from "../adapters/mock";
import type {
  MockPaymentScenario,
  PaymentMethod,
  PaymentTheme,
} from "../types";
import { PaymentProvider } from "./PaymentProvider";

export interface MockPaymentProviderProps
  extends Omit<MockPaymentAdapterOptions, "result" | "scenario"> {
  children: ReactNode;
  /** Default test outcome for payments initiated under this provider. */
  result?: MockPaymentScenario;
  paymentMethods?: readonly PaymentMethod[];
  defaultPaymentMethod?: PaymentMethod;
  theme?: PaymentTheme;
}

/** React provider for quickly integrating Mock payments. */
export function MockPaymentProvider({
  children,
  result = "success",
  delayMs,
  failureCode,
  failureMessage,
  randomSuccessRate,
  virtualAccountDueHours,
  virtualAccountHolder,
  paymentMethods,
  defaultPaymentMethod,
  theme,
}: MockPaymentProviderProps) {
  const adapter = useMemo(
    () =>
      createMockPaymentAdapter({
        result,
        delayMs,
        failureCode,
        failureMessage,
        randomSuccessRate,
        virtualAccountDueHours,
        virtualAccountHolder,
      }),
    [
      delayMs,
      failureCode,
      failureMessage,
      randomSuccessRate,
      result,
      virtualAccountDueHours,
      virtualAccountHolder,
    ],
  );

  return (
    <PaymentProvider
      adapter={adapter}
      paymentMethods={paymentMethods}
      defaultPaymentMethod={defaultPaymentMethod}
      theme={theme}
    >
      {children}
    </PaymentProvider>
  );
}
