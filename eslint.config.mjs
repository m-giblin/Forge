import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Static assets served as-is (embeddable SDKs, vendored third-party
    // bundles like the self-hosted rrweb recorder) are not app source.
    "public/**",
  ]),
  // SEC-10: warn when app-layer code imports the service-role client directly.
  // All DB queries in src/app/ should go through repos in src/lib/repositories/.
  // API routes (src/app/api/) are excluded — they are the machine path and
  // legitimately use service-role through repos.
  // Add: // eslint-disable-next-line no-restricted-imports -- <justification> (sec09)
  // on the import line for approved exceptions (impersonation client-select, etc.)
  {
    files: ["src/app/**/*.ts", "src/app/**/*.tsx"],
    ignores: ["src/app/api/**"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/lib/supabase/service", "**/supabase/service"],
              message:
                "App-layer code must not import the service-role client directly. Use a repo/service in src/lib/ instead (SEC-09/10). Add eslint-disable-next-line with justification for approved exceptions.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
