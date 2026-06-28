"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

const WARN_BEFORE_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

export default function SessionTimeoutGuard({ timeoutMinutes }: { timeoutMinutes: number }) {
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  // eslint-disable-next-line react/no-unstable-default-props -- initialized once on mount, not during render
  const lastActivityRef = useRef<number>(0);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const signOut = useCallback(async () => {
    clearAllTimers();
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    window.location.href = "/?reason=timeout";
  }, [clearAllTimers]);

  const scheduleTimers = useCallback((onWarn?: (secs: number) => void) => {
    clearAllTimers();

    const warnDelay = timeoutMs - WARN_BEFORE_MS;
    const warnSecs = Math.round(WARN_BEFORE_MS / 1000);

    if (warnDelay > 0) {
      warnTimerRef.current = setTimeout(() => {
        if (onWarn) onWarn(warnSecs);
      }, warnDelay);
    } else if (onWarn) {
      // timeout <= 5 min — warn immediately
      setTimeout(() => onWarn(Math.round(timeoutMs / 1000)), 0);
    }

    logoutTimerRef.current = setTimeout(() => {
      signOut();
    }, timeoutMs);
  }, [timeoutMs, clearAllTimers, signOut]);

  const startCountdown = useCallback((secs: number) => {
    setShowWarning(true);
    setSecondsLeft(secs);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const stayLoggedIn = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    scheduleTimers(startCountdown);
  }, [scheduleTimers, startCountdown]);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    scheduleTimers(startCountdown);

    const handler = () => {
      lastActivityRef.current = Date.now();
      // Only reschedule on activity if warning isn't showing
      setShowWarning((showing) => {
        if (!showing) scheduleTimers(startCountdown);
        return showing;
      });
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, handler, { passive: true });
    }

    return () => {
      clearAllTimers();
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, handler);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs]);

  if (!showWarning) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const countdown = mins > 0
    ? `${mins}m ${secs.toString().padStart(2, "0")}s`
    : `${secondsLeft}s`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white shadow-2xl mx-4">
        <div className="p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 mb-4">
            <span className="text-2xl">⏱</span>
          </div>
          <h2 className="text-base font-semibold text-neutral-900">
            Your session is about to expire
          </h2>
          <p className="mt-1.5 text-sm text-neutral-500">
            You&apos;ll be signed out automatically due to inactivity. Click below to stay signed in.
          </p>
          <div className="mt-4 flex items-center justify-center rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <span className="text-2xl font-mono font-bold text-amber-700 tabular-nums">
              {countdown}
            </span>
          </div>
        </div>
        <div className="flex gap-3 border-t border-neutral-100 px-6 py-4">
          <button
            onClick={stayLoggedIn}
            className="flex-1 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
          >
            Stay signed in
          </button>
          <button
            onClick={signOut}
            className="rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
