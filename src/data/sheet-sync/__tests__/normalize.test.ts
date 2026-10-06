import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  normalizeHp,
  normalizeNama,
  normalizeTanggal,
  normalizeTimestamp,
  normalizeUang,
  tersensor,
} from "../normalize";

describe("normalizeTanggal", () => {
  test("serial Excel jadi tanggal", () => {
    assert.equal(normalizeTanggal(46288), "2026-09-23");
    assert.equal(normalizeTanggal(45292), "2024-01-01");
  });

  test("serial yang terlanjur jadi string tetap terbaca", () => {
    assert.equal(normalizeTanggal("46288"), "2026-09-23");
  });

  test("serial dengan pecahan jam tetap memberi tanggal yang sama", () => {
    assert.equal(normalizeTanggal(46288.47013888889), "2026-09-23");
  });

  test("dd/mm/yyyy dan dd-mm-yyyy", () => {
    assert.equal(normalizeTanggal("23/09/2026"), "2026-09-23");
    assert.equal(normalizeTanggal("23-09-2026"), "2026-09-23");
    assert.equal(normalizeTanggal("1/2/2026"), "2026-02-01");
  });

  test("yyyy-mm-dd dibiarkan apa adanya", () => {
    assert.equal(normalizeTanggal("2026-09-23"), "2026-09-23");
  });

  /* Sheet September 2026 punya 710 baris berbentuk begini; menolaknya
     dulu menghilangkan omset ratusan juta. */
  test("tanggal yang membawa jam tetap terbaca", () => {
    assert.equal(normalizeTanggal("22/09/2026 12:59"), "2026-09-22");
    assert.equal(normalizeTanggal("22/09/2026 08:34:10"), "2026-09-22");
    assert.equal(normalizeTanggal("2026-09-22 12:59"), "2026-09-22");
  });

  /* Inilah alasan fungsi ini ada: baris yang tanggalnya tak terbaca
     harus ditolak, bukan disimpan jadi 0000-00-00. */
  test("nilai tak terbaca jadi null, bukan string kosong", () => {
    assert.equal(normalizeTanggal(""), null);
    assert.equal(normalizeTanggal(null), null);
    assert.equal(normalizeTanggal(undefined), null);
    assert.equal(normalizeTanggal("DKI Jakarta"), null);
    assert.equal(normalizeTanggal("23/09"), null);
  });

  test("tanggal yang tidak ada ditolak", () => {
    assert.equal(normalizeTanggal("31/02/2026"), null);
    assert.equal(normalizeTanggal("31/31/2026"), null);
    assert.equal(normalizeTanggal("29/02/2025"), null);
    assert.equal(normalizeTanggal("29/02/2024"), "2024-02-29");
  });
});

describe("normalizeTimestamp", () => {
  test("serial Excel membawa jamnya", () => {
    assert.equal(normalizeTimestamp(46288.47013888889), "2026-09-23 11:17:00");
  });

  test("string tanggal plus jam", () => {
    assert.equal(normalizeTimestamp("23/09/2026 11:17"), "2026-09-23 11:17:00");
    assert.equal(
      normalizeTimestamp("23/09/2026 11:17:45"),
      "2026-09-23 11:17:45",
    );
  });

  test("tanpa jam jatuh ke tengah malam", () => {
    assert.equal(normalizeTimestamp("23/09/2026"), "2026-09-23 00:00:00");
  });

  test("kosong jadi null", () => {
    assert.equal(normalizeTimestamp(""), null);
    assert.equal(normalizeTimestamp("entah"), null);
  });
});

describe("normalizeUang", () => {
  /* Format inilah yang diam-diam menghilangkan Rp 99,7 juta lewat CAST. */
  test("pemisah ribuan gaya Indonesia dibersihkan", () => {
    assert.equal(normalizeUang("18.000,00"), "18000.00");
    assert.equal(normalizeUang("1.234.567,89"), "1234567.89");
    assert.equal(normalizeUang("288.000"), "288000");
  });

  test("titik desimal sungguhan TIDAK ikut dibuang", () => {
    assert.equal(normalizeUang("16.5"), "16.5");
    assert.equal(normalizeUang("0.75"), "0.75");
  });

  test("koma desimal jadi titik", () => {
    assert.equal(normalizeUang("10,5"), "10.5");
  });

  test("angka polos dan negatif lewat tanpa diubah", () => {
    assert.equal(normalizeUang("18000"), "18000");
    assert.equal(normalizeUang("-7000"), "-7000");
    assert.equal(normalizeUang(18000), "18000");
  });

  test("bukan angka dikembalikan apa adanya agar ditolak validasi", () => {
    assert.equal(normalizeUang("DKI Jakarta"), "DKI Jakarta");
    assert.equal(normalizeUang(""), "");
  });
});

describe("pembantu lain", () => {
  test("normalizeHp membuang plus dan pemisah", () => {
    assert.equal(normalizeHp("+62 812-3456.789"), "628123456789");
    assert.equal(normalizeHp("(0812) 345"), "0812345");
  });

  test("normalizeNama jadi huruf besar", () => {
    assert.equal(normalizeNama(" dhani:mt "), "DHANI:MT");
  });

  test("tersensor menemukan tanda bintang", () => {
    assert.equal(tersensor("0812***456"), true);
    assert.equal(tersensor("08123456"), false);
    assert.equal(tersensor(""), false);
  });
});
