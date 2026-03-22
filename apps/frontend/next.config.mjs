/** @type {import('next').NextConfig} */
function resolveBackendOrigin() {
  const explicit = process.env.BACKEND_API_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  // If only NEXT_PUBLIC_API_BASE_URL is set to full URL (e.g. Vercel Git deploys), derive origin for rewrites
  const pub = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (pub?.startsWith("http")) {
    try {
      return new URL(pub).origin;
    } catch {
      return "";
    }
  }
  return "";
}

const nextConfig = {
  async rewrites() {
    const backendOrigin = resolveBackendOrigin();
    if (!backendOrigin) return [];

    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`
      },
      {
        source: "/uploads/:path*",
        destination: `${backendOrigin}/uploads/:path*`
      }
    ];
  }
};

export default nextConfig;
