import { BelumTerisi } from "@/components/BelumTerisi";

export default function MutuDataPage() {
  return (
    <BelumTerisi
      title="Mutu data"
      subtitle="Apa yang rusak, hilang, atau tidak konsisten di database"
      rencana={[
        "Transaksi bertanggal tidak valid",
        "Nilai adv yang tidak terpeta ke channel mana pun",
        "Label yang tidak konsisten antar sumber",
        "Bulan yang bolong per produk dan per kanal",
        "Selisih antara Excel dan database",
      ]}
      sumber={["data_transaksi", "data_adv + data_channel", "data_spend_*"]}
      catatan={
        "masalahnya sudah terukur: 10.563 dari 508.328 transaksi bertanggal " +
        "0000-00-00, 197 pesanan September 2026 ber-adv yang tidak terpeta " +
        "ke channel, dan label pembayaran ditulis dua cara ('cod' dan " +
        "'Cash on Delivery'). Fungsi mutuData() di omset-queries.ts sudah " +
        "ada dan bisa jadi titik mulai."
      }
    />
  );
}
