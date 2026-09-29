import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import React from "react";

// Mock Supabase
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

// Mock blindEvalApi
vi.mock("@/api/blindEvalApi", () => ({
  fetchUserRoles: vi.fn().mockResolvedValue([]),
  saveUserRole: vi.fn().mockResolvedValue(true),
  fetchSystemDefaultRole: vi.fn().mockResolvedValue("user"),
  saveSystemDefaultRole: vi.fn().mockResolvedValue(true),
  batchUpdateUsersRole: vi.fn().mockResolvedValue(0),
}));

describe("Guest Authentication Flow", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should initialize as not guest when no storage or session exists", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    let hookResult: any;
    await act(async () => {
      hookResult = renderHook(() => useAuth(), { wrapper });
    });

    expect(hookResult.result.current.isGuest).toBe(false);
  });

  it("should successfully log in as guest, persist in localStorage, and set user role", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    let hookResult: any;
    await act(async () => {
      hookResult = renderHook(() => useAuth(), { wrapper });
    });

    await act(async () => {
      hookResult.result.current.loginAsGuest();
    });

    expect(hookResult.result.current.isGuest).toBe(true);
    expect(hookResult.result.current.user).not.toBeNull();
    expect(hookResult.result.current.user?.id.startsWith("guest_")).toBe(true);
    expect(hookResult.result.current.user?.user_metadata?.is_guest).toBe(true);
    expect(hookResult.result.current.user?.user_metadata?.full_name).toBe("Guest Traveler");
    expect(hookResult.result.current.role).toBe("user");
    expect(hookResult.result.current.actualRole).toBe("user");
    expect(hookResult.result.current.isDev).toBe(false);
    expect(localStorage.getItem("pix_is_guest")).toBe("true");
  });

  it("should clear guest state and localStorage when signing out", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    let hookResult: any;
    await act(async () => {
      hookResult = renderHook(() => useAuth(), { wrapper });
    });

    await act(async () => {
      hookResult.result.current.loginAsGuest();
    });

    expect(hookResult.result.current.isGuest).toBe(true);
    expect(localStorage.getItem("pix_is_guest")).toBe("true");

    await act(async () => {
      await hookResult.result.current.signOut();
    });

    expect(hookResult.result.current.isGuest).toBe(false);
    expect(hookResult.result.current.user).toBeNull();
    expect(localStorage.getItem("pix_is_guest")).toBeNull();
  });
});
