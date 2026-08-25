import { rentalLocations, type RentalLocation } from "../inquiries/catalog";

export const adminRoles = ["admin", "standortuser"] as const;
export type AdminRole = (typeof adminRoles)[number];

export type AuthorizedUser = {
  locationKey?: string | null;
  role?: string | null;
  twoFactorEnabled?: boolean | null;
  mustChangePassword?: boolean;
  banned?: boolean | null;
  banExpires?: Date | string | number | null;
};

/**
 * A session can outlive a later administrative ban. All authorization paths
 * therefore re-check the current user flags instead of trusting the session
 * only because it is cryptographically valid.
 */
export function isAccountBlocked(user: AuthorizedUser, now = Date.now()) {
  if (user.banned === true) return true;
  if (user.banExpires == null) return false;
  const expiresAt = user.banExpires instanceof Date ? user.banExpires.getTime() : new Date(user.banExpires).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function hasRole(user: AuthorizedUser, role: AdminRole) {
  return user.role === role;
}

export function isAdmin(user: AuthorizedUser) {
  return hasRole(user, "admin");
}

export function isLocationUser(user: AuthorizedUser) {
  return hasRole(user, "standortuser");
}

export function getAssignedLocation(user: AuthorizedUser): RentalLocation | null {
  if (!isLocationUser(user) || !user.locationKey) return null;
  return rentalLocations.includes(user.locationKey as RentalLocation) ? (user.locationKey as RentalLocation) : null;
}

export function canAccessAdmin(user: AuthorizedUser) {
  return !isAccountBlocked(user) && (isAdmin(user) || getAssignedLocation(user) !== null);
}

export function canAccessLocation(user: AuthorizedUser, location: RentalLocation) {
  return !isAccountBlocked(user) && (isAdmin(user) || getAssignedLocation(user) === location);
}

/**
 * Returns the row-level location scope for aggregate views. Administrators
 * may see all locations; location users must always be constrained to their
 * assigned location before a query is built.
 */
export function getVisibleLocationScope(user: AuthorizedUser): RentalLocation | null {
  return isAdmin(user) ? null : getAssignedLocation(user);
}

/**
 * API access requires the same completed setup as the admin layout. Keeping
 * this check separate from the role check prevents a freshly signed-in user
 * who still has to change the initial password from calling mutation APIs
 * directly while the UI is redirecting them to the setup page.
 */
export function hasCompletedAdminSetup(user: AuthorizedUser) {
  return user.twoFactorEnabled === true && user.mustChangePassword !== true;
}

export function canUseAdminApi(user: AuthorizedUser) {
  return hasCompletedAdminSetup(user) && canAccessAdmin(user);
}

export function canUseAdminApiAsAdmin(user: AuthorizedUser) {
  return canUseAdminApi(user) && isAdmin(user);
}

/**
 * Calendar and CardDAV credentials are external admin capabilities. They use
 * the same completed-setup, role, location and current-ban rules as the
 * normal admin API, even though they authenticate with their own credentials.
 */
export function canUseExternalCalendar(user: AuthorizedUser) {
  return hasCompletedAdminSetup(user) && canAccessAdmin(user);
}
