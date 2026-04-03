import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  _resetForTest,
  assertSessionActive,
  getRemainingPauseMs,
  isSessionPaused,
  pauseSession,
  SESSION_EXPIRED_ERRCODE,
} from "./session-guard.js";

describe("session guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T00:00:00.000Z"));
    _resetForTest();
  });

  afterEach(() => {
    _resetForTest();
    vi.useRealTimers();
  });

  it("pauses an account for roughly one hour", () => {
    pauseSession("acct-1");

    expect(isSessionPaused("acct-1")).toBe(true);
    expect(getRemainingPauseMs("acct-1")).toBe(60 * 60 * 1000);
  });

  it("throws while the session is paused", () => {
    pauseSession("acct-1");

    expect(() => assertSessionActive("acct-1")).toThrow(
      new RegExp(`errcode ${SESSION_EXPIRED_ERRCODE}`),
    );
  });

  it("clears the pause after the cooldown window elapses", () => {
    pauseSession("acct-1");
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);

    expect(isSessionPaused("acct-1")).toBe(false);
    expect(getRemainingPauseMs("acct-1")).toBe(0);
    expect(() => assertSessionActive("acct-1")).not.toThrow();
  });
});
