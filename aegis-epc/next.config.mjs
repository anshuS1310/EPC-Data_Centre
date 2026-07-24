/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,

  // Proxy all /backend/* calls through Next.js server to the FastAPI backend.
  // This fixes "Failed to fetch" when the browser accesses the site via a
  // network IP (e.g. 172.25.x.x/WSL) — the browser can't reach 127.0.0.1:8000
  // directly, but the Next.js server can because it runs on the same machine.
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    return [
      {
        source: "/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },

  // Increase HTTP keep-alive and header timeouts for the proxy.
  // The E: network drive adds significant latency; default 30s is too short
  // for long-running backend operations like schedule update-impact.
  experimental: {
    proxyTimeout: 300000, // 300 seconds — handles Render free-tier cold start
  },
};

export default nextConfig;
