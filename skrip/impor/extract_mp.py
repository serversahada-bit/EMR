# Extractor MARKETPLACE (MP = Market Place) dari file Progres.
#
# SUMBER RESMI hanya DUA sheet: "MP TOTAL" dan "TIKTOK TOTAL NEW".
#   Sheet MP lain (MP SHOPEE, MP LAZADA, shopee why, MP SHOPEE-WHY,
#   Admin MP Kikik, MP PHENOBODY, MP GNAIT) adalah rincian kerja, bukan
#   rekaman resmi -- jangan dipakai, karena blok agregatnya tidak
#   rekonsiliasi dengan blok per-toko (Plus Sep 2026: jumlah per-toko
#   16.453.439 vs agregat 17.100.391, selisih 646.952 tanpa penjelasan).
#
# SATU SHEET BERISI BEBERAPA BLOK BERTUMPUK, dan layoutnya BEDA-BEDA.
# Blok dikenali dari baris yang kolom pertamanya "DATE"/"TANGGAL".
# Tiga layout yang dipakai:
#
#   A. PLATFORM  -- biaya per toko Shopee/Lazada
#      DATE | Biaya Proses pesanan | Biaya Admin Shopee | Biaya Sampel |
#      Komisi Affiliate | Biaya Layanan Lainnya | TOTAL SPEND |
#      Spend Iklan | Casback Proteksi ROAS | CTR | JUMLAH PESANAN
#
#   B. REALISASI -- satu-satunya yang membawa OMSET di MP TOTAL
#      DATE | Spend Total | Biaya Admin dll | Alamat | Omset Iklan |
#      Omset Total | Box | Capaian | Akuisisi Iklan | Upselling |
#      Akuisisi Total | BOX BULAN LALU
#
#   C. TIKTOK    -- membawa OMSET dan TOTAL BOX langsung
#      DATE | Biaya Proses pesanan | Biaya Admin | Biaya Sampel |
#      Komisi Affiliate | TOTAL SPEND | Spend Iklan (gmv max) |
#      JUMLAH PESANAN | Biaya Akuisisi Customer Ads |
#      Biaya Akuisisi box | OMSET | TOTAL BOX
#
# Blok bergranularitas lain (CAMPAIGN 1/2/3, "Spend Progam",
# "Spend +Tax") DILEWATI: bukan rekaman harian per toko.
#
# BARIS TARIF: tepat di bawah header sering ada baris konstanta
# (1250, 0.165, 25000) -- bukan data. Tersaring sendiri karena kolom
# tanggalnya bukan tanggal. Begitu pula baris "TOTAL / RATA RATA".
#
# BLOK AGREGAT ditandai, bukan dibuang: labelnya memuat "TOTAL".
# Jangan pernah menjumlahkan lintas penanda `agregat`.
import calendar
import datetime
import re

from extract_progres import cell

# Nama sheet berganti di tengah 2025. Sumber per periode:
#   Shopee/Lazada : "MP TOTAL" (layout lama, Jan-Sep 2025)
#                   "MP TOTAL NEW" (Sep-Des 2025)
#                   "MP TOTAL" (layout baru, 2026)
#   TikTok        : "TIKTOK TOTAL" (Mei-Sep 2025)
#                   "TIKTOK TOTAL NEW" (Sep 2025 - 2026)
# SEPTEMBER 2025 tercatat di sheet lama DAN baru -- jangan dimuat dua-duanya
# sebelum dipastikan isinya sama atau berbeda.
SHEET_PER_TAHUN = {
    # 2026: ditetapkan pengguna -- hanya dua sheet ini. JANGAN tambah
    # "MP TOTAL NEW" di sini: file 2026 juga punya sheet itu, dan
    # memuatnya menambah 714 baris (Rp913 jt spend) yang tumpang tindih.
    2026: ("MP TOTAL", "TIKTOK TOTAL NEW"),
    2025: ("MP TOTAL", "MP TOTAL NEW", "TIKTOK TOTAL", "TIKTOK TOTAL NEW"),
}
# Nama lama dipertahankan supaya pemanggil 2026 yang sudah ada
# (gen_sql_mp.py, build_all_mp_2026.py) tidak berubah perilakunya.
SHEET_RESMI = SHEET_PER_TAHUN[2026]


