import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { cariBarisHeader, uraiSheet } from "../parse-sheet";

const HEADER = [
  "Tanggal Proses",
  "Unique Code",
  "CONTACT*",
  "FIRST NAME",
  "ADDRESS 1*",
  "Harga Barang",
  "Ongkir",
  "CS",
  "ADV",
  "Kolom Aneh",
];

/** Sheet warisan kerap punya baris judul sebelum header sebenarnya. */
const PEMBUKA = [["LAPORAN TRANSAKSI"], [], ["dicetak 01/10/2026"]];

const BARIS_SAH = [
  "23/09/2026",
  "BK001",
  "628123",
  "Flo",
  "Jl Mawar",
  "18.000,00",
  "9000",
  "laily",
  "dhani:mt",
  "abaikan",
];

describe("cariBarisHeader", () => {
  test("menemukan baris yang kolom A-nya Tanggal Proses", () => {
    assert.equal(cariBarisHeader([...PEMBUKA, HEADER, BARIS_SAH]), 3);
  });

  test("menerima salah ketik lama Tangal Proses", () => {
    const header = ["Tangal Proses", ...HEADER.slice(1)];
    assert.equal(cariBarisHeader([header]), 0);
  });

  test("header hanya dikenali di kolom A", () => {
    assert.equal(cariBarisHeader([["Nomor", "Tanggal Proses"]]), -1);
  });

  test("tidak ada header sama sekali", () => {
    assert.equal(cariBarisHeader([["a", "b"], ["c"]]), -1);
  });
});

describe("uraiSheet", () => {
  const rows = [
    ...PEMBUKA,
    HEADER,
    BARIS_SAH,
    /* CONTACT kosong — dilewati, bukan error. */
    ["24/09/2026", "BK002", "", "Budi", "Jl X", "5000", "9000", "cs", "adv", ""],
    /* Tanggal tak terbaca — dicatat sebagai error baris. */
    ["entah", "BK003", "628999", "Cici", "Jl Y", "5000", "9000", "cs", "adv", ""],
    /* Data tersensor — transaksi tetap masuk, customer tidak. */
    [
      "25/09/2026",
      "BK004",
      "0812***99",
      "Dedi",
      "Jl Z***",
      "7000",
      "9000",
      "cs2",
      "adv2",
      "",
    ],
    [],
  ];

  const hasil = uraiSheet(rows);

  test("hanya baris setelah header yang jadi data", () => {
    assert.equal(hasil.barisHeader, 3);
    assert.equal(hasil.baris.length, 2);
    assert.deepEqual(
      hasil.baris.map((b) => b.kodeBooking),
      ["BK001", "BK004"],
    );
  });

  test("nomor baris mengikuti penomoran sheet", () => {
    assert.equal(hasil.baris[0].nomorBaris, 5);
  });

  test("baris tanpa CONTACT dan baris kosong dihitung dilewati", () => {
    assert.equal(hasil.dilewati, 2);
  });

  test("tanggal gagal jadi error baris, proses tetap lanjut", () => {
    assert.equal(hasil.errors.length, 1);
    assert.equal(hasil.errors[0].row, 7);
    assert.match(hasil.errors[0].reason, /tanggal_proses/);
  });

  test("kolom uang dinormalkan saat diurai", () => {
    assert.equal(hasil.baris[0].kolom.total_harga, "18000.00");
  });

  test("nama CS dan ADV jadi huruf besar", () => {
    assert.equal(hasil.baris[0].cs, "LAILY");
    assert.equal(hasil.baris[0].adv, "DHANI:MT");
  });

  test("tanda bintang menahan penyimpanan customer", () => {
    assert.equal(hasil.baris[0].bolehSimpanCustomer, true);
    assert.equal(hasil.baris[1].bolehSimpanCustomer, false);
  });

  test("kolom asing dilaporkan, bukan diam-diam dibuang", () => {
    assert.deepEqual(hasil.kolomTakDikenal, ["Kolom Aneh"]);
  });

  test("header tidak ditemukan dilaporkan sebagai error, bukan melempar", () => {
    const kosong = uraiSheet([["a"], ["b"]]);
    assert.equal(kosong.barisHeader, -1);
    assert.equal(kosong.baris.length, 0);
    assert.match(kosong.errors[0].reason, /header tidak ditemukan/i);
  });
});

/* Jaring pengaman untuk aturan "jangan hardcode indeks kolom": kolom
   yang diacak harus memberi hasil yang sama persis. */
describe("urutan kolom tidak memengaruhi hasil", () => {
  test("header diacak memberi nilai yang sama", () => {
    const acak = [
      "Tanggal Proses",
      "Ongkir",
      "ADV",
      "Unique Code",
      "Harga Barang",
      "CS",
      "ADDRESS 1*",
      "CONTACT*",
      "FIRST NAME",
    ];
    const baris = [
      "23/09/2026",
      "9000",
      "dhani:mt",
      "BK001",
      "18.000,00",
      "laily",
      "Jl Mawar",
      "628123",
      "Flo",
    ];

    const hasil = uraiSheet([acak, baris]);
    assert.equal(hasil.baris.length, 1);
    assert.equal(hasil.baris[0].kodeBooking, "BK001");
    assert.equal(hasil.baris[0].kolom.total_harga, "18000.00");
    assert.equal(hasil.baris[0].kolom.ongkir, "9000");
    assert.equal(hasil.baris[0].adv, "DHANI:MT");
    assert.equal(hasil.baris[0].kolom.first_name, "Flo");
  });
});
