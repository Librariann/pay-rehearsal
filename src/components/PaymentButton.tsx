"use client";

import { useState, type ButtonHTMLAttributes, type MouseEvent } from "react";

import type {
  PaymentRequest,
  PaymentResult,
  RequestPaymentOptions,
} from "../types";
import { requestPayment } from "../requestPayment";

export interface PaymentButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "onError"> {
  request: PaymentRequest;
  options?: RequestPaymentOptions;
  onResult?(result: PaymentResult): void;
  onError?(error: Error): void;
}

export function PaymentButton({
  request,
  options,
  onResult,
  onError,
  disabled,
  children = "결제하기",
  ...buttonProps
}: PaymentButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const onClick = async (event: MouseEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented) return;

    try {
      setIsOpen(true);
      onResult?.(await requestPayment(request, options));
    } catch (error) {
      onError?.(
        error instanceof Error ? error : new Error("결제창을 열지 못했습니다."),
      );
    } finally {
      setIsOpen(false);
    }
  };

  return (
    <button
      {...buttonProps}
      type={buttonProps.type ?? "button"}
      disabled={disabled || isOpen}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
