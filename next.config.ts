import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /* Halaman laporan dinamis (force-dynamic), jadi bawaannya tiap
       perpindahan menu meminta ulang ke server. Dengan dynamic: 30,
       kembali ke halaman yang dibuka ≤30 dtk lalu memakai salinan di
       browser — terasa instan. Halaman "Realtime" tetap menyegarkan
       sendiri lewat router.refresh() (yang melewati salinan ini). */
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
