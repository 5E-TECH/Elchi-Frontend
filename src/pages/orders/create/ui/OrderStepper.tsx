import { memo } from "react";
import { Check, ChevronRight, Sparkles } from "lucide-react";

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
    const totalSteps = steps.length;
    const completedSteps = steps.filter((step) => currentStep > step.id).length;
    const progressPercent =
        totalSteps <= 1 ? 100 : ((Math.min(currentStep, totalSteps) - 1) / (totalSteps - 1)) * 100;

    return (
        <div className="relative overflow-hidden rounded-[1.75rem] border border-main/10 bg-linear-to-br from-main/[0.08] via-transparent to-main/[0.03] p-4 sm:p-5">
            <div className="pointer-events-none absolute inset-0 opacity-70">
                <div className="absolute -left-10 top-0 h-28 w-28 rounded-full bg-main/10 blur-3xl" />
                <div className="absolute right-0 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-main/8 blur-3xl" />
            </div>

            <div className="relative space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full border border-main/15 bg-main/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-main">
                            <Sparkles size={13} />
                            Order Flow
                        </div>
                        <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                            <h3 className="text-base font-extrabold text-gray-900 dark:text-white sm:text-lg">
                                Buyurtma yaratish bosqichlari
                            </h3>
                            <span className="text-sm font-medium text-gray-500 dark:text-white/45">
                                {completedSteps} / {totalSteps} completed
                            </span>
                        </div>
                    </div>

                    <div className="min-w-[170px] rounded-2xl border border-white/50 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-white/8 dark:bg-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400 dark:text-white/35">
                            Progress
                        </p>
                        <div className="mt-2 flex items-end justify-between gap-3">
                            <strong className="text-2xl font-black leading-none text-main">
                                {Math.round(progressPercent)}%
                            </strong>
                            <span className="text-xs font-medium text-gray-500 dark:text-white/45">
                                Step {Math.min(currentStep, totalSteps)} of {totalSteps}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-gray-200/80 dark:bg-white/8">
                    <div
                        className="h-full rounded-full bg-linear-to-r from-main/70 via-main to-main shadow-[0_0_24px_rgba(99,102,241,0.35)] transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    {steps.map((step, index) => {
                        const isDone = currentStep > step.id;
                        const isActive = currentStep === step.id;
                        const stepNote = stepNotes?.[step.id];
                        const shouldHideDescription = hiddenDescriptions?.includes(step.id);

                        return (
                            <div
                                key={step.id}
                                className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 ${
                                    isActive
                                        ? "border-main/35 bg-white shadow-lg shadow-main/10 dark:bg-white/8"
                                        : isDone
                                            ? "border-main/20 bg-main/[0.07] dark:bg-main/[0.08]"
                                            : "border-gray-200/80 bg-white/75 dark:border-white/8 dark:bg-white/[0.03]"
                                }`}
                            >
                                <div className="absolute right-3 top-3 opacity-70">
                                    {index < steps.length - 1 ? (
                                        <ChevronRight
                                            size={16}
                                            className={`${
                                                isDone || isActive
                                                    ? "text-main"
                                                    : "text-gray-300 dark:text-white/15"
                                            }`}
                                        />
                                    ) : null}
                                </div>

                                <div className="flex items-start gap-4">
                                    <div
                                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-sm font-extrabold transition-all ${
                                            isDone
                                                ? "border-main bg-main text-white shadow-md shadow-main/25"
                                                : isActive
                                                    ? "border-main/35 bg-main/12 text-main"
                                                    : "border-gray-200 bg-sidebar text-gray-400 dark:border-white/10 dark:bg-primarydark dark:text-white/35"
                                        }`}
                                    >
                                        {isDone ? <Check size={18} strokeWidth={2.75} /> : `0${step.id}`}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span
                                                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                                                    isActive
                                                        ? "bg-main/12 text-main"
                                                        : isDone
                                                            ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                                                            : "bg-gray-100 text-gray-500 dark:bg-white/6 dark:text-white/35"
                                                }`}
                                            >
                                                {isDone ? "Completed" : isActive ? "Current" : "Pending"}
                                            </span>
                                        </div>

                                        <h4
                                            className={`mt-3 text-sm font-extrabold sm:text-base ${
                                                isActive || isDone
                                                    ? "text-gray-900 dark:text-white"
                                                    : "text-gray-500 dark:text-white/45"
                                            }`}
                                        >
                                            {step.label}
                                        </h4>

                                        {!shouldHideDescription ? (
                                            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-white/45 sm:text-sm">
                                                {step.description}
                                            </p>
                                        ) : null}

                                        {stepNote ? (
                                            <div
                                                className={`mt-3 inline-flex max-w-full items-center rounded-xl border px-3 py-2 text-xs font-semibold ${
                                                    isActive || isDone
                                                        ? "border-main/20 bg-main/10 text-main"
                                                        : "border-gray-200 bg-sidebar text-gray-500 dark:border-white/8 dark:bg-primarydark dark:text-white/50"
                                                }`}
                                                title={stepNote}
                                            >
                                                <span className="truncate">{stepNote}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default memo(OrderStepper);
