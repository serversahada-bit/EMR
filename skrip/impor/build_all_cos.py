# Gabung sheet "COST OF SALES" (COS) semua file Progres <tahun> -> 1 Excel.
#   python build_all_cos.py 2026  ->  ALL COS GAMAMILK 2026.xlsx
#   Hanya keluarga Gamamilk (utama, Plus, Premium, Sereal).
#
# KOLOM TANGGAL DI SHEET INI SERING BASI. Template disalin dari bulan lalu
#   dan angkanya diisi ulang, tapi kolom A tidak diganti: file September
#   Gamamilk berlabel 1-31 Agustus padahal angkanya beda dari file Agustus,
#   file Oktober juga berlabel Agustus dan baru 2 hari terisi. Jadi bulan
#   diambil dari NAMA FILE, dan hari dari URUTAN baris (baris ke-n = tanggal
#   n). Baris melebihi jumlah hari bulan itu ditandai LEBIH HARI dan tidak
#   ikut ringkasan. Kebalikan dari aturan MP/Meta (tanggal sheet harus =
#   bulan file) -- aturan itu akan membuang data yang benar di sini.
#
# SUB-KOLOM CLOSING BEDA ANTAR FILE (CSO/SHOPEE/TIKTOK vs AKUISISI/CRM/MP/
#   TIKTOK, Februari Gamamilk: Lead WA/Klik Shopee/Klik Tiktok). Masing-masing
#   disimpan di kolomnya sendiri, tidak disamakan -- artinya belum tentu sama.
#
# COS DIHITUNG ULANG = spend total / omset total. Sel COS di sheet rusak di
#   banyak file (nilai ratusan juta persen); nilainya tetap disalin apa
#   adanya di kolom "COS sheet" untuk pembanding.
import calendar
import datetime
import glob
import os
import re
import sys
import warnings

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_progres import BULAN

TAHUN = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
OUT = "ALL COS GAMAMILK %d.xlsx" % TAHUN
SHEET = "COST OF SALES"
BLN_NO = {v: k for k, v in BULAN.items()}

# Kolom baku. Urutan = urutan di sheet; closing = gabungan semua varian.
SPEND = ["konversi", "mbc", "sales_promotion", "lain_lain", "total"]
CLOSING = ["cso", "akuisisi", "crm", "mp", "shopee", "tiktok",
           "lead_wa", "klik_shopee", "klik_tiktok", "total"]
BOX = ["akuisisi", "crm", "mp", "tiktok", "total"]
OMSET = ["akuisisi", "crm", "mp", "tiktok", "total"]
FIELDS = (["spend_" + x for x in SPEND] + ["closing_" + x for x in CLOSING]
          + ["box_" + x for x in BOX] + ["omset_" + x for x in OMSET]
          + ["cos_sheet", "romi_sheet"])
GRUP = {"SPEND BUDGET": "spend", "CLOSING": "closing", "BOX": "box",
        "OMSET": "omset"}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "_", str(s).strip().lower()).strip("_")


def produk_dari(b):
    low = b.lower()
    for k, v in (("premium", "Premium"), ("plus", "Plus"), ("sereal", "Sereal"),
                 ("phenobody", "Phenobody"), ("g_nait", "G'Nait")):
        if k in low:
            return v
    return "Gamamilk"


def angka(v):
    if isinstance(v, bool):
        return None, False
    if isinstance(v, (int, float)):
        return v, False
    if v is None or (isinstance(v, str) and not v.strip()):
        return None, False
    return None, True          # teks / #VALUE! / #DIV/0! di kolom angka


