# Import file Progres dari LINK Google Sheet -> tabel gabungan di database.
#   python impor_progres.py <link> [<link> ...]            -> PRATINJAU saja
#   python impor_progres.py <link> [<link> ...] --simpan   -> tulis ke DB
#   tambahan: --env .env.coolify   (koneksi server; default XAMPP lokal)
#             --env-proses         (koneksi dari variabel lingkungan DB_* -- dipakai EMR)
#             --json               (keluaran satu objek JSON di stdout -- dipakai halaman Import EMR)
#
# Alur per link:
#   1. judul via Google Sheets API (key dari EMR/.env.local) -> produk, bulan, tahun
#   2. unduh sebagai .xlsx (sheet harus "Anyone with the link")
#   3. urai_progres.urai()  -- pengurai yang SAMA dengan yang mengisi DB
#   4. sheet BEKU dibuang: CS/CRM/COS yang isinya sama persis dengan bulan
#      sebelumnya di DB (saat dimuat per tahun, ini dideteksi antar file)
#   5. id_adv diisi dari pemetaan PIC yang sudah ada di tabel tujuan
#   6. --simpan: SATU transaksi per link -- hapus (produk, tahun, bulan)
#      di tiap tabel lalu isi ulang. Gagal di tengah = tidak ada yang berubah.
import argparse
import datetime
import json
import os
import re
import sys
import urllib.request

import pymysql

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
_argv = sys.argv
sys.argv = sys.argv[:1]
import urai_progres as U      # noqa: E402  (modul ini mengutak-atik argv saat import)
sys.argv = _argv

HERE = os.path.dirname(os.path.abspath(__file__))
FOLDER = os.path.join(HERE, "impor_unduhan")
EMR_ENV = r"D:\Coding\Oktober\EMR\.env.local"

TABEL = {  # kunci urai -> (tabel, kolom ukuran untuk pratinjau, filter bulan)
    "meta": ("data_spend_meta", "spend_iklan", "tanggal"),
    "google": ("data_spend_google", "spend_iklan", "tanggal"),
    "snack": ("data_spend_snack", "spend_iklan", "tanggal"),
    "mp": ("data_spend_mp", "omset_total", "tanggal"),
    "cos_harian": ("data_cos_harian", "spend_total", "bulan_no"),
    "cos_bulanan": ("data_cos_bulanan", "spend_sheet", "bulan_no"),
    "crm_blast": ("data_crm_blast", "spend_total", "tanggal"),
    "crm_ro": ("data_crm_ro", "box", "tanggal"),
    "crm_cs": ("data_crm_cs", "box", "tanggal"),
}
# sheet yang dicek beku (isi sama persis dengan bulan lalu, per sheet)
CEK_BEKU = {"crm_cs": ["lead_form", "lead_wa", "lead_lain", "konsultasi", "data", "closing", "box",
                       "closing_fu", "box_fu", "closing_mp", "box_mp", "subsidi_ongkir"],
            "crm_ro": ["closing", "box"]}


def baca_env(path):
    env = {}
    for line in open(path, encoding="utf-8"):
        m = re.match(r"\s*([A-Z_]+)\s*=\s*(.*)\s*$", line)
        if m:
            env[m.group(1)] = m.group(2).strip().strip('"')
    return env


def koneksi(env_path, env_proses=False):
    if env_path or env_proses:
        e = os.environ if env_proses else baca_env(env_path)
        g = lambda k: e.get("COOLIFY_" + k) or e.get(k)    # noqa: E731
        return pymysql.connect(host=g("DB_HOST"), port=int(g("DB_PORT") or 3306), user=g("DB_USER"),
                               password=g("DB_PASSWORD"), database=g("DB_NAME"), charset="utf8mb4", autocommit=False)
    return pymysql.connect(host="127.0.0.1", user="root", password="", database="dataslu",
                           charset="utf8mb4", autocommit=False)


def id_sheet(link):
    # docs.google.com/spreadsheets/d/<id>/... atau drive.google.com/open?id=<id>
    m = re.search(r"/d/([a-zA-Z0-9_-]+)", link) or re.search(r"[?&]id=([a-zA-Z0-9_-]+)", link)
    if not m:
        raise SystemExit("Bukan link Google Sheet: %s" % link)
    return m.group(1)


def judul_sheet(sid):
    key = os.environ.get("GOOGLE_SHEETS_API_KEY") or baca_env(EMR_ENV).get("GOOGLE_SHEETS_API_KEY")
    url = "https://sheets.googleapis.com/v4/spreadsheets/%s?fields=properties.title&key=%s" % (sid, key)
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)["properties"]["title"].strip()


