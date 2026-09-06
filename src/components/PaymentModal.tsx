"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

import type {
  BankCode,
  CardIssuer,
  PaymentAdapter,
  PaymentFailure,
  PaymentMethod,
  PaymentRequest,
  PaymentRequestOptions,
  PaymentResult,
  PaymentTheme,
} from "../types";

interface PaymentModalProps {
  adapter: PaymentAdapter;
  request: PaymentRequest;
  options?: PaymentRequestOptions;
  paymentMethods: readonly PaymentMethod[];
  initialPaymentMethod: PaymentMethod;
  isPaymentMethodLocked: boolean;
  theme?: PaymentTheme;
  onComplete(result: PaymentResult): void;
}

type ViewState =
  | "selecting"
  | "paypal-creating"
  | "authorizing"
  | "processing"
  | "result";

type PayPalStep = "create" | "approve" | "capture";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const METHODS: Array<{
  id: PaymentMethod;
  label: string;
  description: string;
  icon: string;
}> = [
  { id: "card", label: "신용·체크카드", description: "모든 카드사", icon: "▣" },
  { id: "bank-transfer", label: "계좌이체", description: "인증 후 즉시 출금", icon: "↔" },
  { id: "virtual-account", label: "가상계좌", description: "계좌 발급 후 입금", icon: "▤" },
  { id: "mobile", label: "휴대폰", description: "통신사 결제", icon: "▯" },
  { id: "paypal", label: "PayPal", description: "해외 간편결제", icon: "P" },
];

const CARD_ISSUERS: Array<{
  id: CardIssuer;
  label: string;
  mark: string;
}> = [
  { id: "kb-kookmin", label: "KB국민", mark: "KB" },
  { id: "shinhan", label: "신한", mark: "신" },
  { id: "samsung", label: "삼성", mark: "S" },
  { id: "hyundai", label: "현대", mark: "H" },
  { id: "lotte", label: "롯데", mark: "L" },
  { id: "hana", label: "하나", mark: "1Q" },
  { id: "woori", label: "우리", mark: "W" },
  { id: "nh-nonghyup", label: "NH농협", mark: "NH" },
  { id: "bc", label: "BC", mark: "BC" },
];

const INSTALLMENT_OPTIONS = [0, 2, 3, 4, 5, 6, 10, 12] as const;

const BANKS: Array<{ id: BankCode; label: string; mark: string }> = [
  { id: "kb-kookmin", label: "KB국민", mark: "KB" },
  { id: "shinhan", label: "신한", mark: "신" },
  { id: "woori", label: "우리", mark: "W" },
  { id: "hana", label: "하나", mark: "1Q" },
  { id: "nh-nonghyup", label: "NH농협", mark: "NH" },
  { id: "ibk", label: "IBK기업", mark: "IBK" },
  { id: "kakaobank", label: "카카오뱅크", mark: "K" },
  { id: "tossbank", label: "토스뱅크", mark: "T" },
];

function getBankLabel(bank: BankCode): string {
  return BANKS.find((item) => item.id === bank)?.label ?? bank;
}

function getCardIssuerLabel(cardIssuer: CardIssuer): string {
  return CARD_ISSUERS.find((item) => item.id === cardIssuer)?.label ?? cardIssuer;
}

function formatAmount(amount: number, currency = "KRW"): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
  }).format(amount);
}

function formatDueAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getResultMessage(result: PaymentResult) {
  switch (result.status) {
    case "success":
      return {
        title: "테스트 결제가 완료됐어요",
        description: "실제 승인이나 출금은 발생하지 않았습니다.",
      };
    case "pending":
      return {
        title: "가상계좌가 발급됐어요",
        description: "아래 계좌로 입금되면 결제가 완료됩니다.",
      };
    case "failed":
      return { title: "테스트 결제에 실패했어요", description: result.message };
    case "cancelled":
      return {
        title: "결제가 취소됐어요",
        description: "설정한 테스트 시나리오에 따라 취소됐습니다.",
      };
  }
}

