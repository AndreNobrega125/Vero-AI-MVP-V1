import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Permite acessar o servidor de dev pelo IP da rede local (celular no
  // mesmo Wi-Fi) — sem isso o Next.js 16 bloqueia HMR/chunks vindos de uma
  // origem que não seja localhost, por segurança.
  allowedDevOrigins: ["192.168.15.108"],
};

export default nextConfig;
