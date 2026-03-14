/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backendOrigin = process.env.BACKEND_API_ORIGIN?.trim();
    if (!backendOrigin) return [];

    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin.replace(/\/$/, "")}/api/:path*`
      },
      {
        source: "/uploads/:path*",
        destination: `${backendOrigin.replace(/\/$/, "")}/uploads/:path*`
      }
    ];
  }
};

export default nextConfig;