function PayPalProgress({
  currentStep,
}: {
  currentStep: PayPalStep;
}) {
  const steps: Array<{ id: PayPalStep; label: string }> = [
    { id: "create", label: "주문 생성" },
    { id: "approve", label: "사용자 승인" },
    { id: "capture", label: "결제 캡처" },
  ];
  const currentIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <ol className="pay-rehearsal-paypal-progress" aria-label="PayPal 결제 진행 단계">
      {steps.map((step, index) => {
        const state =
          index < currentIndex
            ? "completed"
            : index === currentIndex
              ? "current"
              : "upcoming";

        return (
          <li
            key={step.id}
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span aria-hidden="true">{index < currentIndex ? "✓" : index + 1}</span>
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}

export function PaymentModal({
  adapter,
  request,
  options,
  paymentMethods,
  initialPaymentMethod,
  isPaymentMethodLocked,
  theme,
  onComplete,
}: PaymentModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const paypalOrderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const methodRef = useRef<PaymentMethod>(initialPaymentMethod);
  const cardIssuerRef = useRef<CardIssuer | null>(null);
  const installmentMonthsRef = useRef(0);
  const bankRef = useRef<BankCode | null>(null);
  const resultRef = useRef<PaymentResult | null>(null);
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<ViewState>("selecting");
  const [method, setMethod] = useState<PaymentMethod>(initialPaymentMethod);
  const [cardIssuer, setCardIssuer] = useState<CardIssuer | null>(null);
  const [installmentMonths, setInstallmentMonths] = useState(0);
  const [bank, setBank] = useState<BankCode | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);

  const style = {
    "--pay-rehearsal-accent":
      method === "paypal" ? "#003087" : theme?.accentColor,
    "--pay-rehearsal-radius": theme?.borderRadius
      ? `${theme.borderRadius}px`
      : undefined,
    "--pay-rehearsal-font": theme?.fontFamily,
  } as CSSProperties;

  methodRef.current = method;
  cardIssuerRef.current = cardIssuer;
  installmentMonthsRef.current = installmentMonths;
  bankRef.current = bank;
  resultRef.current = result;

  const close = useCallback(() => {
    if (paypalOrderTimerRef.current) {
      globalThis.clearTimeout(paypalOrderTimerRef.current);
    }
    abortControllerRef.current?.abort();
    if (resultRef.current) {
      onComplete(resultRef.current);
      return;
    }

    onComplete({
      status: "cancelled",
      orderId: request.orderId,
      amount: request.amount,
      method: methodRef.current,
      cardIssuer:
        methodRef.current === "card"
          ? cardIssuerRef.current ?? undefined
          : undefined,
      installmentMonths:
        methodRef.current === "card"
          ? installmentMonthsRef.current
          : undefined,
      bank:
        methodRef.current === "bank-transfer" ||
        methodRef.current === "virtual-account"
          ? bankRef.current ?? undefined
          : undefined,
      testMode: adapter.testMode,
      reason: "user",
    });
  }, [adapter.testMode, onComplete, request.amount, request.orderId]);

  useEffect(() => {
    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      if (paypalOrderTimerRef.current) {
        globalThis.clearTimeout(paypalOrderTimerRef.current);
      }
      abortControllerRef.current?.abort();
      document.body.style.overflow = previousOverflow;

      const previouslyFocusedElement = previouslyFocusedElementRef.current;
      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus();
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.tabIndex >= 0);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (
        event.shiftKey &&
        (activeElement === firstElement || !dialog.contains(activeElement))
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastElement || !dialog.contains(activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);

  useEffect(() => {
    if (mounted) closeButtonRef.current?.focus();
  }, [mounted]);

  const isSelectionComplete =
    (method !== "card" || cardIssuer !== null) &&
    (method !== "bank-transfer" || bank !== null) &&
    (method !== "virtual-account" || bank !== null);

  const pay = async () => {
    if (
      !agreed ||
      !isSelectionComplete ||
      view === "processing"
    ) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setView("processing");

    try {
      const nextResult = await adapter.pay(
        {
          request,
          method,
          cardIssuer:
            method === "card" ? cardIssuer ?? undefined : undefined,
          installmentMonths:
            method === "card" ? installmentMonths : undefined,
          bank:
            method === "bank-transfer" || method === "virtual-account"
              ? bank ?? undefined
              : undefined,
          options,
        },
        controller.signal,
      );
      setResult(nextResult);
      setView("result");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      const failure: PaymentFailure = {
        status: "failed",
        orderId: request.orderId,
        amount: request.amount,
        method,
        cardIssuer: method === "card" ? cardIssuer ?? undefined : undefined,
        installmentMonths: method === "card" ? installmentMonths : undefined,
        bank:
          method === "bank-transfer" || method === "virtual-account"
            ? bank ?? undefined
            : undefined,
        testMode: adapter.testMode,
        code: "PAYMENT_ADAPTER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "결제 처리 중 알 수 없는 오류가 발생했습니다.",
        retryable: true,
      };
      setResult(failure);
      setView("result");
    }
  };

  const proceed = () => {
    if (!agreed || !isSelectionComplete) return;

    if (method === "paypal") {
      setView("paypal-creating");
      paypalOrderTimerRef.current = globalThis.setTimeout(() => {
        setPaypalOrderId(`PAYPAL-MOCK-${Date.now().toString(36).toUpperCase()}`);
        setView("authorizing");
        paypalOrderTimerRef.current = null;
      }, 650);
      return;
    }

    if (method === "card" || method === "bank-transfer") {
      setView("authorizing");
      return;
    }

    void pay();
  };

  const retry = () => {
    setResult(null);
    setPaypalOrderId(null);
    setView("selecting");
  };

  const returnToSelection = () => {
    setPaypalOrderId(null);
    setView("selecting");
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="pay-rehearsal-root"
      data-payment-method={method}
      style={style}
    >
      <div
        className="pay-rehearsal-backdrop"
        aria-hidden="true"
        onMouseDown={view === "processing" ? undefined : close}
      />
      <section
        ref={dialogRef}
        className="pay-rehearsal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="pay-rehearsal-header">
          <div>
            <span className="pay-rehearsal-eyebrow">
              {method === "paypal" ? "PAYPAL REHEARSAL" : "PAY REHEARSAL"}
            </span>
            <h2 id={titleId}>결제하기</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="pay-rehearsal-close"
            onClick={close}
            disabled={view === "processing"}
            aria-label="결제창 닫기"
          >
            ×
          </button>
        </header>

        {adapter.testMode && (
          <div className="pay-rehearsal-test-banner" role="status">
            <span>TEST</span>
            실제 결제가 발생하지 않는 개발용 결제창입니다.
          </div>
        )}

        {view === "selecting" && (
          <div className="pay-rehearsal-content">
            <div className="pay-rehearsal-order">
              <div>
                <span>주문 상품</span>
                <strong>{request.orderName}</strong>
                <small>주문번호 {request.orderId}</small>
              </div>
              <strong className="pay-rehearsal-amount">
                {formatAmount(request.amount, request.currency)}
              </strong>
            </div>

            {!isPaymentMethodLocked && (
              <fieldset className="pay-rehearsal-methods">
                <legend>결제수단</legend>
                <div className="pay-rehearsal-method-grid">
                  {paymentMethods.map((paymentMethod) => {
                    const item = METHODS.find(
                      (candidate) => candidate.id === paymentMethod,
                    );
                    if (!item) return null;

                    return (
                      <label
                        key={item.id}
                        className="pay-rehearsal-method"
                        data-selected={method === item.id}
                      >
                        <input
                          type="radio"
                          name="pay-rehearsal-method"
                          value={item.id}
                          checked={method === item.id}
                          onChange={() => setMethod(item.id)}
                        />
                        <span
                          className="pay-rehearsal-method-icon"
                          aria-hidden="true"
                        >
                          {item.icon}
                        </span>
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {method === "card" && (
              <>
                <fieldset className="pay-rehearsal-issuers">
                  <legend>카드사 선택</legend>
                  <div className="pay-rehearsal-issuer-grid">
                    {CARD_ISSUERS.map((issuer) => (
                      <label
                        key={issuer.id}
                        className="pay-rehearsal-issuer"
                        data-selected={cardIssuer === issuer.id}
                      >
                        <input
                          type="radio"
                          name="pay-rehearsal-card-issuer"
                          value={issuer.id}
                          checked={cardIssuer === issuer.id}
                          onChange={() => setCardIssuer(issuer.id)}
                        />
                        <span aria-hidden="true">{issuer.mark}</span>
                        <strong>{issuer.label}</strong>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="pay-rehearsal-installment">
                  <span>할부 선택</span>
                  <select
                    value={installmentMonths}
                    onChange={(event) =>
                      setInstallmentMonths(Number(event.target.value))
                    }
                  >
                    {INSTALLMENT_OPTIONS.map((months) => (
                      <option key={months} value={months}>
                        {months === 0 ? "일시불" : `${months}개월`}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {(method === "bank-transfer" || method === "virtual-account") && (
              <fieldset className="pay-rehearsal-banks">
                <legend>
                  {method === "bank-transfer"
                    ? "출금 은행 선택"
                    : "입금 은행 선택"}
                </legend>
                <div className="pay-rehearsal-bank-grid">
                  {BANKS.map((item) => (
                    <label
                      key={item.id}
                      className="pay-rehearsal-bank"
                      data-selected={bank === item.id}
                    >
                      <input
                        type="radio"
                        name="pay-rehearsal-bank"
                        value={item.id}
                        checked={bank === item.id}
                        onChange={() => setBank(item.id)}
                      />
                      <span aria-hidden="true">{item.mark}</span>
                      <strong>{item.label}</strong>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <label className="pay-rehearsal-agreement">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span>
                {method === "virtual-account"
                  ? "가상계좌 발급 조건과 입금기한을 확인했습니다."
                  : "주문 내용과 테스트 결제 조건을 확인했습니다."}
              </span>
            </label>

            <button
              type="button"
              className="pay-rehearsal-primary"
              disabled={!agreed || !isSelectionComplete}
              onClick={proceed}
            >
              {method === "virtual-account"
                ? "가상계좌 발급"
                : method === "paypal"
                  ? "PayPal로 결제"
                  : `${formatAmount(request.amount, request.currency)} ${
                      method === "bank-transfer" ? "계좌이체" : "테스트 결제"
                    }`}
            </button>
          </div>
        )}

        {view === "paypal-creating" && (
          <div className="pay-rehearsal-state pay-rehearsal-paypal-auth" aria-live="polite">
            <PayPalProgress currentStep="create" />
            <span className="pay-rehearsal-spinner" aria-hidden="true" />
            <h3>PayPal 주문을 생성하고 있어요</h3>
            <p>
              실제 연동에서는 서비스 서버가 금액과 통화를 검증한 뒤 PayPal
              주문 ID를 생성합니다.
            </p>
          </div>
        )}

        {view === "authorizing" &&
          ((method === "bank-transfer" && bank) ||
            (method === "card" && cardIssuer) ||
            method === "paypal") && (
          <div
            className={`pay-rehearsal-state pay-rehearsal-auth-state${
              method === "paypal" ? " pay-rehearsal-paypal-auth" : ""
            }`}
          >
            {method === "paypal" && <PayPalProgress currentStep="approve" />}
            <span className="pay-rehearsal-auth-mark" aria-hidden="true">
              {method === "card" ? "✓" : method === "paypal" ? "P" : "↗"}
            </span>
            <span className="pay-rehearsal-selected-bank">
              {method === "paypal"
                ? "PayPal"
                : method === "card" && cardIssuer
                ? `${getCardIssuerLabel(cardIssuer)} · ${
                    installmentMonths === 0
                      ? "일시불"
                      : `${installmentMonths}개월 할부`
                  }`
                : bank
                  ? `${getBankLabel(bank)} 계좌이체`
                  : null}
            </span>
            <h3>
              {method === "paypal"
                ? "PayPal에서 결제를 승인해 주세요"
                : method === "card"
                ? "카드사 인증을 완료해 주세요"
                : "이체 인증을 완료해 주세요"}
            </h3>
            <p>
              {method === "paypal"
                ? "실제 결제에서는 PayPal 팝업 또는 이동된 페이지에서 로그인하고 결제를 승인합니다."
                : method === "card"
                ? "실제 결제에서는 카드사 앱 또는 카드사 인증창에서 본인 인증과 결제 동의를 진행합니다."
                : "실제 결제에서는 은행 앱 또는 뱅크페이에서 본인 인증과 출금 동의를 진행합니다."}
            </p>
            {method === "paypal" && paypalOrderId && (
              <code className="pay-rehearsal-paypal-order-id">
                Order ID · {paypalOrderId}
              </code>
            )}
            <div className="pay-rehearsal-transfer-summary">
              <span>
                {method === "bank-transfer" ? "이체 금액" : "결제 금액"}
              </span>
              <strong>{formatAmount(request.amount, request.currency)}</strong>
            </div>
            <div className="pay-rehearsal-result-actions">
              <button
                type="button"
                className="pay-rehearsal-secondary"
                onClick={returnToSelection}
              >
                {method === "card"
                  ? "카드 다시 선택"
                  : method === "bank-transfer"
                    ? "은행 다시 선택"
                    : "결제수단 다시 선택"}
              </button>
              <button
                type="button"
                className="pay-rehearsal-primary"
                onClick={() => void pay()}
              >
                {method === "paypal"
                  ? "테스트 PayPal 승인 완료"
                  : method === "card"
                  ? "테스트 카드 인증 완료"
                  : "테스트 인증 완료"}
              </button>
            </div>
          </div>
        )}

        {view === "processing" && (
          <div className="pay-rehearsal-state" aria-live="polite">
            {method === "paypal" && <PayPalProgress currentStep="capture" />}
            <span className="pay-rehearsal-spinner" aria-hidden="true" />
            <h3>
              {method === "virtual-account"
                ? "가상계좌를 발급하고 있어요"
                : method === "bank-transfer"
                  ? "이체 결과를 확인하고 있어요"
                  : method === "paypal"
                    ? "PayPal 결제를 캡처하고 있어요"
                  : "결제를 처리하고 있어요"}
            </h3>
            <p>
              {method === "paypal"
                ? "실제 연동에서는 서비스 서버가 승인된 주문을 캡처하고 완료 상태를 검증합니다."
                : "잠시만 기다려 주세요. 창을 닫지 마세요."}
            </p>
          </div>
        )}

        {view === "result" && result && (
          <div className="pay-rehearsal-state" aria-live="polite">
            <span
              className={`pay-rehearsal-result-icon pay-rehearsal-result-${result.status}`}
              aria-hidden="true"
            >
              {result.status === "success"
                ? "✓"
                : result.status === "pending"
                  ? "₩"
                  : "!"}
            </span>
            <h3>{getResultMessage(result).title}</h3>
            <p>{getResultMessage(result).description}</p>
            {result.status === "pending" && (
              <dl className="pay-rehearsal-virtual-account">
                <div>
                  <dt>입금은행</dt>
                  <dd>{getBankLabel(result.virtualAccount.bank)}</dd>
                </div>
                <div>
                  <dt>계좌번호</dt>
                  <dd>{result.virtualAccount.accountNumber}</dd>
                </div>
                <div>
                  <dt>예금주</dt>
                  <dd>{result.virtualAccount.accountHolder}</dd>
                </div>
                <div>
                  <dt>입금기한</dt>
                  <dd>{formatDueAt(result.virtualAccount.dueAt)}까지</dd>
                </div>
              </dl>
            )}
            {result.status === "success" && (
              <code className="pay-rehearsal-payment-id">{result.paymentId}</code>
            )}
            {method === "paypal" && paypalOrderId && (
              <code className="pay-rehearsal-paypal-order-id">
                Order ID · {paypalOrderId}
              </code>
            )}
            <div className="pay-rehearsal-result-actions">
              {result.status === "failed" && result.retryable && (
                <button
                  type="button"
                  className="pay-rehearsal-secondary"
                  onClick={retry}
                >
                  다시 시도
                </button>
              )}
              <button
                type="button"
                className="pay-rehearsal-primary"
                onClick={() => onComplete(result)}
              >
                확인
              </button>
            </div>
          </div>
        )}

        <footer className="pay-rehearsal-footer">
          Powered by <strong>{adapter.name}</strong>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