def baca(path, bulan_no, tahun=None):
    """-> (peta kolom, baris data, baris TOTAL sheet, catatan)"""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    if SHEET not in wb.sheetnames:
        wb.close()
        return None
    ws = wb[SHEET]
    ws.reset_dimensions()
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    h = next(i for i, r in enumerate(rows)
             if r and isinstance(r[0], str) and r[0].strip().upper() == "TANGGAL")
    top, sub = rows[h], rows[h + 1]
    cmap, grp, catatan = {}, None, []
    for j in range(1, max(len(top), len(sub))):
        t = top[j] if j < len(top) else None
        s = sub[j] if j < len(sub) else None
        if isinstance(t, str) and t.strip():
            grp = t.strip().upper()
        if grp is None:
            continue
        if grp.startswith("COS"):
            cmap["cos_sheet"] = j
        elif grp.startswith("ROMI"):
            cmap["romi_sheet"] = j
        elif grp.startswith("KETERANGAN"):
            cmap["keterangan"] = j
        elif grp in GRUP and s is not None:
            k = "%s_%s" % (GRUP[grp], slug(s))
            if k not in FIELDS:
                catatan.append("kolom tak dikenal: %s/%s" % (grp, s))
                continue
            cmap.setdefault(k, j)
    tahun = tahun or TAHUN
    n_hari = calendar.monthrange(tahun, bulan_no)[1]
    data, total, label, i_total = [], None, [], None
    for i, r in enumerate(rows[h + 2:], h + 3):
        if not r:
            continue
        v0 = r[0]
        if isinstance(v0, str) and v0.strip().upper() == "TOTAL":
            total, i_total = r, i
            break
        if not isinstance(v0, datetime.datetime):
            continue
        ke = len(data) + 1
        rec = {"hari_ke": ke, "label": v0.date(), "teks_err": 0}
        for k, j in cmap.items():
            v = r[j] if j < len(r) else None
            if k == "keterangan":
                rec[k] = str(v).strip() if v not in (None, "") else None
                continue
            x, err = angka(v)
            rec[k] = x
            if err and k not in ("cos_sheet", "romi_sheet"):
                rec["teks_err"] += 1
        rec["tanggal"] = datetime.date(tahun, bulan_no, ke) if ke <= n_hari else None
        rec["isi"] = any(rec.get(f) for f in FIELDS
                         if f not in ("cos_sheet", "romi_sheet"))
        data.append(rec)
        label.append(v0.date())
    rumus = {}
    if i_total:
        wbf = openpyxl.load_workbook(path, read_only=True, data_only=False)
        wsf = wbf[SHEET]
        wsf.reset_dimensions()
        rf = next(wsf.iter_rows(min_row=i_total, max_row=i_total, values_only=True))
        wbf.close()
        for k, j in cmap.items():
            if k.startswith("spend_") and j < len(rf):
                rumus[k] = rf[j]
    return cmap, data, total, catatan, label, rumus


JUDUL = {"spend": "Spend", "closing": "Closing", "box": "Box", "omset": "Omset"}


def nama(f):
    if f == "cos_sheet":
        return "COS sheet (asli)"
    if f == "romi_sheet":
        return "ROMI/ROAS sheet"
    g, s = f.split("_", 1)
    return "%s %s" % (JUDUL[g], s.replace("_", " ").title())



