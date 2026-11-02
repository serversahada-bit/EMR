# Gabung sheet CS & CRM semua file Progres <tahun> -> 1 Excel, header BAKU.
#   python build_all_crm.py 2026  ->  ALL CRM 2026.xlsx
#
# Empat pola sheet, masing-masing dijadikan SATU tabel dengan kolom tetap:
#   BLAST  "PERFORMA BLAST CRM"   tanggal x produk
#   CRM    "CRM"                  tanggal x produk x CS x segmen (RO 2/RO 1/RESELLER)
#   CS     "CS <nama>", "CSO"     tanggal x produk x CS x blok x sumber
#          Dua layout digabung: CS akuisisi (blok = sumber iklan, mis. META
#          PUTRA; metrik lead/new customer/follow up) dan CS CRM (blok =
#          produk, sumber = New Customer <ADV>/Reseller/RO 2/RO 1).
#          Nama ADV/CS yang dulu jadi JUDUL KOLOM (dan berganti tiap bulan)
#          pindah ke ISI kolom `sumber`, sehingga headernya satu dan tetap.
#
# Yang TIDAK diambil:
#   - kolom turunan: Closing Rate, Up Selling (rasio box/closing), CR, CPA,
#     TOTAL -- bisa dihitung ulang dari kolom dasarnya.
#   - sheet KOSONG (tanpa angka bukan nol).
#   - sheet BEKU: isi angka persis sama dengan sheet bernama sama, produk
#     sama, di bulan LEBIH AWAL -- template yang tidak diperbarui.
#   Semuanya dicatat di sheet LOG.
#
# TANGGAL: label tanggal di sheet sering basi (sheet CRM file Juli-Sept
#   berlabel Maret, seperti kasus COST OF SALES). Bila bulan label = bulan
#   file, tanggal label dipakai; bila tidak, bulan dari NAMA FILE dan hari
#   dari URUTAN baris. Baris melebihi jumlah hari bulan itu dibuang (dicatat).
import calendar
import collections
import datetime
import glob
import hashlib
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
OUT = "ALL CRM %d.xlsx" % TAHUN
BLN_NO = {v: k for k, v in BULAN.items()}

F_BLAST = ["cost_chat", "ongkir", "promo_hadiah", "promo_cb", "free_produk",
           "spend_total", "data", "closing", "box", "omset"]
F_CRM = ["closing", "box"]          # closing = kolom ALAMAT (beberapa bulan berlabel CLOSING)
F_CS = ["lead_form", "lead_wa", "lead_lain", "konsultasi", "data", "closing",
        "box", "closing_fu", "box_fu", "closing_mp", "box_mp", "subsidi_ongkir"]

# Lebar baca sheet CS. Dulu 80 kolom, tapi sheet CS akuisisi berisi blok per
# sumber iklan berjajar sampai ~kolom 290: Okt 2026 "CS Aisyah" mengisi blok
# META GM DHANI di kolom CW-DB (101-106) sehingga seluruh sheetnya terbaca
# kosong, dan blok CTWA INDONESIA "CS Ratna" (CA-CK) terpotong di kolom 80.
LEBAR_CS = 300


def up(v):
    return re.sub(r"\s+", " ", str(v)).strip().upper() if isinstance(v, str) and v.strip() else None


