import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").replace(/\/$/, "");

/**
 * Only the marketing root (src/app/page.tsx's LandingPage, shown to signed-out
 * visitors) is meant for search engines — everything else lives under a
 * tenant slug or requires auth. Tenant slugs are dynamic and unenumerable
 * here, but every one of those routes redirects an unauthenticated crawler
 * to /login anyway, so disallowing the known non-marketing entry points
 * (login, auth, admin, api, mfa-required) covers the real crawl surface.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/login", "/auth/", "/admin", "/mfa-required"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
