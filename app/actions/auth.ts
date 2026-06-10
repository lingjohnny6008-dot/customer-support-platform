"use server";

import { redirect } from "next/navigation";
import { authenticateCustomer, authenticateStaff } from "@/lib/auth";
import { clearSession, createSession } from "@/lib/session";
import type { AuthRole } from "@/lib/types";

export type LoginActionState = {
  error?: string;
};

export async function customerLoginAction(
  _previousState: LoginActionState,
  formData: FormData
) {
  try {
    const user = await authenticateCustomer(formData);
    await createSession(user);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "登录失败。"
    };
  }

  redirect("/dashboard");
}

export async function staffLoginAction(
  _previousState: LoginActionState,
  formData: FormData
) {
  const role = formData.get("role");
  const expectedRole: AuthRole = role === "admin" ? "admin" : "agent";

  try {
    const user = await authenticateStaff(formData, expectedRole);
    await createSession(user);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "登录失败。"
    };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  clearSession();
  redirect("/login/customer");
}
