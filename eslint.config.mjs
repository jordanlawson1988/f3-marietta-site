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
    // Legacy standalone project (consolidated into main app)
    "f3-automation/**",
  ]),
  {
    rules: {
      // The redesign uses "// ..." as intentional military-style UI branding
      // throughout MonoTag components and decorative text nodes — not code comments.
      "react/jsx-no-comment-textnodes": "off",
      // Closing mobile menu on pathname change is a standard Next.js pattern
      // (synchronous setState in effect is safe here — it's a user-triggered reset).
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
