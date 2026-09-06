"use client";

import { useContext } from "react";

import { PaymentContext } from "./PaymentProvider";

export function usePayment() {
  const context = useContext(PaymentContext);

  if (!context) {
    throw new Error("usePayment는 PaymentProvider 안에서 사용해야 합니다.");
  }

  return context;
}