def unduh(sid, judul):
    os.makedirs(FOLDER, exist_ok=True)
    path = os.path.join(FOLDER, re.sub(r'[\\/:*?"<>|]', "_", judul) + ".xlsx")
    url = "https://docs.google.com/spreadsheets/d/%s/export?format=xlsx" % sid
    with urllib.request.urlopen(url, timeout=300) as r, open(path, "wb") as f:
        f.write(r.read())
    return path


def kolom_tabel(cur, tabel):
    cur.execute("SELECT column_name AS c FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND table_name = %s", (tabel,))
    return {r[0] for r in cur.fetchall()}


def syarat_bulan(kunci, d, bulan_no, tahun):
    if kunci in ("cos_harian", "cos_bulanan"):
        return "produk=%s AND tahun=%s AND bulan_no=%s", (d["produk"], tahun, bulan_no)
    return "produk=%s AND tahun=%s AND MONTH(tanggal)=%s", (d["produk"], tahun, bulan_no)


def bulan_lalu(tahun, bno):
    return (tahun - 1, 12) if bno == 1 else (tahun, bno - 1)


def buang_beku(cur, d, catatan):
    """CS/CRM: sheet yang total tiap kolomnya sama persis dengan bulan lalu."""
    th0, b0 = bulan_lalu(d["tahun"], d["bulan_no"])
    for kunci, kol in CEK_BEKU.items():
        tabel = TABEL[kunci][0]
        per_sheet = {}
        for r in d["tabel"][kunci]:
            per_sheet.setdefault(r["sheet_sumber"], []).append(r)
        beku = set()
        for sheet, rows in per_sheet.items():
            ini = [round(sum(r.get(c) or 0 for r in rows), 2) for c in kol]
            if not any(ini):
                continue
            cur.execute("SELECT %s FROM %s WHERE produk=%%s AND tahun=%%s AND MONTH(tanggal)=%%s AND sheet_sumber=%%s"
                        % (", ".join("COALESCE(ROUND(SUM(%s),2),0)" % c for c in kol), tabel),
                        (d["produk"], th0, b0, sheet))
            lalu = [round(float(x), 2) for x in cur.fetchone()]
            if lalu == ini:
                beku.add(sheet)
        if beku:
            d["tabel"][kunci] = [r for r in d["tabel"][kunci] if r["sheet_sumber"] not in beku]
            for s in sorted(beku):
                catatan.append("%s: sheet '%s' BEKU (sama persis dengan %02d/%d) -> dibuang" % (kunci, s, b0, th0))


def buang_mp_basi(cur, d, catatan):
    """Blok MP/TikTok berlabel tanggal basi (lihat extract_mp._label_basi):
    diterima sebagai data bulan ini KECUALI isinya sama persis dengan data
    bulan label di database -- itu berarti sheet beku, bukan data baru."""
    grup = {}
    for r in d["tabel"]["mp"]:
        if r.get("label_basi"):
            grup.setdefault((r["sheet_sumber"], r["blok"], r["label_basi"]), []).append(r)
    buang = set()
    for (sheet, blok, lab), rows in grup.items():
        th, bl = map(int, lab.split("-"))
        ini = [round(sum(r[c] for r in rows if isinstance(r.get(c), (int, float)))) for c in ("total_spend", "omset_total", "box")]
        cur.execute("SELECT COALESCE(ROUND(SUM(total_spend)),0), COALESCE(ROUND(SUM(omset_total)),0), "
                    "COALESCE(ROUND(SUM(box)),0) FROM data_spend_mp WHERE produk=%s AND tahun=%s "
                    "AND MONTH(tanggal)=%s AND sheet_sumber=%s AND blok=%s", (d["produk"], th, bl, sheet, blok))
        lalu = [int(x) for x in cur.fetchone()]
        if ini == lalu:
            buang.add((sheet, blok, lab))
            catatan.append("mp: blok '%s' / %s berlabel %s = SAMA PERSIS dgn data %s di DB -> BEKU, dibuang"
                           % (sheet, blok or "-", lab, lab))
        else:
            catatan.append("mp: blok '%s' / %s berlabel %s (basi) -> dipakai sbg %s %d; isinya beda dgn DB %s "
                           "(spend %s vs %s)" % (sheet, blok or "-", lab, d["bulan"], d["tahun"], lab,
                                                 format(ini[0], ","), format(lalu[0], ",")))
    if buang:
        d["tabel"]["mp"] = [r for r in d["tabel"]["mp"]
                            if (r["sheet_sumber"], r["blok"], r.get("label_basi")) not in buang]