# Bulan peralihan: sheet LAMA dilewati supaya bulan itu tidak terhitung
# dua kali. September 2025 tercatat di sheet lama dan baru sekaligus;
# yang dipakai sheet BARU karena formatnya sama dengan Okt-Des 2025 dan
# 2026. Ganti di sini kalau ingin memakai sheet lama.
LEWATI_SHEET = {
    (2025, 9): ("MP TOTAL", "TIKTOK TOTAL"),
}


def sheet_resmi(tahun, bulan_no=None):
    """Daftar sheet sumber untuk satu tahun (dan bulan, kalau peralihan)."""
    daftar = SHEET_PER_TAHUN.get(tahun, SHEET_RESMI)
    lewati = {x.upper() for x in LEWATI_SHEET.get((tahun, bulan_no), ())}
    return tuple(x for x in daftar if x.upper() not in lewati)
MAX_BARIS = 200
MAX_KOLOM = 24

# label ternormalisasi -> nama kanonik
LABEL = {
    "date": "tanggal",
    "tanggal": "tanggal",
    "biaya proses pesanan": "biaya_proses_pesanan",
    "biaya admin shopee": "biaya_admin",
    "biaya admin": "biaya_admin",
    "biaya admin dll": "biaya_admin",
    "biaya sampel": "biaya_sampel",
    "komisi affiliate": "komisi_affiliate",
    "biaya layanan lainnya": "biaya_layanan_lain",
    "total spend": "total_spend",
    "spend total": "total_spend",
    "spend iklan": "spend_iklan",
    "spend iklan gmv max": "spend_iklan",
    "casback proteksi roas": "cashback_proteksi_roas",
    "ctr": "ctr",
    "jumlah pesanan": "jumlah_pesanan",
    "biaya akuisisi customer ads": "biaya_akuisisi_customer",
    "biaya akuisisi box": "biaya_akuisisi_box",
    "alamat": "alamat",
    "omset iklan": "omset_iklan",
    "omset total": "omset_total",
    "omset": "omset_total",
    "box": "box",
    "total box": "box",
    "box bulan lalu": "box_bulan_lalu",
    "capaian": "capaian",
    "akuisisi iklan": "akuisisi_iklan",
    "akuisisi total": "akuisisi_total",
    "upselling": "upselling",
    "up-selling": "upselling",
    # --- layout LAMA 2025 (MP TOTAL & TIKTOK TOTAL) ---
    # "Budget" berdiri di posisi spend dan TIKTOK TOTAL varian lain
    # menulis "Spend" di posisi yang sama -- jadi diperlakukan sbg spend.
    # Asumsi ini BELUM diverifikasi ke pemilik sheet.
    "budget": "total_spend",
    "spend": "total_spend",
    "total omset": "omset_total",
    "omset ads": "omset_iklan",
    "gmv ads": "omset_iklan",
    "omset organik": "omset_organik",
    "gmv organik": "omset_organik",
    "total customer": "total_customer",
}

FIELDS = [
    "biaya_proses_pesanan", "biaya_admin", "biaya_sampel",
    "komisi_affiliate", "biaya_layanan_lain", "total_spend", "spend_iklan",
    "cashback_proteksi_roas", "ctr", "jumlah_pesanan",
    "biaya_akuisisi_customer", "biaya_akuisisi_box",
    "alamat", "omset_iklan", "omset_total", "box", "box_bulan_lalu",
    "capaian", "akuisisi_iklan", "akuisisi_total", "upselling",
    # hanya ada di layout lama 2025
    "omset_organik", "total_customer",
]

