/** @type {import('next').NextConfig} */
function resolveBackendOrigin() {
  const order = [
    process.env.BACKEND_PROXY_ORIGIN?.trim(),
    process.env.BACKEND_API_ORIGIN?.trim(),
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim()
  ];
  for (const raw of order) {
    if (raw) return raw.replace(/\/$/, "");
  }

  // If NEXT_PUBLIC_API_BASE_URL is a full URL, derive origin for rewrites
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