def buang_baris_hantu(d, catatan):
    """MP: baris 'hantu' dari tabel kecil lain di sheet MP TOTAL.

    Blok Shopee-Lazada (Gamamilk, Premium, Sereal) memuat 5 baris tambahan
    untuk tgl 1-5 yang sebenarnya milik tabel bantu di sebelahnya: kolomnya
    bergeser satu, sehingga TANGGAL masuk ke kolom box dan nilai box masuk
    ke total_spend (spend_iklan negatif, omset kosong). Baris asli tgl 1-5
    tetap ada terpisah, jadi baris hantu aman dibuang.

    Ditemukan 23 Okt 2026: MySQL 8 menolaknya ('2026-07-01' bukan desimal),
    sedangkan MariaDB lokal diam-diam menyimpan box = 2026 -- data lama di
    DB memuat 51 baris seperti ini (+103 ribu box palsu)."""
    rows = d["tabel"]["mp"]
    hantu = [r for r in rows if not isinstance(r.get("box"), (int, float, type(None)))]
    if not hantu:
        return
    d["tabel"]["mp"] = [r for r in rows if isinstance(r.get("box"), (int, float, type(None)))]
    per = {}
    for r in hantu:
        per.setdefault((r.get("sheet_sumber"), r.get("blok")), []).append(str(r.get("tanggal")))
    for (sheet, blok), tgl in sorted(per.items()):
        catatan.append("mp: %d baris HANTU di '%s' / %s (%s..%s; tanggal masuk kolom box) -> dibuang"
                       % (len(tgl), sheet, blok or "-", min(tgl), max(tgl)))


def isi_id_adv(cur, d):
    for kunci in ("meta", "google", "snack"):
        rows = d["tabel"][kunci]
        if not rows:
            continue
        cur.execute("SELECT pic, MAX(id_adv) FROM %s WHERE id_adv IS NOT NULL GROUP BY pic" % TABEL[kunci][0])
        peta = dict(cur.fetchall())
        for r in rows:
            r["id_adv"] = peta.get(r["pic"])


def pratinjau(cur, d):
    hasil = []
    for kunci, (tabel, ukur, _) in TABEL.items():
        rows = d["tabel"][kunci]
        baru = (len(rows), sum(r.get(ukur) or 0 for r in rows if isinstance(r.get(ukur), (int, float))))
        w, p = syarat_bulan(kunci, d, d["bulan_no"], d["tahun"])
        cur.execute("SELECT COUNT(*), COALESCE(SUM(%s),0) FROM %s WHERE %s" % (ukur, tabel, w), p)
        n, s = cur.fetchone()
        hasil.append((kunci, tabel, ukur, baru, (n, float(s))))
    return hasil


def simpan(con, d):
    cur = con.cursor()
    dibuang = {}
    try:
        for kunci, (tabel, _, _) in TABEL.items():
            rows = d["tabel"][kunci]
            ada = kolom_tabel(cur, tabel)
            if not rows:
                # link tidak menghasilkan baris utk kanal ini: data lama DIBIARKAN
                # (sheet kosong/berganti nama tidak boleh menghapus data)
                continue
            w, p = syarat_bulan(kunci, d, d["bulan_no"], d["tahun"])
            cur.execute("DELETE FROM %s WHERE %s" % (tabel, w), p)
            kol = sorted({k for r in rows for k in r if k in ada and k != "id"})
            dibuang[tabel] = sorted({k for r in rows for k in r if k not in ada})
            sql = "INSERT INTO %s (%s) VALUES (%s)" % (tabel, ", ".join("`%s`" % k for k in kol),
                                                       ", ".join(["%s"] * len(kol)))
            cur.executemany(sql, [tuple(r.get(k) for k in kol) for r in rows])
        con.commit()
    except Exception:
        con.rollback()
        raise
    return dibuang


def status_kanal(n1, s1, n0, s0):
    if n1 == n0 and round(s1) == round(s0):
        return "sama"
    if n0 == 0 and n1:
        return "BARU"
    return "tetap (link kosong)" if n1 == 0 and n0 else "berubah"


