import React, { useEffect, useMemo, useRef, useState } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { motion } from "framer-motion";

type ValidationStepStatus = 'passed' | 'failed' | 'skipped' | 'pending' | string;

interface FullScreenAnimationProps {
    src: string;
    title: string;
    description: string;
    loop?: boolean;
    timeline?: Array<{
        key?: string;
        label: string;
        status: ValidationStepStatus;
        detail?: string;
    }>;
    revealDelayMs?: number;
    finalHoldMs?: number;
    onSequenceComplete?: () => void;
    primaryAction?: {
        label: string;
        onClick: () => void;
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
}

export const FullScreenAnimation: React.FC<FullScreenAnimationProps> = ({
    src,
    title,
    description,
    loop = false,
    timeline = [],
    revealDelayMs = 700,
    finalHoldMs = 1800,
    onSequenceComplete,
    primaryAction,
    secondaryAction,
}) => {
    const ref = useRef<any>(null);
    const hasTimeline = timeline.length > 0;
    const completionNotifiedRef = useRef(false);
    const [revealedCount, setRevealedCount] = useState(0);
    const [isSequenceComplete, setIsSequenceComplete] = useState(false);

    const statusStyles: Record<string, string> = {
        passed: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-300",
        failed: "border-red-200 bg-red-50 text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300",
        skipped: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
        pending: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300",
    };

    const statusGlyph: Record<string, string> = {
        passed: "check_circle",
        failed: "error",
        skipped: "remove_circle",
        pending: "schedule",
    };

    const failureIndex = useMemo(
        () => timeline.findIndex((step) => String(step.status || '').toLowerCase() === 'failed'),
        [timeline],
    );
    const revealTargetCount = hasTimeline
        ? (failureIndex >= 0 ? failureIndex + 1 : timeline.length)
        : 0;

    useEffect(() => {
        completionNotifiedRef.current = false;
        setRevealedCount(0);
        setIsSequenceComplete(false);
        const timers: number[] = [];

        if (!hasTimeline) {
            const doneTimer = window.setTimeout(() => {
                setIsSequenceComplete(true);
                if (!completionNotifiedRef.current) {
                    completionNotifiedRef.current = true;
                    onSequenceComplete?.();
                }
            }, finalHoldMs);
            timers.push(doneTimer);
            return () => {
                timers.forEach((timer) => window.clearTimeout(timer));
            };
        }

        for (let index = 1; index <= revealTargetCount; index += 1) {
            const timer = window.setTimeout(() => {
                setRevealedCount(index);
            }, revealDelayMs * index);
            timers.push(timer);
        }

        const doneTimer = window.setTimeout(() => {
            setIsSequenceComplete(true);
            if (!completionNotifiedRef.current) {
                completionNotifiedRef.current = true;
                onSequenceComplete?.();
            }
        }, revealDelayMs * Math.max(revealTargetCount, 1) + finalHoldMs);
        timers.push(doneTimer);

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [finalHoldMs, hasTimeline, onSequenceComplete, revealDelayMs, revealTargetCount]);

    const shouldRenderActionBar =
        Boolean(primaryAction || secondaryAction) && isSequenceComplete;

    return (
        <div className="fixed inset-0 z-50 overflow-auto bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors duration-200">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(239,68,68,0.14),_transparent_46%),radial-gradient(circle_at_bottom_left,_rgba(15,23,42,0.1),_transparent_52%)] dark:bg-[radial-gradient(circle_at_top_right,_rgba(239,68,68,0.18),_transparent_46%),radial-gradient(circle_at_bottom_left,_rgba(148,163,184,0.12),_transparent_55%)]" />
            <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-10">
            <DotLottieReact
                src={src}
                autoplay
                loop={loop}
                style={{ width: 260, height: 260 }}
                dotLottieRefCallback={(dotLottie) => {
                    ref.current = dotLottie;
                }}
            />
            <h2 className="mt-6 px-4 text-center text-2xl font-bold text-slate-900 dark:text-white">
                {title}
            </h2>
            <p className="mt-2 max-w-xl whitespace-pre-wrap px-4 text-center text-sm leading-6 text-slate-600 dark:text-slate-300">
                {description}
            </p>
            {hasTimeline && (
                <div className="mt-7 w-full max-w-2xl px-2 sm:px-4">
                    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-[0_18px_48px_-24px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/55">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            Validation Timeline
                        </p>
                        <div className="space-y-2.5">
                            {timeline.map((step, index) => {
                                const status = String(step.status || 'pending').toLowerCase();
                                const palette = statusStyles[status] || statusStyles.pending;
                                const glyph = statusGlyph[status] || statusGlyph.pending;
                                const isVisible = index < revealedCount;
                                const showMutedPending = isSequenceComplete && failureIndex >= 0 && index > failureIndex;

                                if (!isVisible && !showMutedPending) {
                                    return null;
                                }

                                return (
                                    <motion.div
                                        key={step.key || `${step.label}-${index}`}
                                        initial={{ opacity: 0, y: 10, scale: 0.985 }}
                                        animate={{
                                            opacity: showMutedPending ? 0.58 : 1,
                                            y: 0,
                                            scale: 1,
                                        }}
                                        transition={{ duration: 0.24, ease: 'easeOut' }}
                                        className={`rounded-xl border px-3 py-2.5 ${palette}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-base">{glyph}</span>
                                            <p className="text-sm font-semibold">{step.label}</p>
                                        </div>
                                        {step.detail && (
                                            <p className="mt-1 text-xs opacity-90">
                                                {step.detail}
                                            </p>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
            {shouldRenderActionBar && (
                <div className="mt-6 flex w-full max-w-md flex-wrap items-center justify-center gap-3 px-4">
                    {secondaryAction && (
                        <button
                            type="button"
                            onClick={secondaryAction.onClick}
                            className="h-10 rounded-xl border border-slate-300 bg-white/80 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            {secondaryAction.label}
                        </button>
                    )}
                    {primaryAction && (
                        <button
                            type="button"
                            onClick={primaryAction.onClick}
                            className="h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500"
                        >
                            {primaryAction.label}
                        </button>
                    )}
                </div>
            )}
            </div>
        </div>
    );
};
