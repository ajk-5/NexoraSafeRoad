import { expect, it } from "vitest";
import { passwordError } from "./passwordPolicy";

it.each(["short", "fourteen-chars", "passwordpassword", "PASSWORD-PASSWORD", "123456789012345", "a".repeat(20), "abcd".repeat(8), " ".repeat(20), "x".repeat(129)])("rejects a weak or invalid password: %s", (password) => {
  expect(passwordError(password)).toBeTruthy();
});

it.each(["Three otters cross a river!", "aB3!dE6@gH9#kL2", "Une longue phrase française", "🦦".repeat(14) + "x"])("allows a long unique password or passphrase", (password) => {
  expect(passwordError(password)).toBeNull();
});
