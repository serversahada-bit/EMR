# Extractor sheet "ADV <PIC>" dari file Progres -> baris harian bergaya konsolidasi.
# Pemetaan kolom berbasis LABEL header (baris 3 = grup, baris 4 = sublabel),
# bukan posisi -- karena layout tiap sheet/bulan bisa bergeser.
import re
import datetime
import openpyxl

ERRS = ("#DIV/0!", "#REF!", "#VALUE!", "#N/A", "#NAME?", "#NULL!", "#NUM!")


def norm(s):
    if s is None:
        return ""
    return re.sub(r"\s+", " ", str(s).replace("\n", " ")).strip().lower()


# (section, pola sublabel) -> nama kanonik
RULES = {
    "BASE": [("date", "Date"), ("perencanaan target", "target_spend_rencana"),
             ("spend iklan + ppn", "spend_iklan_ppn"), ("spend iklan", "spend_iklan")],
    "IKLAN": [("jang kauan", "jangkauan"), ("jangkauan", "jangkauan"), ("impresi", "impresi"),
              ("frekuensi", "frekuensi"), ("harga per jangkauan", "harga_per_jangkauan"), ("harga per", "harga_per_jangkauan"),
              ("cpm", "cpm"), ("ctr", "ctr"), ("klik tautan", "klik_tautan"),
              ("tayangan konten", "tayangan_konten"), ("rasio vc", "rasio_vc_70"),
              ("rasio atc", "rasio_atc_15"), ("rasio ic", "rasio_ic_30"),
              ("rasio konversi", "rasio_konversi"), ("cpc", "cpc_total"),
              ("add to card", "add_to_cart"), ("add to cart", "add_to_cart"),
              ("initial checkout", "initial_checkout"), ("lr ic scalev", "lr_ic_scalev")],
    "DASBOARD": [("form scalev", "lead_form_scalev"), ("lead scalev", "lead_scalev_fu"),
                 ("wa iklan", "lead_wa_iklan"), ("total lead dasboard", "total_lead_dashboard"),
                 ("total lead dashboard", "total_lead_dashboard"), ("cost per result", "cpr")],
    "REAL": [("form", "lead_real_form"), ("wa", "lead_real_wa"),
             ("total lead real", "total_lead_real"), ("target lead", "target_lead"),
             ("cost per lead", "cpl"), ("lead hilang", "lead_hilang")],
    "RATE": [("form", "lead_rate_form"), ("wa", "lead_rate_wa")],
    "NEW": [("closing customer", "closing_customer_baru"), ("box", "box_baru"),
            ("closing rate", "closing_rate_baru"), ("up selling", "up_selling_baru")],
    "FU": [("closing customer", "closing_customer_fu"), ("box", "box_fu")],
    "TOTAL": [("closing total", "closing_total"), ("box total", "box_total"),
              ("target box", "target_box"), ("closing rate", "closing_rate_total"),
              ("up selling", "up_selling_total"),
              ("biaya akuisisi customer", "biaya_akuisisi_customer"),
              ("biaya akuisisi box", "biaya_akuisisi_box")],
    "TAIL": [("batas akuisisi box", "batas_akuisisi_box_nilai"),
             ("batas", "batas_akuisisi_box_nilai"),
             ("% akusisi box", "persen_akuisisi_box"), ("% akuisisi box", "persen_akuisisi_box"),
             ("akusisi box", "persen_akuisisi_box"), ("akuisisi box", "persen_akuisisi_box"),
             ("grade", "grade"), ("arus", "arus")],
}

GRP2SEC = {
    "data iklan meta": "IKLAN", "lead dasboard": "DASBOARD", "lead dashboard": "DASBOARD",
    "lead real cs": "REAL", "% lead rate cs": "RATE",
    "new customer real hari ini": "NEW", "follow up": "FU", "total performa cs": "TOTAL",
}


def pick(section, sub):
    """cocokkan bertingkat: exact -> startswith -> substring, yang terpanjang menang.
    perlu bertingkat karena label umum bisa menelan label spesifik
    (mis. 'jangkauan' vs 'harga per jangkauan')."""
    rules = RULES.get(section, [])
    for tier in (0, 1, 2):
        best = None
        for pat, canon in rules:
            ok = (sub == pat) if tier == 0 else (
                sub.startswith(pat) if tier == 1 else (pat in sub))
            if ok and (best is None or len(pat) > best[0]):
                best = (len(pat), canon)
        if best:
            return best[1]
    return None


def grp_section(g):
    """kenali label grup (baris 3) -> nama section, atau None kalau bukan grup."""
    g = g.rstrip(" %").strip()
    for k, sec in GRP2SEC.items():
        if g.startswith(k.rstrip(" %")):
            return sec
    # header ekor berdiri sendiri (tanpa sublabel)
    if "biaya" not in g and ("akusisi box" in g or "akuisisi box" in g):
        return "TAIL"
    if g.startswith("batas") or g in ("grade", "arus"):
        return "TAIL"
    return None


def build_map(r3, r4):
    """-> {nama_kanonik: index kolom 0-based}"""
    out, section, seen = {}, "BASE", set()
    for j in range(max(len(r3), len(r4))):
        g = norm(r3[j]) if j < len(r3) else ""
        s = norm(r4[j]) if j < len(r4) else ""
        if g:
            sec = grp_section(g)
            if sec:
                section = sec
        label = s or g
        if not label:
            continue
        # anchor: "closing total" menandai mulainya blok TOTAL PERFORMA CS
        # (di beberapa sheet label grupnya memang tidak ditulis)
        if "closing total" in label or "biaya akuisisi" in label:
            section = "TOTAL"
        canon = pick(section, label)
        # sebagian sheet tidak menulis label grup "TOTAL PERFORMA CS" sama sekali,
        # jadi kalau section sekarang tidak mengenali labelnya, coba sebagai TOTAL
        if canon is None and section in ("NEW", "FU"):
            canon = pick("TOTAL", label)
        if canon and canon not in seen:
            out[canon] = j
            seen.add(canon)
    return out


