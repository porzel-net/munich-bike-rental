import { rentalLocations, type RentalLocation } from "../inquiries/catalog";

export const adminRoles = ["admin", "standortuser"] as const;
export type AdminRole = (typeof adminRoles)[number];

export type AuthorizedUser = {
  locationKey?: string | null;
  role?: string | null;
  twoFactorEnabled?: boolean | null;
  mustChangePassword?: boolean;
};

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
  return isAdmin(user) || getAssignedLocation(user) !== null;
}

export function canAccessLocation(user: AuthorizedUser, location: RentalLocation) {
  return isAdmin(user) || getAssignedLocation(user) === location;
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
