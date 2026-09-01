"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, LoaderCircle, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SequenceMark } from "@/components/logo";

export type ChatStep =
  | { kind: "in"; text: string }
  | { kind: "out"; text: string; link?: string }
  | { kind: "action"; pending: string; done: string }
  | { kind: "status"; text: string };

/* Per-step reveal gaps (ms). "out" includes the typing-indicator pause. */
const GAP: Record<ChatStep["kind"], number> = {
  in: 1100,
  out: 1700,
  action: 1200,
  status: 1300,
};
const FIRST_DELAY = 600;
const HOLD_AFTER = 5200;

function TypingDots() {
  return (
    <div className="flex w-fit items-center gap-1 self-end rounded-2xl rounded-br-[6px] border border-[var(--bubble-border)] bg-[var(--bubble-bg)] px-3.5 py-2.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-accent/60"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

export function ChatPlayer({
  script,
  chrome,
  title,
  subtitle,
  time,
  domain,
  bodyClassName = "",
  srDescription,
  className = "",
}: {
  script: ChatStep[];
  chrome: "whatsapp" | "widget";
  title: string;
  subtitle?: string;
  time?: string;
  domain?: string;
  bodyClassName?: string;
  srDescription: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(0);
  const [cycle, setCycle] = useState(0);

  const reveal = useMemo(() => {
    const times: number[] = [];
    script.forEach((step, i) => {
      times.push(i === 0 ? FIRST_DELAY : times[i - 1] + GAP[step.kind]);
    });
    return times;
  }, [script]);

  useEffect(() => {
    if (reduce) return;

    const timers = script.map((_, i) =>
      setTimeout(() => setVisible(i + 1), reveal[i]),
    );
    timers.push(
      setTimeout(() => {
        setVisible(0);
        setCycle((c) => c + 1);
      }, reveal[reveal.length - 1] + HOLD_AFTER),
    );
    return () => timers.forEach(clearTimeout);
  }, [cycle, reduce, script, reveal]);

  const steps = reduce ? script : script.slice(0, visible);
  const next = reduce ? undefined : script[visible];
  const showTyping = !reduce && visible > 0 && next?.kind === "out";

  return (
    <div className={className}>
      <p className="sr-only">{srDescription}</p>
      <div aria-hidden className="glass-slab overflow-hidden rounded-2xl">
        {chrome === "widget" && (
          <div className="flex items-center gap-2 border-b border-edge/80 px-4 py-2.5">
            <span className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
            </span>
            <span className="mx-auto rounded-[8px] border border-edge bg-canvas px-3 py-1 font-mono text-[10.5px] tracking-[0.06em] text-muted">
              {domain}
            </span>
            <span className="w-[52px]" />
          </div>
        )}

        <div className="flex items-center gap-3 border-b border-edge/80 px-4 py-3">
          {chrome === "whatsapp" ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src="/logos/whatsapp-green.svg"
              alt=""
              width={20}
              height={20}
              className="size-5"
            />
          ) : (
            <SequenceMark className="size-5 text-accent" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold text-fg">
              {title}
            </p>
            {subtitle && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted">
                <span className="size-1.5 rounded-full bg-signal" />
                {subtitle}
              </p>
            )}
          </div>
          {time && (
            <span className="font-mono text-[10.5px] tracking-[0.1em] text-muted">
              {time}
            </span>
          )}
        </div>

        {/* Fixed-height, bottom-anchored window: the conversation grows
            upward inside the frame, so the page never reflows. */}
        <div
          className={`flex flex-col justify-end gap-2.5 overflow-hidden px-4 py-4 ${bodyClassName}`}
        >
          {steps.map((step, i) => {
            const key = `${cycle}-${i}`;

            if (step.kind === "status") {
              return (
                <motion.div
                  key={key}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="mx-auto mt-1 flex items-center gap-1.5 rounded-[10px] border border-signal/30 bg-signal/10 px-3 py-1.5"
                >
                  <CheckCircle2
                    className="size-3.5 shrink-0 text-signal"
                    strokeWidth={2}
                  />
                  <span className="text-[12.5px] font-medium leading-snug text-signal">
                    {step.text}
                  </span>
                </motion.div>
              );
            }

            if (step.kind === "action") {
              const done = reduce || visible > i + 1;
              return (
                <motion.div
                  key={key}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="flex w-fit items-center gap-2 self-start rounded-[10px] border border-edge bg-surface/90 px-3 py-1.5"
                >
                  {done ? (
                    <CheckCircle2
                      className="size-3.5 shrink-0 text-signal"
                      strokeWidth={2}
                    />
                  ) : (
                    <LoaderCircle
                      className="size-3.5 shrink-0 text-accent motion-safe:animate-spin"
                      strokeWidth={2}
                    />
                  )}
                  <span className="font-mono text-[11.5px] leading-snug text-muted">
                    {done ? step.done : step.pending}
                  </span>
                </motion.div>
              );
            }

            const incoming = step.kind === "in";
            return (
              <motion.div
                key={key}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className={
                  incoming
                    ? "w-fit max-w-[85%] self-start rounded-2xl rounded-bl-[6px] border border-edge bg-surface px-3.5 py-2.5"
                    : "w-fit max-w-[85%] self-end rounded-2xl rounded-br-[6px] border border-[var(--bubble-border)] bg-[var(--bubble-bg)] px-3.5 py-2.5"
                }
              >
                <p className="text-[14px] leading-snug text-fg">{step.text}</p>
                {step.kind === "out" && step.link && (
                  <span className="mt-2 flex w-fit items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-1.5">
                    <Lock className="size-3.5 text-signal" strokeWidth={1.5} />
                    <span className="text-[12.5px] font-medium text-signal">
                      {step.link}
                    </span>
                  </span>
                )}
              </motion.div>
            );
          })}
          {showTyping && <TypingDots />}
        </div>
      </div>
    </div>
  );
}
