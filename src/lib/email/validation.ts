export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.length <= 254;
}