def olah_file(path, b, bulan, prod, tahun, sidik, semua, ringkas, log):
    """Satu file Progres -> tambah ke `semua` (baris harian), `ringkas`
    (1 baris bulanan) dan `log`. `sidik` mengingat isi file yang sudah
    dibaca (deteksi sheet beku antar bulan). Dipakai kumpulkan() dan
    importer (satu file dari link Google Sheet)."""
    hasil = baca(path, BLN_NO[bulan], tahun)
    if hasil is None:
        log.append([b, bulan, prod, "-", 0, "TIDAK ADA sheet COST OF SALES"])
        return
    cmap, data, total, catatan, label, rumus = hasil
    print("  dibaca %-45s %d baris" % (b[:45], len(data)), flush=True)
    n_hari = calendar.monthrange(tahun, BLN_NO[bulan])[1]

    lab_bln = sorted({"%d-%02d" % (x.year, x.month) for x in label})
    basi = lab_bln[0] != "%d-%02d" % (tahun, BLN_NO[bulan])
    urut = all((label[i + 1] - label[i]).days == 1 for i in range(len(label) - 1))
    if not urut:
        catatan.append("label tanggal TIDAK berurutan")
    lebih = [r for r in data if r["tanggal"] is None and r["isi"]]
    if lebih:
        catatan.append("%d baris LEBIH HARI berisi angka (spend %s) -- tidak "
                       "ikut ringkasan" % (len(lebih), format(
                           sum(r.get("spend_total") or 0 for r in lebih), ",.0f")))
    err = sum(r["teks_err"] for r in data)
    if err:
        catatan.append("%d sel teks/error di kolom angka (dikosongkan)" % err)

    key = (prod, tuple(tuple(round(r.get(f) or 0) for f in FIELDS[:-2])
                       for r in data))
    kembar = sidik.get(key)
    if kembar:
        catatan.append("ISI SAMA PERSIS dengan %s -- kemungkinan sheet beku" % kembar)
    else:
        sidik[key] = b

    for r in data:
        jenis = ("LEBIH HARI" if r["tanggal"] is None
                 else "SALINAN?" if kembar else "DATA")
        semua.append((prod, BLN_NO[bulan], bulan, jenis, r, b))

    ok = [r for r in data if r["tanggal"] is not None]
    sp = sum(r.get("spend_total") or 0 for r in ok)
    om = sum(r.get("omset_total") or 0 for r in ok)
    sp_all = sum(r.get("spend_total") or 0 for r in data)
    om_all = sum(r.get("omset_total") or 0 for r in data)

    def tot(k):
        if total is None or k not in cmap or cmap[k] >= len(total):
            return None
        return angka(total[cmap[k]])[0]
    t_sp, t_om, t_cos = tot("spend_total"), tot("omset_total"), tot("cos_sheet")
    # Pemilik sheet mengoreksi spend LEWAT RUMUS TOTAL, bukan di baris
    # harian: "-'META x GADS x SNACK'!CE40" (Kompensasi Snack + Pajak) dan
    # angka ketik langsung (Premium Feb: "-24307000"). Koreksi per kolom =
    # TOTAL sheet - jumlah semua baris harian; rumusnya disalin apa adanya.
    KOMPONEN = ("spend_konversi", "spend_mbc", "spend_sales_promotion",
                "spend_lain_lain")
    koreksi, teks_rumus = 0.0, []
    for k in KOMPONEN:
        tv = tot(k)
        if tv is None:
            continue
        d = tv - sum(r.get(k) or 0 for r in data)
        if abs(d) >= 1:
            koreksi += d
            teks_rumus.append("%s: %s" % (nama(k), rumus.get(k)))
    if t_sp is not None:
        # rumus spend total sendiri bisa melewatkan komponen (Plus Juli:
        # =B35+D35+E35, MBC tidak ikut)
        d = t_sp - sum(tot(k) or 0 for k in KOMPONEN)
        if abs(d) >= 1:
            koreksi += d
            teks_rumus.append("%s: %s" % (nama("spend_total"), rumus.get("spend_total")))
    beda_sp = None if t_sp is None else round(sp_all - t_sp)
    beda_om = None if t_om is None else round(om_all - t_om)
    if total is None:
        catatan.append("baris TOTAL sheet tidak ditemukan")
    elif round(koreksi):
        catatan.append("koreksi manual di rumus TOTAL sheet: %s (%s)"
                       % (format(koreksi, ",.0f"), "; ".join(teks_rumus)))
    sisa_sp = None if beda_sp is None else round(beda_sp + koreksi)
    if (sisa_sp or 0) != 0 or (beda_om or 0) != 0:
        catatan.append("SISA SELISIH tak terjelaskan (spend %s, omset %s)"
                       % (sisa_sp, beda_om))
    ringkas.append([prod, bulan, BLN_NO[bulan], len(ok), sp, om,
                    (sp / om) if om else None, round(koreksi), t_sp, t_om,
                    (t_sp / t_om) if t_sp is not None and t_om else None,
                    sisa_sp, beda_om, "; ".join(teks_rumus),
                    "BASI" if basi else "", "SALINAN?" if kembar else ""])
    log.append([b, bulan, prod, " s/d ".join(lab_bln) if len(lab_bln) > 1 else lab_bln[0],
                len(data), "; ".join(
                    (["label tanggal basi (%s) -> dipakai bulan file" % lab_bln[0]]
                     if basi else []) + catatan) or "OK"])


