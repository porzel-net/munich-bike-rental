// Compatibility URL for previously mailed links. Tokens are resolved against
// the new booking_offers table; the legacy confirmation path is intentionally
// no longer allowed to mutate inquiries or accounting rows.
export { POST } from "../booking-confirmation-v2/route";
export const runtime = "nodejs";
