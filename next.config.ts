import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Source-map upload + release management. org/project/authToken come from the
  // env (set SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN in CI/Vercel to get
  // readable production stack traces); upload is skipped when they're absent.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Better client-side stack traces.
  widenClientFileUpload: true,
  // Proxy Sentry ingestion through our own domain so ad-blockers don't drop
  // client events. (No middleware to exclude it from.)
  tunnelRoute: "/monitoring",
  // Quiet locally; verbose in CI.
  silent: !process.env.CI,
  // Don't let the build plugin phone home.
  telemetry: false,
});
