import { BelumTerisi } from "@/components/BelumTerisi";

export default function CrmPage() {
  return (
    <BelumTerisi
      title="CRM & blast"
      subtitle="Penyumbang omset terbesar, tapi biayanya belum terlihat"
      rencana={[
        "Biaya blast: cost chat, ongkir, promo hadiah, cashback, free produk",
        "Closing, conversion rate, box, dan upsell per hari",
        "Omset CRM dibanding biayanya",
        "Performa per CS",
      ]}
      sumber={[
        "sheet PERFORMA BLAST CRM (belum diekstrak)",
        "data_transaksi (adv = CRM)",
        "data_cs",
      ]}
      catatan={
        "CRM menyumbang omset terbesar — Rp451 juta pada September 2026 dari " +
        "1.672 pesanan — tapi sisi biayanya nol di aplikasi ini. Sheet " +
        "PERFORMA BLAST CRM paling bersih dari semua sheet pendukung dan " +
        "sudah memuat kolom omset."
      }
    />
  );
}
