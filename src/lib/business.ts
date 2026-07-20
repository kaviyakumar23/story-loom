/**
 * Single source of truth for the business identity shown on /legal/* pages.
 * Fill every [TODO] before enabling payments — Razorpay activation reviews the
 * public terms/privacy/refund/contact pages, and the DPDP Act requires a
 * reachable grievance officer. The draft banner on legal pages clears itself
 * once no [TODO] values remain.
 */
export const BUSINESS = {
  brandName: 'MoonBell',
  legalName: '[TODO: legal/business name]',
  registeredAddress: '[TODO: registered address]',
  supportEmail: '[TODO: support email, e.g. support@moonbell.com]',
  grievanceOfficerName: '[TODO: grievance officer name]',
  grievanceOfficerEmail: '[TODO: grievance officer email]',
  /** Courts of this city get exclusive jurisdiction in the Terms. */
  governingLawCity: '[TODO: governing-law city]',
  effectiveDate: '[TODO: effective date, e.g. 1 August 2026]',

  // Committed service windows (already concrete — adjust if you can't meet them).
  grievanceAckWindow: '48 hours',
  grievanceResolveWindow: '30 days',
  refundAckWindow: '2 business days',
  refundResolveWindow: '7 business days',
} as const;

/** True once every [TODO] above has been replaced with a real value. */
export const BUSINESS_DETAILS_COMPLETE = !Object.values(BUSINESS).some((v) => v.includes('[TODO'));
