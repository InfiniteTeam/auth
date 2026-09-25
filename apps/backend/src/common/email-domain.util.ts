/**
 * Email domain allow-list helper.
 *
 * Social sign-up is intentionally *not* gated on this list — any verified
 * provider email may register. The list instead decides LDAP eligibility:
 * LDAP sign-in and password management are only available to accounts whose
 * email domain is allow-listed, and the frontend surfaces a dismissible
 * warning for everyone else.
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