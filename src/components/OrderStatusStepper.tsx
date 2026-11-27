import { Fragment } from 'react';
import { FigmaIcon } from './FigmaIcon';

export interface OrderStatusStepperProps {
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  compact?: boolean;
  className?: string;
}

const ORDER_STEPS = [
  { number: 1, label: 'Order Placed' },
  { number: 2, label: 'Processing' },
  { number: 3, label: 'Shipped' },
  { number: 4, label: 'Delivered' },
  { number: 5, label: 'Completed' },
] as const;

function resolveCompletedStep(
  rawStatus: string,
  rawPaymentStatus?: string,
): {
  completedStep: number;
  isCancelled: boolean;
  isRefunded: boolean;
} {
  const status = (rawStatus || '').toLowerCase();
  const paymentStatus = (rawPaymentStatus || '').toLowerCase();

  if (status === 'cancelled') {
    return { completedStep: 1, isCancelled: true, isRefunded: false };
  }
  if (status === 'refunded' || paymentStatus === 'refunded') {
    return { completedStep: 1, isCancelled: false, isRefunded: true };
  }

  if (status === 'completed') {
    return { completedStep: 5, isCancelled: false, isRefunded: false };
  }
  if (status === 'delivered') {
    return { completedStep: 4, isCancelled: false, isRefunded: false };
  }
  if (status === 'shipped') {
    return { completedStep: 3, isCancelled: false, isRefunded: false };
  }
  if (status === 'processing' || status === 'confirmed') {
    return { completedStep: 2, isCancelled: false, isRefunded: false };
  }

  // Default pending / awaiting payment -> Step 1 (Order Placed)
  return { completedStep: 1, isCancelled: false, isRefunded: false };
}

export function OrderStatusStepper({
  status,
  paymentStatus,
  compact = false,
  className = '',
}: OrderStatusStepperProps) {
  const { completedStep, isCancelled, isRefunded } = resolveCompletedStep(
    status,
    paymentStatus,
  );

  return (
    <div
      className={`bg-[#f9f9fb] border border-[#ececec] rounded-[16px] ${
        compact ? 'px-4 py-4' : 'px-5 py-4.5'
      } ${className}`}
    >
      {(isCancelled || isRefunded) && (
        <div className="mb-3.5 flex items-center gap-2 rounded-[10px] bg-[#fdecec] border border-[#fad8d8] px-3 py-2 text-[12px] font-semibold text-[#e5322d]">
          <FigmaIcon name="alert-circle" className="w-4 h-4 shrink-0" />
          <span>
            {isCancelled
              ? 'This order was cancelled and will not proceed further.'
              : 'This order has been refunded.'}
          </span>
        </div>
      )}

      {/* Desktop / tablet full-width horizontal numbered stepper */}
      <div
        className={`hidden sm:flex items-center justify-between w-full ${
          compact ? 'pb-6' : 'pb-7'
        }`}
      >
        {ORDER_STEPS.map((step, idx) => {
          const isCompleted = step.number <= completedStep;
          const isConnectorCompleted = step.number < completedStep;
          const isFirst = idx === 0;
          const isLast = idx === ORDER_STEPS.length - 1;

          return (
            <Fragment key={step.number}>
              <div className="relative flex flex-col items-center shrink-0">
                <span
                  aria-current={
                    step.number === completedStep ? 'step' : undefined
                  }
                  className={`${
                    compact ? 'w-7 h-7 text-[12px]' : 'w-8 h-8 text-[13px]'
                  } rounded-full font-bold flex items-center justify-center shrink-0 transition-colors ${
                    isCompleted
                      ? isCancelled || isRefunded
                        ? 'bg-[#e5322d] text-white'
                        : 'bg-[#ff6e20] text-white'
                      : 'kova-stepper-circle-muted bg-[#eaeaf2] text-[#4b5563]'
                  }`}
                >
                  {step.number}
                </span>
                <span
                  className={`absolute top-full whitespace-nowrap leading-snug ${
                    compact ? 'mt-2 text-[11px]' : 'mt-2.5 text-[12px]'
                  } ${
                    isFirst
                      ? 'left-0 text-left'
                      : isLast
                        ? 'right-0 text-right'
                        : 'left-1/2 -translate-x-1/2 text-center'
                  } ${
                    isCompleted
                      ? 'font-bold text-[#1c1c1c]'
                      : 'font-semibold text-[#767676]'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div
                  className={`h-[1.5px] flex-1 mx-2.5 rounded-full transition-colors ${
                    isConnectorCompleted
                      ? 'bg-[#ff6e20]'
                      : 'kova-stepper-line-muted bg-[#dfe1ea]'
                  }`}
                />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Mobile compact vertical numbered stepper */}
      <div className="flex flex-col gap-2.5 sm:hidden">
        {ORDER_STEPS.map((step, idx) => {
          const isCompleted = step.number <= completedStep;
          const isConnectorCompleted = step.number < completedStep;
          const isLast = idx === ORDER_STEPS.length - 1;

          return (
            <div key={step.number} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`w-7 h-7 rounded-full text-[12px] font-bold flex items-center justify-center shrink-0 ${
                    isCompleted
                      ? isCancelled || isRefunded
                        ? 'bg-[#e5322d] text-white'
                        : 'bg-[#ff6e20] text-white'
                      : 'kova-stepper-circle-muted bg-[#eaeaf2] text-[#4b5563]'
                  }`}
                >
                  {step.number}
                </span>
                {!isLast && (
                  <div
                    className={`w-[1.5px] h-4 mt-1 rounded-full ${
                      isConnectorCompleted
                        ? 'bg-[#ff6e20]'
                        : 'kova-stepper-line-muted bg-[#dfe1ea]'
                    }`}
                  />
                )}
              </div>
              <p
                className={`pt-1 text-[12.5px] leading-snug ${
                  isCompleted
                    ? 'font-bold text-[#1c1c1c]'
                    : 'font-semibold text-[#767676]'
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
