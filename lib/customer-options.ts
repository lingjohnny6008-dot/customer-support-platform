import type { CustomerLanguage, CustomerStatus } from "@/lib/types";

export const customerLanguages: CustomerLanguage[] = ["zh", "en", "ms"];
export const customerStatuses: CustomerStatus[] = [
  "active",
  "blocked",
  "suspended"
];

export function isCustomerLanguage(value: string): value is CustomerLanguage {
  return customerLanguages.includes(value as CustomerLanguage);
}

export function isCustomerStatus(value: string): value is CustomerStatus {
  return customerStatuses.includes(value as CustomerStatus);
}
