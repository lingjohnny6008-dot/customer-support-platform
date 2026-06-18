"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  authenticateCustomerWithSecurity,
  authenticateStaffWithSecurity
} from "@/lib/auth";
import { clearSession, createSession } from "@/lib/session";
import type { AuthRole } from "@/lib/types";

export type LoginActionState = {
  error?: string;
};

function getLoginRequestContext() {
  const requestHeaders = headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const realIp = requestHeaders.get("x-real-ip");
  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "unknown";
  const userAgent = requestHeaders.get("user-agent") ?? "unknown";

  return {
    ipAddress,
    userAgent
  };
}

export async function customerLoginAction(
  _previousState: LoginActionState,
  formData: FormData
) {
  try {
    const user = await authenticateCustomerWithSecurity(
      formData,
      getLoginRequestContext()
    );
    await createSession(user);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Login failed."
    };
  }

  redirect("/chat");
}

export async function staffLoginAction(
  _previousState: LoginActionState,
  formData: FormData
) {
  const role = formData.get("role");
  const expectedRole: AuthRole = role === "admin" ? "admin" : "agent";

  try {
    const user = await authenticateStaffWithSecurity(
      formData,
      expectedRole,
      getLoginRequestContext()
    );
    await createSession(user);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Login failed."
    };
  }

  redirect("/dashboard/conversations");
}

export async function logoutAction() {
  clearSession();
  redirect("/login/customer");
}