# satu-satunya kolom teks; sisanya wajib angka
TEKS_FIELDS = {"alamat"}

# blok yang dilewati: granularitasnya bukan harian-per-toko
LEWATI = re.compile(r"campaign|spend progam|spend program|spend \+tax|"
                    r"real kompensasi|ratecard|gama off", re.I)


def norm(v):
    if v is None:
        return ""
    return re.sub(r"\s+", " ", str(v).replace("\n", " ")).strip().lower()


def _peta(baris_header):
    """-> ({nama_snake: idx}, [label tak terpetakan])"""
    out, lepas = {}, []
    for j, v in enumerate(baris_header):
        lbl = norm(v)
        if not lbl:
            continue
        canon = LABEL.get(lbl)
        if canon is None:
            # awalan: "spend iklan gmv max", "biaya akuisisi box/pcs"
            for pat, nm in (("spend iklan", "spend_iklan"),
                            ("biaya akuisisi customer", "biaya_akuisisi_customer"),
                            ("biaya akuisisi box", "biaya_akuisisi_box"),
                            ("jumlah pesanan", "jumlah_pesanan"),
                            ("total spend", "total_spend")):
                if lbl.startswith(pat):
                    canon = nm
                    break
        if canon and canon not in out:
            out[canon] = j
        elif canon is None:
            lepas.append((j + 1, lbl))
    return out, lepas


def layout(cmap):
    """Bentuk blok, dikenali dari kolom KHASNYA.

    Dulu blok platform 2026 salah tergolong "TIKTOK" karena aturannya
    "punya omset + jumlah pesanan" -- padahal header platform 2026 juga
    memuat OMSET dan JUMLAH PESANAN. Akibatnya perbandingan platform vs
    realisasi tidak bisa dilakukan. Sekarang tiap bentuk dikenali dari
    kolom yang HANYA dia punya. Kanal (Shopee/Lazada vs TikTok) tidak
    ditentukan di sini, melainkan dari nama sheet.
    """
    if "alamat" in cmap:
        return "REALISASI"          # Spend Total | Alamat | Omset Iklan ...
    if "omset_organik" in cmap or "total_customer" in cmap:
        return "LAMA"               # Budget | Omset Ads | Omset Organik ...
    if "jumlah_pesanan" in cmap or "biaya_proses_pesanan" in cmap:
        return "PLATFORM"           # Biaya Proses | TOTAL SPEND | Jumlah Pesanan
    return "?"


def _ujung(raw, hi, i_tgl):
    """Indeks (eksklusif) baris terakhir tabel yang header-nya di baris `hi`.

    Tabel berakhir di baris "TOTAL / RATA RATA", di judul tabel berikutnya
    ("DATE"), atau saat tanggal MUNDUR (31/10 lalu 01/10 lagi). Dulu yang
    dibaca selalu 44 baris di bawah header tanpa berhenti: di sheet MP TOTAL
    2026 tabel ke-2 ("TOTAL MP <PRODUK>") menempel tepat di bawah, sehingga
    tgl 1-5 miliknya ikut terbaca dengan susunan kolom tabel ke-1 -> baris
    HANTU (box = sel tanggal = "2026", spend = box asli). Ditemukan 23 Okt
    2026: 55 baris di DB server (+111 ribu box palsu).
    """
    akhir = min(len(raw), hi + 45)
    lalu = None
    for k in range(hi + 1, akhir):
        rr = raw[k]
        if not rr:
            continue
        teks = [norm(rr[j]) for j in {0, i_tgl} if j < len(rr) and isinstance(rr[j], str)]
        if any(t in ("date", "tanggal") or t.startswith("total") or "rata rata" in t or "rata-rata" in t
               for t in teks):
            return k
        d = rr[i_tgl] if i_tgl < len(rr) else None
        if isinstance(d, datetime.datetime):
            if lalu is not None and d <= lalu:
                return k
            lalu = d
    return akhir


