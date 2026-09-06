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
  /** 이 Provider 아래 결제에 적용할 기본 테스트 결과입니다. */
  result?: MockPaymentScenario;
  paymentMethods?: readonly PaymentMethod[];
  defaultPaymentMethod?: PaymentMethod;
  theme?: PaymentTheme;
}

/** Mock 결제를 간단히 연결하기 위한 React Provider입니다. */
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
