/**
 * A passkey is accepted as the second factor only when the authenticator
 * actually performed user verification (for example a biometric or device
 * PIN). A mere key touch is not sufficient for the admin area.
 */
export function hasUserVerifiedPasskey(value: { userVerified?: boolean } | null | undefined) {
  return value?.userVerified === true;
}
