import { memo } from "react";
import { Check } from "lucide-react";

interface Step {
    id: number;
    label: string;
    description: string;
}

interface OrderStepperProps {
    steps: Step[];
    currentStep: number;
    stepNotes?: Partial<Record<number, string>>;
    hiddenDescriptions?: number[];
}

const OrderStepper = ({ steps, currentStep, stepNotes, hiddenDescriptions }: OrderStepperProps) => {
    return (
        <div className="w-full overflow-x-auto custom-scrollbar">
            <div className="flex min-w-[320px] items-start sm:min-w-0">
                {steps.map((step, index) => {
                    const isDone = currentStep > step.id;
                    const isActive = currentStep === step.id;
                    const isLast = index === steps.length - 1;
                    const stepNote = stepNotes?.[step.id];
                    const shouldHideDescription = hiddenDescriptions?.includes(step.id);

                    return (
                        <div key={step.id} className="flex items-start flex-1 min-w-35 sm:min-w-0">
                            {/* Step circle + label */}
                            <div className="flex flex-col items-center">
                                {/* Circle */}
                                <div
                                    className={`
                    w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center
                    font-bold text-sm transition-all duration-300 border-2
                    ${isDone
                                            ? "bg-main border-main text-primary"
                                            : isActive
                                                ? "bg-primary dark:bg-maindark border-main text-main shadow-lg shadow-main/20"
                                                : "bg-sidebar dark:bg-primarydark border-transparent text-gray-400 dark:text-gray-500"
                                        }
                  `}
                                >
                                    {isDone ? <Check size={16} strokeWidth={2.5} /> : step.id}
                                </div>

                                {/* Label */}
                                <div className="mt-2 text-center px-1">
                                    <p
                                        className={`text-[11px] sm:text-xs font-semibold tracking-wide ${isActive
                                                ? "text-main"
                                                : isDone
                                                    ? "text-main/70 dark:text-main/60"
                                                    : "text-gray-400 dark:text-gray-500"
                                            }`}
                                    >
                                        {step.label}
                                    </p>
                                    {!shouldHideDescription && (
                                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 hidden sm:block">
                                            {step.description}
                                        </p>
                                    )}
                                    {stepNote && (
                                        <p
                                            className={`mt-1 max-w-40 truncate rounded-full border px-2 py-1 text-[11px] font-semibold ${isActive || isDone
                                                    ? "border-main/20 bg-main/10 text-main dark:border-main/25 dark:bg-main/12 dark:text-main"
                                                    : "border-gray-200 bg-sidebar text-main/80 dark:border-primarydark dark:bg-primarydark dark:text-main/80"
                                                }`}
                                            title={stepNote}
                                        >
                                            {stepNote}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Connector line */}
                            {!isLast && (
                                <div className="flex-1 mx-2 mt-4.5 sm:mt-5">
                                    <div className="h-0.5 w-full bg-gray-200 dark:bg-primarydark relative overflow-hidden">
                                        <div
                                            className={`
                        absolute inset-y-0 left-0 bg-main transition-all duration-500
                        ${isDone ? "w-full" : "w-0"}
                      `}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default memo(OrderStepper);
