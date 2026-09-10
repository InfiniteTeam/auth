/**
 * Email domain allow-list helpers for the social sign-up gate.
 */

/** True when the email's domain is part of the allowed domain list. */
export function isEmailDomainAllowed(
  email: string,
  allowedDomains: readonly string[],
): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) {
    return false;
  }
  const domain = email.slice(at + 1);
  return allowedDomains.some(
    (allowed) => allowed.toLowerCase() === domain.toLowerCase(),
  );
}