import { describe, expect, test } from "bun:test";

import { resetFailureMessage, resetInputIssue, resetPath } from "./password-reset";

describe("resetPath", () => {
  test("points at the endpoints of the side being reset", () => {
    expect(resetPath("kitchen", "forgot")).toBe("/kitchen-auth/password/forgot");
    expect(resetPath("store", "reset")).toBe("/store-auth/password/reset");
  });
});

describe("resetInputIssue", () => {
  test("asks for a real email first", () => {
    expect(resetInputIssue({ email: "nope" })).toBe("Enter the email you log in with.");
    expect(resetInputIssue({ email: " a@b.co " })).toBeNull();
  });

  test("checks the code and the new password once they are asked for", () => {
    expect(resetInputIssue({ email: "a@b.co", code: "123", password: "longenough" })).toBe(
      "Enter the 6-digit code we emailed you.",
    );
    expect(resetInputIssue({ email: "a@b.co", code: "123456", password: "short" })).toBe(
      "Password needs at least 8 characters.",
    );
    expect(resetInputIssue({ email: "a@b.co", code: "123456", password: "x".repeat(73) })).toBe(
      "Password can be at most 72 characters.",
    );
    expect(resetInputIssue({ email: "a@b.co", code: "123456", password: "longenough" })).toBeNull();
  });
});

describe("resetFailureMessage", () => {
  test("counts down the tries left on a wrong code", () => {
    expect(resetFailureMessage({ status: 401, message: "Invalid", body: { attemptsRemaining: 2 } })).toBe(
      "That code isn't right. 2 tries left.",
    );
    expect(resetFailureMessage({ status: 401, message: "Invalid", body: { attemptsRemaining: 1 } })).toBe(
      "That code isn't right. 1 try left.",
    );
    expect(resetFailureMessage({ status: 401, message: "Invalid", body: { attemptsRemaining: 0 } })).toBe(
      "That code is used up. Ask for a new one.",
    );
  });

  test("says when a code has expired", () => {
    expect(resetFailureMessage({ status: 400, message: "Code expired", body: {} })).toBe(
      "That code has expired. Ask for a new one.",
    );
  });

  test("turns a rate limit into a wait", () => {
    expect(resetFailureMessage({ status: 429, message: "x", body: { retryAfterSeconds: 45 } })).toBe(
      "Too many tries. Wait 45 seconds and try again.",
    );
    expect(resetFailureMessage({ status: 429, message: "x", body: { retryAfterSeconds: 600 } })).toBe(
      "Too many tries. Wait 10 minutes and try again.",
    );
  });

  test("leaves anything else to the caller", () => {
    expect(resetFailureMessage({ status: 500, message: "boom", body: {} })).toBeNull();
  });
});