def kumpulkan():
    """-> (semua baris harian, ringkasan per bulan, log per file).
    Dipakai juga oleh gen_sql_cos.py supaya DB = Excel persis."""
    seen = {}
    for d in ("Arsip Excel Bulanan", "."):
        for p in sorted(glob.glob(os.path.join(d, "Progres *%d*.xlsx" % TAHUN))):
            seen.setdefault(os.path.basename(p), p)

    semua, log, ringkas = [], [], []
    sidik = {}                       # (produk, isi baris) -> file pertama
    for b in sorted(seen, key=lambda x: (produk_dari(x),
                                         next((BLN_NO[m] for m in BLN_NO
                                               if m.lower() in x.lower()), 99))):
        bulan = next((x for x in BLN_NO if x.lower() in b.lower()), None)
        if not bulan or "gamamilk" not in b.lower():
            continue        # hanya keluarga Gamamilk (Phenobody, G'Nait dikeluarkan)
        olah_file(seen[b], b, bulan, produk_dari(b), TAHUN, sidik, semua, ringkas, log)
    return semua, ringkas, log


# ---------------------------------------------------------------- tulis
TEBAL = Font(bold=True, color="FFFFFF")
ISI = PatternFill("solid", fgColor="1F4E78")
KUNING = PatternFill("solid", fgColor="FFF2CC")
MERAH = PatternFill("solid", fgColor="F8CBAD")


def kepala(ws, head):
    ws.append(head)
    for c in ws[1]:
        c.font, c.fill = TEBAL, ISI
        c.alignment = Alignment(wrap_text=True, vertical="center")
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions


def lebar(ws, w):
    for i, x in enumerate(w, 1):
        ws.column_dimensions[get_column_letter(i)].width = x