# "15.896" dalam format Indonesia berarti 15896, bukan 15,896. Pemisah
# ribuan berupa titik dikenali dari pola kelompok 3 digit; tanpa ini nilai
# tsb terbaca 1000x lebih kecil (ketangkap saat validasi: 3 sel `jangkauan`).
RIBUAN_TITIK = re.compile(r"^-?\d{1,3}(\.\d{3})+$")
RIBUAN_KOMA = re.compile(r"^-?\d{1,3}(,\d{3})+(\.\d+)?$")
# format Indonesia penuh: titik ribuan + koma desimal
DESIMAL_KOMA = re.compile(r"^-?\d{1,3}(\.\d{3})*,\d+$")


def cell(v):
    if v is None:
        return None
    if isinstance(v, str):
        t = v.strip()
        if t == "" or t in ERRS or t.startswith("#"):
            return None
        # buang penanda mata uang: sebagian sel ditulis "Rp3.102,58"
        t = re.sub(r"^rp\.?\s*", "", t, flags=re.I).replace(" ", " ").strip()
        if DESIMAL_KOMA.match(t):          # 3.102,58 -> 3102.58
            t = t.replace(".", "").replace(",", ".")
        elif RIBUAN_TITIK.match(t):        # 15.896 -> 15896
            t = t.replace(".", "")
        elif RIBUAN_KOMA.match(t):         # 15,896 -> 15896
            t = t.replace(",", "")
        try:
            return float(t.replace(",", ""))
        except ValueError:
            return v.strip()
    return v


FIELDS = ["target_spend_rencana", "spend_iklan", "spend_iklan_ppn", "jangkauan", "impresi",
          "frekuensi", "harga_per_jangkauan", "cpm", "ctr", "klik_tautan", "tayangan_konten",
          "rasio_vc_70", "rasio_atc_15", "rasio_ic_30", "rasio_konversi", "cpc_total",
          "add_to_cart", "initial_checkout", "lr_ic_scalev", "lead_form_scalev",
          "lead_scalev_fu", "lead_wa_iklan", "total_lead_dashboard", "cpr", "lead_real_form",
          "lead_real_wa", "total_lead_real", "target_lead", "cpl", "lead_hilang",
          "lead_rate_form", "lead_rate_wa", "closing_customer_baru", "box_baru",
          "closing_rate_baru", "up_selling_baru", "closing_customer_fu", "box_fu",
          "closing_total", "box_total", "target_box", "closing_rate_total", "up_selling_total",
          "biaya_akuisisi_customer", "biaya_akuisisi_box", "persen_akuisisi_box",
          "batas_akuisisi_box_nilai", "grade", "arus"]

BULAN = {1: "Januari", 2: "Februari", 3: "Maret", 4: "April", 5: "Mei", 6: "Juni", 7: "Juli",
         8: "Agustus", 9: "September", 10: "Oktober", 11: "November", 12: "Desember"}


def extract(path, sheet, tahun, bulan_no, max_scan=400):
    """kembalikan (rows, colmap, info). rows = list dict."""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        return extract_ws(wb[sheet], tahun, bulan_no, max_scan)
    finally:
        wb.close()


def extract_ws(ws, tahun, bulan_no, max_scan=400):
    """versi untuk worksheet yang sudah terbuka -- hemat waktu kalau 1 workbook
    dipakai utk banyak sheet (file progres ukurannya 4-5 MB, 128 sheet)."""
    ws.reset_dimensions()
    raw = list(ws.iter_rows(min_row=1, max_row=max_scan, max_col=60, values_only=True))
    r3 = list(raw[2]) if len(raw) > 2 else []
    r4 = list(raw[3]) if len(raw) > 3 else []
    cmap = build_map(r3, r4)
    i_date = cmap.get("Date", 0)
    rows = []
    # PENTING: sheet-nya punya tabel kedua lebih ke bawah yang memakai tanggal
    # bulan yang sama (isinya lain). Ambil HANYA blok pertama -- berhenti kalau
    # tanggal mundur atau ada jeda baris yang lebar.
    last_i = last_d = None
    for off, r in enumerate(raw[4:]):
        i = off + 5
        d = r[i_date] if i_date < len(r) else None
        if not isinstance(d, datetime.datetime):
            continue
        if last_d is not None and (d.date() <= last_d or i - last_i > 3):
            break
        if d.year != tahun or d.month != bulan_no:
            if last_d is None:
                continue
            break
        last_i, last_d = i, d.date()
        rec = {"tanggal": d.date()}
        for f in FIELDS:
            j = cmap.get(f)
            rec[f] = cell(r[j]) if (j is not None and j < len(r)) else None
        # aturan baris terisi = spend_iklan ada & bukan nol.
        # diuji ke 8 bulan yg sudah ada di konsolidasi: set tanggalnya sama persis 8/8.
        sp = rec["spend_iklan"]
        if not (isinstance(sp, (int, float)) and not isinstance(sp, bool) and sp != 0):
            continue
        rows.append(rec)
    return rows, cmap, {"bulan": BULAN[bulan_no]}
