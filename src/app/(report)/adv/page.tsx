import { BelumTerisi } from "@/components/BelumTerisi";

export default function AdvPage() {
  return (
    <BelumTerisi
      title="Performa ADV"
      subtitle="Satu kartu nilai per advertiser, lintas kanal dan produk"
      rencana={[
        "Spend, lead, closing, dan box per ADV per bulan",
        "CPL dan CPA per ADV, dibanding rata-rata tim",
        "Produk dan kanal yang dipegang tiap ADV",
        "Riwayat perpindahan produk antar bulan",
      ]}
      sumber={[
        "data_spend_meta + data_spend_google (lewat id_adv)",
        "data_transaksi (kolom adv)",
        "data_adv",
      ]}
      catatan={
        "penggabungan nama. Satu orang bisa muncul dengan beberapa ejaan " +
        "nama sheet: Imam dan Muslih adalah orang yang sama, begitu juga " +
        "Gusti dan Gusty. Kalau tidak digabungkan, satu orang akan tampil " +
        "dua kali dan spend-nya terbagi."
      }
    />
  );
}