def angka(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def produk_dari(b):
    low = b.lower()
    for k, v in (("premium", "Premium"), ("plus", "Plus"), ("sereal", "Sereal"),
                 ("phenobody", "Phenobody"), ("g_nait", "G'Nait")):
        if k in low:
            return v
    return "Gamamilk"


def ffill(baris, lebar):
    out, cur = [], None
    for j in range(lebar):
        v = up(baris[j]) if j < len(baris) else None
        if v:
            cur = v
        out.append(cur)
    return out


def nama_cs(sheet):
    s = up(sheet)
    if s == "CSO":
        return "CSO"
    s = re.sub(r"^CS\s+", "", s)
    s = re.sub(r"\(CRM\)", "", s)
    return re.sub(r"[.\s]+$", "", s).strip()


def jenis_sheet(sheet, rows):
    u = up(sheet) or ""
    teks = " || ".join(" | ".join(up(v) for v in r if up(v)) for r in rows[:6])
    if u == "PERFORMA BLAST CRM" or ("COST CHAT" in teks and "SPEND MARKETING" in teks):
        return "BLAST"
    if u == "CRM":
        return "CRM"
    if re.match(r"^(CS\b|CSO$)", u) and ("LEAD CS" in teks or "NEW CUS" in teks):
        return "CS"
    return None


# ------------------------------------------------------------ tanggal
def tanggali(rows, tahun, bulan_no):
    """-> [(indeks_baris, tanggal|None, label)] untuk baris berlabel tanggal."""
    idx = [i for i, r in enumerate(rows) if r and isinstance(r[0], datetime.datetime)]
    if not idx:
        return [], False
    label = [rows[i][0].date() for i in idx]
    pas = label[0].year == tahun and label[0].month == bulan_no
    n_hari = calendar.monthrange(tahun, bulan_no)[1]
    hasil, sudah = [], set()
    for k, (i, lab) in enumerate(zip(idx, label)):
        if pas:
            t = lab if (lab.year, lab.month) == (tahun, bulan_no) else None
        else:
            t = datetime.date(tahun, bulan_no, k + 1) if k + 1 <= n_hari else None
        # Tanggal yang muncul LAGI di sheet yang sama bukan data harian: di
        # "CS Indri (CRM)" Maret, baris TOTAL sebulan (380 closing / 1.565
        # box) sel pertamanya berisi tanggal 4 Maret. Tanpa ini ia ikut
        # terjumlah sebagai satu hari.
        if t is not None and t in sudah:
            t = None
        if t is not None:
            sudah.add(t)
        hasil.append((i, t, lab))
    return hasil, not pas


# ------------------------------------------------------------ BLAST
PETA_BLAST = [("COST CHAT", "cost_chat"), ("ONGKIR", "ongkir"), ("PROMO HADIAH", "promo_hadiah"),
              ("PROMO CB", "promo_cb"), ("FREE PRODUK", "free_produk")]


def urai_blast(rows, tahun, bulan_no, tak):
    h = next((i for i, r in enumerate(rows) if r and up(r[0]) == "TANGGAL"), None)
    if h is None:
        return []
    grp, sub = ffill(rows[h], 60), rows[h + 1]
    cmap = {}
    for j in range(1, 60):
        g, s = grp[j], up(sub[j]) if j < len(sub) else None
        if g and g.startswith("RANGKUMAN"):
            break                              # blok ringkasan di kanan
        if g == "SPEND MARKETING":
            k = next((c for lab, c in PETA_BLAST if s and lab in s), None)
            if k is None and s == "TOTAL":
                k = "spend_total"
        else:
            k = {"DATA": "data", "CLOSING": "closing", "BOX": "box", "OMSET": "omset"}.get(g)
            if g in ("CR", "UPSELL", "CPA") or g is None:
                continue
        if k:
            cmap.setdefault(k, j)
        elif g or s:
            tak[("BLAST", g, s)] += 1
    out = []
    tg, _ = tanggali(rows[h + 2:], tahun, bulan_no)
    for i, t, lab in tg:
        r = rows[h + 2 + i]
        rec = {k: angka(r[j]) if j < len(r) else None for k, j in cmap.items()}
        out.append(dict(rec, tanggal=t, label=lab))
    return out


# ------------------------------------------------------------ CRM
def segmen_baku(seg):
    """'RO 1 AKUISISI (60%)' -> 'RO 1', 'RO 2 CRM (40%)' -> 'RO 2'."""
    m = re.match(r"^RO\s*(\d)", seg or "")
    return "RO %s" % m.group(1) if m else (seg or "-")


def urai_crm(rows, tahun, bulan_no, tak):
    d = next((i for i, r in enumerate(rows) if r and isinstance(r[0], datetime.datetime)), None)
    if d is None or d < 3:
        return []
    r1, r2, r3 = ffill(rows[d - 3], 60), rows[d - 2], rows[d - 1]
    kol = []                                   # (cs, segmen, metrik, j)
    seg = None
    for j in range(1, 60):
        cs = r1[j]
        if cs in ("KURANG", "JANUARI", "TARGET") or (cs and re.match(r"^\d", cs)):
            break
        if up(r2[j] if j < len(r2) else None):
            seg = up(r2[j])
        if j > 1 and r1[j] != r1[j - 1]:
            seg = up(r2[j] if j < len(r2) else None)
        m = up(r3[j] if j < len(r3) else None)
        if cs == "RESELLER":
            # blok reseller: ALAMAT/BOX ada di baris 2, bukan baris 3
            m = up(r2[j] if j < len(r2) else None) or m
            seg = "RESELLER"
        if not cs or not m:
            continue
        if cs.startswith("TOTAL") or (seg or "").startswith("TOTAL"):
            continue                           # agregat
        metrik = {"ALAMAT": "closing", "CLOSING": "closing", "BOX": "box"}.get(m)
        if metrik is None:
            if m not in ("UP SELLING",):
                tak[("CRM", cs, m)] += 1
            continue
        kol.append((cs, segmen_baku(seg), metrik, j))
    per = collections.OrderedDict()
    tg, _ = tanggali(rows[d:], tahun, bulan_no)
    for i, t, lab in tg:
        r = rows[d + i]
        for cs, sg, metrik, j in kol:
            rec = per.setdefault((i, cs, sg), dict(tanggal=t, label=lab, cs=cs, segmen=sg))
            rec[metrik] = angka(r[j]) if j < len(r) else None
    return list(per.values())


# ------------------------------------------------------------ CS (akuisisi + CRM)
def metrik_cs(grp, sub):
    """(kategori sumber | None, metrik | None).  kategori != None berarti grup
    ini sendiri adalah SUMBER (pola CS CRM: New Customer X, Reseller, RO ...)."""
    g, s = grp or "", sub or ""
    if g.startswith(("CLOSING RATE", "UP SELLING", "UPSEL", "TOTAL")) or s.startswith(("UP SELL", "UPSEL")):
        return None, None
    if "KONSUL" in s or "KONSUL" in g:
        return None, "konsultasi"
    if s == "CLOSING MP" or g == "CLOSING MP":
        return None, "closing_mp"
    if s == "BOX MP" or g == "BOX MP":
        return None, "box_mp"
    if "SUBSIDI" in s or "SUBSIDI" in g:
        return None, "subsidi_ongkir"
    # --- pola CS akuisisi
    if g.startswith("LEAD CS"):
        return None, {"FORM": "lead_form", "WA": "lead_wa"}.get(s, "lead_lain")
    if g.startswith("NEW CUSTOMER") and s in ("CLOSING", "BOX") and not re.sub(r"NEW CUS(T)?OMER", "", g).strip():
        return None, "closing" if s == "CLOSING" else "box"
    if g.startswith("FOLLOW UP"):
        return None, {"CLOSING": "closing_fu", "BOX": "box_fu"}.get(s)
    if g == "DATA" or s == "DATA":
        return None, "data"
    # --- pola CS CRM: grup = sumber
    if s in ("CLOSING", "BOX"):
        return g, "closing" if s == "CLOSING" else "box"
    return None, None


EJAAN_ADV = {"DANI": "DHANI", "ARRAFI": "ARAFI"}
KATEGORI_TETAP = ("RESELLER", "RO ", "CTWA", "INSTAGRAM", "GOOGLE", "META", "SNACK", "TIKTOK", "LP ")


def sumber_baku(sumber, jenis_cs):
    """Samakan ejaan sumber. Di CS CRM, nama ADV polos ('PUTRA') dan
    'NEW CUSOMER X' (salah ketik) berarti 'NEW CUSTOMER X'."""
    s = re.sub(r"^NEW CUS(T)?OMER\s*", "NEW CUSTOMER ", sumber or "-").strip()
    for a, b in EJAAN_ADV.items():
        s = re.sub(r"\b%s\b" % a, b, s)
    if (jenis_cs == "CRM" and re.fullmatch(r"[A-Z]+", s) and s != "RESELLER"
            and not s.startswith(KATEGORI_TETAP)):
        s = "NEW CUSTOMER " + s
    return s


def urai_cs(rows, tahun, bulan_no, tak):
    d = next((i for i, r in enumerate(rows) if r and isinstance(r[0], datetime.datetime)), None)
    if d is None or d < 2:
        return []
    # Header biasanya 3 baris (banner produk, grup, sublabel). "CS Sherly (CRM)"
    # Okt 2026 tidak punya baris banner -- tanggal mulai di baris 3 -- jadi
    # bloknya "-" dan grup/sublabel tetap dibaca dari dua baris di atas tanggal.
    r1 = ffill(rows[d - 3], LEBAR_CS) if d >= 3 else [None] * LEBAR_CS
    r2, r3 = ffill(rows[d - 2], LEBAR_CS), rows[d - 1]
    r2mentah = rows[d - 2]
    # rentang tiap grup baris 2 + apakah ada sublabel di dalamnya
    awal, ada_sub, mulai = {}, collections.defaultdict(bool), 1
    for j in range(1, LEBAR_CS):
        if up(r2mentah[j] if j < len(r2mentah) else None):
            mulai = j
        awal[j] = mulai
        if up(r3[j] if j < len(r3) else None):
            ada_sub[mulai] = True
    kol = []                                   # (blok, sumber, metrik, j)
    for j in range(1, LEBAR_CS):
        g, s = r2[j], up(r3[j] if j < len(r3) else None)
        if not g and not s:
            continue
        if g == "DATE":
            continue                           # kolom tanggal kedua di tengah sheet
        blok = r1[j] or "-"
        if blok == "TOTAL":
            continue                           # agregat antar-blok
        if s is None and g in ("CLOSING", "BOX"):
            # header dua baris: label metrik langsung di baris grup, sumbernya = blok produk
            kol.append((blok, blok, "closing" if g == "CLOSING" else "box", j))
            continue
        if s is None and g and not ada_sub[awal[j]]:
            # grup tanpa sublabel sama sekali: urutannya tetap Closing, Box
            s = {0: "CLOSING", 1: "BOX"}.get(j - awal[j])
        kat, m = metrik_cs(g, s)
        if m is None:
            if not (g or "").startswith(("CLOSING RATE", "UP SELL", "UPSEL", "TOTAL")) and not (s or "").startswith(("UP SELL", "UPSEL")):
                tak[("CS", g, s)] += 1
            continue
        sumber = kat if kat else blok
        kol.append((blok if kat else "-", sumber, m, j))
    per = collections.OrderedDict()
    tg, _ = tanggali(rows[d:], tahun, bulan_no)
    for i, t, lab in tg:
        r = rows[d + i]
        for blok, sumber, m, j in kol:
            v = angka(r[j]) if j < len(r) else None
            rec = per.setdefault((i, blok, sumber), dict(tanggal=t, label=lab, blok=blok, sumber=sumber))
            if v is not None:
                rec[m] = (rec.get(m) or 0) + v
    return list(per.values())


# ------------------------------------------------------------ kumpulkan
def sidik(rows):
    data = [tuple(round(v, 3) if isinstance(v, float) else v for v in r[1:] if angka(v) is not None)
            for r in rows if r and isinstance(r[0], datetime.datetime)]
    total = sum(abs(x) for t in data for x in t)
    return hashlib.md5(repr(data).encode()).hexdigest(), total


def olah_wb(wb, b, bulan, prod, tahun, sidik_lama, hasil, log, tak):
    """Sheet CS/CRM/BLAST satu workbook -> tambah ke `hasil` & `log`.
    `sidik_lama` mengingat isi sheet bulan sebelumnya (deteksi beku).
    Dipakai kumpulkan() dan importer."""
    bno = BLN_NO[bulan]
    for t in wb.sheetnames:
        u = up(t) or ""
        if not re.match(r"^(CS\b|CSO$|CRM$|PERFORMA BLAST CRM$)", u):
            continue
        ws = wb[t]
        ws.reset_dimensions()
        rows = list(ws.iter_rows(max_row=50, max_col=LEBAR_CS, values_only=True))
        jenis = jenis_sheet(t, rows)
        if not jenis:
            log.append([b, bulan, prod, t, "-", "-", "DILEWATI: pola header tidak dikenali"])
            continue
        hs, total = sidik(rows)
        if total == 0:
            log.append([b, bulan, prod, t, jenis, "-", "DILEWATI: kosong"])
            continue
        lama = sidik_lama.setdefault((prod, u), {})
        if hs in lama:
            log.append([b, bulan, prod, t, jenis, "-", "DILEWATI: BEKU, isi sama persis dengan file %s" % lama[hs]])
            continue
        lama[hs] = bulan
        fn = {"BLAST": urai_blast, "CRM": urai_crm, "CS": urai_cs}[jenis]
        recs = fn(rows, tahun, bno, tak)
        lebih = [r for r in recs if r["tanggal"] is None and any(angka(v) for k, v in r.items() if k not in ("tanggal", "label"))]
        recs = [r for r in recs if r["tanggal"] is not None]
        basi = bool(recs) and (recs[0]["label"].year, recs[0]["label"].month) != (tahun, bno)
        if jenis == "CS" and basi and ws.sheet_state != "visible":
            # Sheet CS yang disembunyikan DAN berlabel bulan lain adalah sisa
            # bulan lama yang terbawa saat file disalin: "CS Eka"/"CS Fitria"
            # di file Plus Apr-Okt 2026 = blok Maret yang sama persis tiap bulan,
            # "CS Indri (CRM)" di file Premium berlabel Agustus 2025. Sheet yang
            # MASIH diisi walau labelnya basi ("CS AYU. (CRM)" Okt = label Feb)
            # selalu terlihat, jadi tetap diambil.
            log.append([b, bulan, prod, t, jenis, "-", "DILEWATI: tersembunyi & label tanggal basi (%s) -> sisa bulan lama"
                        % recs[0]["label"].strftime("%Y-%m")])
            continue
        for r in recs:
            r.update(produk=prod, bulan=bulan, sheet=t, file=b)
            if jenis == "CS":
                r["cs"] = nama_cs(t)
                r["jenis_cs"] = "CRM" if "CRM" in u else "AKUISISI"
                r["sumber"] = sumber_baku(r["sumber"], r["jenis_cs"])
        hasil[jenis].extend(recs)
        # CS: hitung baris yang berisi angka saja -- urai_cs membuat satu baris
        # per tanggal x sumber walau kosong (31 x 8 = 248 untuk sheet berisi
        # 43 baris), dan baris kosong tidak pernah disimpan.
        n = sum(1 for r in recs if any(r.get(f) for f in F_CS)) if jenis == "CS" else len(recs)
        cat = ["%d baris" % n]
        if basi:
            cat.append("label tanggal basi (%s) -> bulan dari nama file" % recs[0]["label"].strftime("%Y-%m"))
        if lebih:
            cat.append("%d baris lebih hari berisi angka DIBUANG" % len(lebih))
        log.append([b, bulan, prod, t, jenis, "DIAMBIL", "; ".join(cat)])


def kumpulkan():
    seen = {}
    for d in ("Arsip Excel Bulanan", "."):
        for p in sorted(glob.glob(os.path.join(d, "Progres *%d*.xlsx" % TAHUN))):
            seen.setdefault(os.path.basename(p), p)
    urut = sorted(seen, key=lambda x: (produk_dari(x), next((BLN_NO[m] for m in BLN_NO if m.lower() in x.lower()), 99)))
    hasil = {"BLAST": [], "CRM": [], "CS": []}
    log, tak = [], collections.Counter()
    sidik_lama = {}                            # (produk, sheet) -> {hash: bulan}
    for b in urut:
        bulan = next((x for x in BLN_NO if x.lower() in b.lower()), None)
        if not bulan:
            continue
        bno, prod = BLN_NO[bulan], produk_dari(b)
        wb = openpyxl.load_workbook(seen[b], read_only=True, data_only=True)
        olah_wb(wb, b, bulan, prod, TAHUN, sidik_lama, hasil, log, tak)
        wb.close()
        print("  dibaca %s" % b, flush=True)
    return hasil, log, tak


# ------------------------------------------------------------ tulis Excel
TEBAL = Font(bold=True, color="FFFFFF")
ISI = PatternFill("solid", fgColor="1F4E78")


def lembar(wb, judul, head, baris, lebar=None):
    ws = wb.create_sheet(judul)
    ws.append(head)
    for c in ws[1]:
        c.font, c.fill = TEBAL, ISI
        c.alignment = Alignment(wrap_text=True, vertical="center")
    for r in baris:
        ws.append(r)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    for i, w in enumerate(lebar or [14] * len(head), 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows(min_row=2, min_col=1, max_col=1):
        for c in row:
            c.number_format = "dd-mm-yyyy"
    return ws


def main():
    hasil, log, tak = kumpulkan()
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    kunci = lambda r: (r["tanggal"], r["produk"])
    lembar(wb, "BLAST", ["tanggal", "produk"] + F_BLAST + ["label_tgl_sheet", "file"],
           [[r["tanggal"], r["produk"]] + [r.get(f) for f in F_BLAST] + [r["label"], r["file"]]
            for r in sorted(hasil["BLAST"], key=kunci)], [12, 11] + [12] * len(F_BLAST) + [12, 44])
    lembar(wb, "CRM PER CS", ["tanggal", "produk", "cs", "segmen", "closing (alamat)", "box"] + ["label_tgl_sheet", "file"],
           [[r["tanggal"], r["produk"], r["cs"], r["segmen"]] + [r.get(f) for f in F_CRM] + [r["label"], r["file"]]
            for r in sorted(hasil["CRM"], key=lambda r: (r["tanggal"], r["produk"], r["cs"], r["segmen"]))],
           [12, 11, 12, 10, 10, 10, 12, 44])
    cs_baris = [r for r in hasil["CS"] if any(r.get(f) for f in F_CS)]
    lembar(wb, "CS", ["tanggal", "produk", "jenis_cs", "cs", "blok", "sumber"] + F_CS + ["label_tgl_sheet", "sheet", "file"],
           [[r["tanggal"], r["produk"], r["jenis_cs"], r["cs"], r["blok"], r["sumber"]] + [r.get(f) for f in F_CS] + [r["label"], r["sheet"], r["file"]]
            for r in sorted(cs_baris, key=lambda r: (r["tanggal"], r["produk"], r["cs"], r["sumber"]))],
           [12, 11, 10, 12, 22, 26] + [9] * len(F_CS) + [12, 18, 44])
    lembar(wb, "LOG", ["file", "bulan", "produk", "sheet", "pola", "status", "catatan"], log, [44, 10, 10, 22, 7, 9, 80])
    lembar(wb, "LABEL TAK TERPETAKAN", ["pola", "grup", "sublabel", "jumlah kolom"],
           [[k[0], k[1], k[2], v] for k, v in tak.most_common()], [8, 40, 30, 12])
    kamus = [
        ("BLAST", "Satu baris per tanggal x produk dari sheet PERFORMA BLAST CRM. cost_chat..free_produk = rincian SPEND MARKETING; spend_total = TOTAL-nya. CR, UPSELL, CPA tidak diambil (turunan)."),
        ("CRM PER CS", "Sheet CRM. Satu baris per tanggal x produk x CS x segmen (RO 2 / RO 1 / RESELLER). closing (alamat) = jumlah order (kolom ALAMAT; beberapa bulan berlabel CLOSING), box. Blok TOTAL dan kolom UP SELLING (rasio) tidak diambil."),
        ("CS", "Sheet 'CS <nama>' dan 'CSO'. jenis_cs AKUISISI: blok = '-' , sumber = sumber iklan (META PUTRA, GOOGLE BAGAS, CTWA ...). jenis_cs CRM: blok = banner produk di sheet, sumber = New Customer <ADV> / Reseller / RO 2 / RO 1 ..."),
        ("CS: metrik", "lead_form/lead_wa/lead_lain = LEAD CS; closing/box = New Customer (akuisisi) atau closing/box sumber itu (CRM); closing_fu/box_fu = Follow Up; closing_mp/box_mp; konsultasi; subsidi_ongkir; data."),
        ("tanggal", "Bulan dari nama file bila label tanggal di sheet basi (lihat LOG). label_tgl_sheet = tanggal apa adanya di sheet."),
        ("LOG", "Setiap sheet: DIAMBIL atau DILEWATI (kosong / BEKU / pola tak dikenal) beserta alasannya."),
    ]
    lembar(wb, "KAMUS KOLOM", ["bagian", "keterangan"], kamus, [16, 150])
    wb.save(OUT)
    n = {k: len(v) for k, v in hasil.items()}
    print("\n== hasil ==", n, "| CS baris berisi:", len(cs_baris))
    st = collections.Counter(x[5] + " " + x[6].split(",")[0][:22] if x[5] == "-" else x[5] for x in log)
    for k, v in st.most_common():
        print("  %-40s %d" % (k, v))
    print("\n== label tak terpetakan (teratas) ==")
    for k, v in tak.most_common(25):
        print("  %-5s %-40s %-25s %d" % (k[0], k[1], k[2], v))
    print("\n==> %s (%.0f KB)" % (OUT, os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
