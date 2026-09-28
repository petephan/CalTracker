import { isAuthError } from "@supabase/supabase-js";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/** Keep in step with the minimum set in the Supabase dashboard (Authentication → Providers → Email). */
export const MIN_PASSWORD = 8;

/** Turns a Supabase auth error into a sentence for the login screen. */
export function authErrorMessage(error: unknown): string {
  if (!isAuthError(error)) return "Something went wrong. Try again.";
  switch (error.code) {
    case "invalid_credentials":
      return "That email and password don't match.";
    case "email_not_confirmed":
      return "Confirm your email first. Check your inbox for the link.";
    case "user_already_exists":
    case "email_exists":
      return "There's already an account with that email. Sign in instead.";
    case "weak_password":
      return error.message || `Choose a stronger password (at least ${MIN_PASSWORD} characters).`;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
  }
  if (error.name === "AuthRetryableFetchError") return "Can't reach the server. Check your connection.";
  return error.message || "Something went wrong. Try again.";
}