def main():
    semua, ringkas, log = kumpulkan()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "ALL COS GAMAMILK %d" % TAHUN
    head = (["Produk", "Bulan", "Tanggal", "Hari ke", "Label tgl di sheet", "Jenis"]
            + [nama(f) for f in FIELDS] + ["COS hitung", "Keterangan", "File sumber"])
    kepala(ws, head)
    semua.sort(key=lambda x: (x[0], x[1], x[4]["hari_ke"]))
    i_cos = head.index("COS hitung") + 1
    for prod, _, bulan, jenis, r, b in semua:
        sp, om = r.get("spend_total"), r.get("omset_total")
        ws.append([prod, bulan, r["tanggal"], r["hari_ke"], r["label"], jenis]
                  + [r.get(f) for f in FIELDS]
                  + [(sp / om) if sp and om else None, r.get("keterangan"), b])
        row = ws.max_row
        ws.cell(row, 3).number_format = ws.cell(row, 5).number_format = "dd-mm-yyyy"
        for j in range(7, 7 + len(FIELDS)):
            ws.cell(row, j).number_format = "#,##0"
        ws.cell(row, i_cos - 2).number_format = "0.00%"     # COS sheet
        ws.cell(row, i_cos - 1).number_format = "0.00"      # ROMI
        ws.cell(row, i_cos).number_format = "0.00%"
        if jenis != "DATA":
            for c in ws[row]:
                c.fill = KUNING if jenis == "LEBIH HARI" else MERAH
    lebar(ws, [11, 11, 12, 7, 14, 12] + [13] * len(FIELDS) + [10, 30, 44])

    ws = wb.create_sheet("RINGKAS PER BULAN")
    kepala(ws, ["Produk", "Bulan", "No", "Hari", "Spend harian", "Omset harian",
                "COS harian", "Koreksi di rumus TOTAL sheet", "Spend versi sheet",
                "Omset versi sheet", "COS versi sheet", "Sisa selisih spend*",
                "Sisa selisih omset*", "Rumus koreksi (disalin dari sheet)",
                "Label tgl", "Status"])
    for x in sorted(ringkas, key=lambda x: (x[0], x[2])):
        ws.append(x)
        row = ws.max_row
        for j in (5, 6, 8, 9, 10, 12, 13):
            ws.cell(row, j).number_format = "#,##0"
        ws.cell(row, 7).number_format = ws.cell(row, 11).number_format = "0.00%"
        if x[15]:
            for c in ws[row]:
                c.fill = MERAH
    ws.append([])
    ws.append(["Spend/Omset/COS harian = jumlah baris harian, hanya hari yang sah di bulan itu."])
    ws.append(["Koreksi = angka yang DIKURANGKAN pemilik sheet di rumus baris TOTAL (mis. Kompensasi "
               "Snack + Pajak dari sheet META x GADS x SNACK). Versi sheet = baris TOTAL apa adanya."])
    ws.append(["* Sisa selisih = semua baris harian (termasuk LEBIH HARI) + koreksi - TOTAL sheet. "
               "0 = seluruh selisih sudah terjelaskan."])
    lebar(ws, [11, 11, 5, 6, 16, 16, 10, 16, 16, 16, 10, 12, 12, 60, 10, 10])

    ws = wb.create_sheet("LOG SUMBER")
    kepala(ws, ["File", "Bulan", "Produk", "Bulan label tgl di sheet", "Baris", "Catatan"])
    for x in log:
        ws.append(x)
    lebar(ws, [46, 11, 11, 22, 7, 110])

    ws = wb.create_sheet("KAMUS KOLOM")
    kepala(ws, ["Kolom", "Keterangan"])
    for k, v in [
        ("Tanggal", "Bulan dari NAMA FILE + hari dari urutan baris. Label tanggal di sheet sering basi."),
        ("Label tgl di sheet", "Tanggal yang tertulis di kolom A sheet, apa adanya."),
        ("Jenis", "DATA = dipakai. LEBIH HARI (kuning) = baris ke-31 di bulan 30 hari dsb., tidak dipakai. "
                  "SALINAN? (merah) = isinya sama persis dengan file bulan lain produk yang sama."),
        ("Closing *", "Sub-kolom CLOSING beda antar file (CSO/Shopee vs Akuisisi/CRM/MP, Lead WA/Klik). "
                      "Disimpan terpisah sesuai nama aslinya; kosong = file itu tidak punya kolomnya."),
        ("Omset *", "Omset di sheet COS = box x harga tetap per kanal, BUKAN omset riil."),
        ("COS sheet (asli)", "Disalin dari sheet. Rusak di banyak file (ratusan juta persen)."),
        ("COS hitung", "Spend total / omset total. Target sheet: COS < 38%."),
    ]:
        ws.append([k, v])
    lebar(ws, [20, 120])

    wb.save(OUT)
    print("\n== ringkas ==")
    for x in sorted(ringkas, key=lambda x: (x[0], x[2])):
        print("  %-9s %-9s spend %13s omset %15s COS %6s | koreksi %12s COS sheet %6s | sisa %s/%s %s" % (
            x[0], x[1], format(x[4], ",.0f"), format(x[5], ",.0f"),
            "%.1f%%" % (x[6] * 100) if x[6] else "-", format(x[7], ",.0f"),
            "%.1f%%" % (x[10] * 100) if x[10] else "-", x[11], x[12], x[14]))
    print("\n== log ==")
    for x in log:
        if x[5] != "OK":
            print("  %-45s %s" % (x[0][:45], x[5]))
    print("\n==> %s (%d baris, %.0f KB)" % (OUT, len(semua), os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
