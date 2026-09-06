"use client";

import type { ButtonHTMLAttributes, MouseEvent } from "react";

import type {
  PaymentRequest,
  PaymentRequestOptions,
  PaymentResult,
} from "../types";
import { usePayment } from "./usePayment";

export interface PaymentButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "onError"> {
  request: PaymentRequest;
  options?: PaymentRequestOptions;
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
  const { requestPayment, isOpen } = usePayment();

  const onClick = async (event: MouseEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented) return;

    try {
      onResult?.(await requestPayment(request, options));
    } catch (error) {
      onError?.(
        error instanceof Error ? error : new Error("결제창을 열지 못했습니다."),
      );
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