def _label_basi(raw, hi, i_tgl, tahun, bulan_no):
    """Bulan label (th, bl) bila SEMUA tanggal di blok berasal dari satu
    bulan lain yang paling jauh 3 bulan sebelum bulan file; selain itu None.

    Kasus: TIKTOK TOTAL NEW di file Agustus & September 2026 masih berlabel
    "Juli" padahal isinya data bulan itu (box Sep = 696 = box TikTok di
    COST OF SALES Sep; Juli di DB = 985). Blok berlabel Oktober 2025 di sheet
    yang sama terlalu jauh -> bukan label basi, tetap dibuang.
    """
    bulan = {(rr[i_tgl].year, rr[i_tgl].month) for rr in raw[hi + 1:_ujung(raw, hi, i_tgl)]
             if rr and i_tgl < len(rr) and isinstance(rr[i_tgl], datetime.datetime)}
    if len(bulan) != 1:
        return None
    th, bl = bulan.pop()
    selisih = (tahun * 12 + bulan_no) - (th * 12 + bl)
    return (th, bl) if 1 <= selisih <= 3 else None


def blok_ws(ws, tahun, bulan_no, bulan_basi=False):
    """-> (daftar blok, daftar label tak terpetakan)

    Tiap blok: {label, agregat, layout, baris: [rec, ...]}.
    Hanya baris bertanggal tahun+bulan yang diminta -- sheet beku
    (file Oktober yang isinya Juli) otomatis menghasilkan 0 baris.

    bulan_basi=True (HANYA dipakai importer link, bukan muatan per tahun):
    blok yang tidak punya satu pun tanggal bulan file tetapi seluruh
    labelnya dari satu bulan lain <=3 bulan sebelumnya dipindah ke bulan
    file (hari tetap) dan ditandai `label_basi`. Importer lalu membuangnya
    bila isinya sama persis dengan data bulan label di database (= beku).
    """
    ws.reset_dimensions()
    raw = list(ws.iter_rows(min_row=1, max_row=MAX_BARIS, max_col=MAX_KOLOM,
                            values_only=True))
    blok, lepas_semua = [], []
    # Label basi hanya ditoleransi kalau SELURUH sheet tidak punya satu pun
    # tanggal bulan file. Sheet yang sudah punya blok bulan ini dan masih
    # menyimpan blok bulan lalu (MP TOTAL NEW Premium Nov 2025: blok Nov +
    # blok Okt) -> blok lama itu sisa, bukan data bulan ini.
    if bulan_basi:
        bulan_basi = not any(rr and isinstance(v, datetime.datetime) and (v.year, v.month) == (tahun, bulan_no)
                             for rr in raw for v in rr[:3])
    for hi, r in enumerate(raw):
        if not r or norm(r[0]) not in ("date", "tanggal"):
            continue
        head = list(r)
        gabung = " | ".join(norm(v) for v in head if v)
        if LEWATI.search(gabung):
            continue
        cmap, lepas = _peta(head)
        # Label tak terpetakan dicatat SEBELUM blok bisa ditolak. Dulu
        # urutannya terbalik, sehingga blok yang ditolak karena headernya
        # tidak dikenal lenyap tanpa jejak di laporan -- 16 blok MP TOTAL
        # 2025 (header "Budget | Total Omset") hilang dengan laporan
        # "label tak terpetakan: (tidak ada)".
        lepas_semua.extend(lepas)
        if "tanggal" not in cmap:
            continue
        if "total_spend" not in cmap and "omset_total" not in cmap:
            lepas_semua.append((0, "[BLOK DITOLAK] " + gabung[:90]))
            continue

        # label blok: dua baris di atas header, digabung
        atas = []
        for k in range(max(0, hi - 2), hi):
            v = raw[k][0] if raw[k] else None
            if isinstance(v, str) and v.strip():
                atas.append(" ".join(v.split()))
        label = " / ".join(atas)

        i_tgl = cmap["tanggal"]
        akhir = _ujung(raw, hi, i_tgl)
        basi = None
        if bulan_basi:
            ada_bulan_ini = any(rr and i_tgl < len(rr) and isinstance(rr[i_tgl], datetime.datetime)
                                and (rr[i_tgl].year, rr[i_tgl].month) == (tahun, bulan_no)
                                for rr in raw[hi + 1:akhir])
            if not ada_bulan_ini:
                basi = _label_basi(raw, hi, i_tgl, tahun, bulan_no)
        n_hari = calendar.monthrange(tahun, bulan_no)[1]
        baris = []
        for rr in raw[hi + 1:akhir]:
            d = rr[i_tgl] if rr and i_tgl < len(rr) else None
            if not isinstance(d, datetime.datetime):
                continue
            if basi and (d.year, d.month) == basi:
                if d.day > n_hari:
                    continue
                d = datetime.datetime(tahun, bulan_no, d.day)
            if d.year != tahun or d.month != bulan_no:
                continue
            rec = {"tanggal": d.date()}
            teks_di_angka = []
            for f in FIELDS:
                j = cmap.get(f)
                v = cell(rr[j]) if (j is not None and j < len(rr)) else None
                # Kolom angka tidak boleh berisi teks. Teks di sini hampir
                # selalu LABEL dari tabel lain yang menempel (TIKTOK TOTAL
                # 2025: "Target Customer", "Target Spend", "Omset", "Box").
                if f not in TEKS_FIELDS and isinstance(v, str):
                    teks_di_angka.append(f)
                    v = None
                rec[f] = v
            # Dua kolom angka atau lebih berisi teks -> ini baris header
            # tabel lain, bukan data. Dibuang utuh, tapi dilaporkan.
            if len(teks_di_angka) >= 2:
                lepas_semua.append((0, "[BARIS BUKAN DATA] " + ", ".join(teks_di_angka[:4])))
                continue
            for f in teks_di_angka:
                lepas_semua.append((0, "[TEKS DI KOLOM ANGKA] " + f))
            # baris dianggap terisi kalau ada angka selain nol
            if any(isinstance(rec[f], (int, float)) and rec[f] for f in FIELDS):
                baris.append(rec)
        # blok basi wajib punya SPEND atau BOX. Omset saja tidak cukup:
        # TikTok Sereal Sep 2026 berlabel Juli berisi omset Rp25 jt tanpa
        # spend & tanpa box (rumus template), padahal omset Sereal Sep di
        # laporan monitoring hanya Rp6,6 jt.
        if basi and not any(isinstance(x.get(f), (int, float)) and x.get(f)
                            for x in baris for f in ("total_spend", "box")):
            baris = []
        if baris:
            blok.append({
                "label": label,
                # Agregat DITANDAI, bukan dibuang -- selisihnya dengan
                # jumlah per-toko belum terjelaskan, jadi dua-duanya
                # disimpan dan tidak boleh dijumlahkan bersama.
                # Blok REALISASI juga agregat. Labelnya "ADMIN REALISASI",
                # tanpa kata TOTAL, sehingga dulu terhitung per-toko dan
                # dijumlahkan bersama blok PLATFORM -- padahal isinya rekap
                # toko yang sama (Agu 2026 Gamamilk: platform 58,8 jt vs
                # realisasi 59,7 jt). 2026 sempat kelebihan ~Rp716 jt spend
                # dan ~Rp2,83 M omset karena ini.
                "agregat": bool(re.search(r"\btotal\b", label, re.I))
                           or layout(cmap) == "REALISASI",
                "layout": layout(cmap),
                "baris": baris,
                "label_basi": "%d-%02d" % basi if basi else None,
            })
    return blok, lepas_semua
