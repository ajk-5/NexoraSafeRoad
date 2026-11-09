export const PASSWORD_REQUIREMENTS = "Use 15–128 characters. Avoid common passwords and repeated patterns.";
const COMMON_PASSWORDS = new Set([
  "passwordpassword", "password123456789", "123456789012345", "12345678901234567890",
  "qwertyuiopasdfgh", "qwertyuiop123456", "letmeinletmeinletmein",
  "correcthorsebatterystaple", "iloveyouiloveyou", "adminadminadmin",
  "saferoadsaferoad", "saferoad123456789",
]);

export function passwordError(password: string): string | null {
  const characters = [...password];
  const compact = password.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const repeated = [1, 2, 3, 4].some((size) => password === characters.slice(0, size).join("").repeat(Math.floor(characters.length / size)));
  return characters.length < 15 || characters.length > 128 || !compact || COMMON_PASSWORDS.has(compact) || repeated
    ? PASSWORD_REQUIREMENTS : null;
}
