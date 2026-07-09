import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Ensure xlsx and exceljs are bundled into the standalone output
  // (they're used by API routes for Excel generation — no Python needed)
  serverExternalPackages: ["xlsx", "exceljs"],
  outputFileTracingIncludes: {
    "/api/excel-template": ["./node_modules/xlsx/**/*", "./node_modules/exceljs/**/*"],
    "/api/reports/export": ["./node_modules/xlsx/**/*", "./node_modules/exceljs/**/*"],
    "/api/import": ["./node_modules/xlsx/**/*"],
  },
};

export default nextConfig;