def daftar_kanal(cur, d):
    return [dict(kunci=kunci, tabel=tabel, ukuran=ukur, baris_link=n1, total_link=round(s1),
                 baris_db=n0, total_db=round(s0), status=status_kanal(n1, s1, n0, s0))
            for kunci, tabel, ukur, (n1, s1), (n0, s0) in pratinjau(cur, d) if n1 or n0]


def proses(con, link, tulis):
    """Satu link: unduh, urai, saring, bandingkan dengan DB, lalu (bila
    `tulis`) simpan dalam satu transaksi. Hasilnya dict -- dicetak sebagai
    teks oleh CLI atau dikirim utuh sebagai JSON ke halaman Import EMR."""
    sid = id_sheet(link)
    judul = judul_sheet(sid)
    print("\n" + "=" * 78 + "\n%s\n  %s" % (judul, link))
    path = unduh(sid, judul)
    d = U.urai(path, judul)
    print("  -> produk %s, %s %d" % (d["produk"], d["bulan"], d["tahun"]))
    catatan = []
    cur = con.cursor()
    buang_beku(cur, d, catatan)
    buang_baris_hantu(d, catatan)
    buang_mp_basi(cur, d, catatan)
    isi_id_adv(cur, d)
    kanal = daftar_kanal(cur, d)
    print("  %-12s %-18s %22s   %22s" % ("kanal", "tabel", "DARI LINK (baris|total)", "DI DB SEKARANG"))
    for k in kanal:
        print("  %-12s %-18s %6d | %14s   %6d | %14s  %s" % (k["kunci"], k["tabel"], k["baris_link"],
                                                             format(k["total_link"], ","), k["baris_db"],
                                                             format(k["total_db"], ","), k["status"]))
    for c in catatan:
        print("  ! " + c)
    print("  tab dipakai: " + ", ".join("%s(%d)" % (x["tab"], x["baris"]) for x in d["tab_dipakai"]))
    hasil = dict(judul=judul, link=link, produk=d["produk"], bulan=d["bulan"], tahun=d["tahun"],
                 kanal=kanal, catatan=catatan, tab=d["tab_dipakai"], tersimpan=False)
    if tulis:
        dibuang = simpan(con, d)
        ekstra = {t: k for t, k in dibuang.items() if set(k) - {"bulan", "sumber_tabel", "produk_pendek"}}
        print("  ==> TERSIMPAN (1 transaksi)." + ("  kolom tanpa tempat: %s" % ekstra if ekstra else ""))
        cur.execute("INSERT INTO emr_import_log (waktu, judul, link, ringkasan) VALUES (NOW(), %s, %s, %s)",
                    (judul, link, json.dumps({k: len(v) for k, v in d["tabel"].items()})))
        con.commit()
        hasil.update(tersimpan=True, kolom_tanpa_tempat=ekstra,
                     cek_ulang=daftar_kanal(con.cursor(), d))   # setelah simpan semuanya harus "sama"
    return hasil


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("link", nargs="+")
    ap.add_argument("--simpan", action="store_true")
    ap.add_argument("--env", default=None)
    ap.add_argument("--env-proses", action="store_true")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    keluar = sys.stdout
    if a.json:
        # teks progres (termasuk dari pengurai) ke stderr; stdout hanya untuk JSON
        sys.stderr.reconfigure(encoding="utf-8")
        sys.stdout = sys.stderr
    try:
        con = koneksi(a.env, a.env_proses)
    except Exception as e:
        if not a.json:
            raise
        keluar.write(json.dumps({"ok": False, "pesan": "Gagal konek ke database: %s" % e}, ensure_ascii=False))
        return
    if a.simpan:
        with con.cursor() as c0:
            c0.execute("CREATE TABLE IF NOT EXISTS emr_import_log (id INT AUTO_INCREMENT PRIMARY KEY, "
                       "waktu DATETIME NOT NULL, judul VARCHAR(200), link VARCHAR(300), ringkasan TEXT) "
                       "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4")
        con.commit()
    semua = []
    for link in a.link:
        if not a.json:
            proses(con, link, a.simpan)
            continue
        try:
            semua.append(proses(con, link, a.simpan))
        except BaseException as e:      # SystemExit dari id_sheet ikut ditangkap
            con.rollback()
            semua.append({"link": link, "galat": str(e) or e.__class__.__name__})
    if a.json:
        db = con.db.decode() if isinstance(con.db, bytes) else con.db
        keluar.write(json.dumps({"ok": True, "db": {"host": con.host, "nama": db}, "hasil": semua},
                                ensure_ascii=False, default=str))
    con.close()


if __name__ == "__main__":
    main()
