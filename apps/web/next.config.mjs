const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // In production, export static HTML served by FastAPI.
  // In development, use Next.js dev server with API proxy.
  ...(isProd ? { output: "export", trailingSlash: true } : {}),
  ...(!isProd
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://localhost:8000/api/:path*",
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
