"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  PaymentAdapter,
  PaymentContextValue,
  PaymentMethod,
  PaymentRequest,
  PaymentRequestOptions,
  PaymentResult,
  PaymentTheme,
} from "../types";
import { PaymentModal } from "./PaymentModal";

interface ActivePayment {
  request: PaymentRequest;
  options?: PaymentRequestOptions;
  paymentMethods: readonly PaymentMethod[];
  initialPaymentMethod: PaymentMethod;
  isPaymentMethodLocked: boolean;
  resolve(result: PaymentResult): void;
}

export interface PaymentProviderProps {
  adapter: PaymentAdapter;
  children: ReactNode;
  /** 결제창에 표시할 결제수단과 순서입니다. */
  paymentMethods?: readonly PaymentMethod[];
  /** 결제창이 처음 열릴 때 선택할 결제수단입니다. */
  defaultPaymentMethod?: PaymentMethod;
  theme?: PaymentTheme;
}

export const PaymentContext = createContext<PaymentContextValue | null>(null);

const ALL_PAYMENT_METHODS: readonly PaymentMethod[] = [
  "card",
  "bank-transfer",
  "virtual-account",
  "mobile",
];

const PAYMENT_METHOD_SET = new Set<PaymentMethod>(ALL_PAYMENT_METHODS);

function normalizePaymentMethods(
  methods: readonly PaymentMethod[],
): PaymentMethod[] {
  const normalized = [...new Set(methods)].filter((method) =>
    PAYMENT_METHOD_SET.has(method),
  );

  if (normalized.length === 0) {
    throw new Error("paymentMethods에는 하나 이상의 결제수단이 필요합니다.");
  }

  return normalized;
}

function validateRequest(request: PaymentRequest) {
  if (!request.orderId.trim()) throw new Error("orderId는 필수입니다.");
  if (!request.orderName.trim()) throw new Error("orderName은 필수입니다.");
  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    throw new Error("amount는 0보다 큰 유한한 숫자여야 합니다.");
  }
}

export function PaymentProvider({
  adapter,
  children,
  paymentMethods = ALL_PAYMENT_METHODS,
  defaultPaymentMethod,
  theme,
}: PaymentProviderProps) {
  const [activePayment, setActivePayment] = useState<ActivePayment | null>(null);
  const isOpenRef = useRef(false);
  const configuredMethods = useMemo(
    () => normalizePaymentMethods(paymentMethods),
    [paymentMethods],
  );

  if (defaultPaymentMethod && !configuredMethods.includes(defaultPaymentMethod)) {
    throw new Error(
      "defaultPaymentMethod는 paymentMethods에 포함된 결제수단이어야 합니다.",
    );
  }

  const requestPayment = useCallback(
    (
      request: PaymentRequest,
      options?: PaymentRequestOptions,
    ): Promise<PaymentResult> => {
      validateRequest(request);

      if (isOpenRef.current) {
        return Promise.reject(
          new Error("이미 진행 중인 결제가 있습니다. 현재 결제를 먼저 완료해 주세요."),
        );
      }

      const requestedMethods = options?.paymentMethod
        ? normalizePaymentMethods([options.paymentMethod])
        : options?.paymentMethods
          ? normalizePaymentMethods(options.paymentMethods)
          : configuredMethods;
      const initialPaymentMethod =
        options?.paymentMethod ??
        (defaultPaymentMethod && requestedMethods.includes(defaultPaymentMethod)
          ? defaultPaymentMethod
          : requestedMethods[0]);

      isOpenRef.current = true;
      return new Promise((resolve) => {
        setActivePayment({
          request,
          options,
          paymentMethods: requestedMethods,
          initialPaymentMethod,
          isPaymentMethodLocked: options?.paymentMethod !== undefined,
          resolve,
        });
      });
    },
    [configuredMethods, defaultPaymentMethod],
  );

  const complete = useCallback(
    (result: PaymentResult) => {
      if (!activePayment) return;
      activePayment.resolve(result);
      isOpenRef.current = false;
      setActivePayment(null);
    },
    [activePayment],
  );

  const value = useMemo<PaymentContextValue>(
    () => ({ requestPayment, isOpen: activePayment !== null }),
    [activePayment, requestPayment],
  );

  return (
    <PaymentContext.Provider value={value}>
      {children}
      {activePayment && (
        <PaymentModal
          adapter={adapter}
          request={activePayment.request}
          options={activePayment.options}
          paymentMethods={activePayment.paymentMethods}
          initialPaymentMethod={activePayment.initialPaymentMethod}
          isPaymentMethodLocked={activePayment.isPaymentMethodLocked}
          theme={theme}
          onComplete={complete}
        />
      )}
    </PaymentContext.Provider>
  );
}
