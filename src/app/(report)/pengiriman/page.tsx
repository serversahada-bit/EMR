import { BelumTerisi } from "@/components/BelumTerisi";

export default function PengirimanPage() {
  return (
    <BelumTerisi
      title="Pengiriman & retur"
      subtitle="Ketepatan kirim, kegagalan COD, dan biaya retur"
      rencana={[
        "Status paket dan ketepatan SLA per ekspedisi",
        "Tingkat retur dan alasannya (rts_reason)",
        "Kegagalan COD dan nilai yang tertahan",
        "Sebaran per wilayah dan distribution center",
      ]}
      sumber={["tracking", "data_transaksi"]}
      catatan={
        "tabel tracking berisi 171.744 baris dan belum dipakai sama sekali " +
        "oleh aplikasi ini — datanya sudah lengkap, jadi halaman ini tidak " +
        "menunggu ekstraksi apa pun. COD mendominasi pembayaran " +
        "(236 ribu pesanan), sehingga retur dan COD gagal adalah biaya " +
        "nyata yang sekarang tidak terlihat di mana pun."
      }
    />
  );
}
