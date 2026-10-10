#!/usr/bin/env python3
"""全上場銘柄の株価・指数・ニュース・予定を取得して data/*.json に書き出す(標準ライブラリ+xlrd)。
GitHub Actions から定期実行されます。手元で試す場合: python scripts/fetch_data.py"""
import csv, datetime, io, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor
from email.utils import parsedate_to_datetime

OUT = os.environ.get("OUT", "data")
MAX_STOCKS = int(os.environ.get("MAX_STOCKS", "0"))      # 0=全銘柄(動作確認用に制限できます)
MIN_VAL = float(os.environ.get("MIN_VAL", "1"))          # 分足を取る候補の売買代金下限(億円)
WORKERS = int(os.environ.get("WORKERS", "24"))
UA = {"User-Agent": "Mozilla/5.0"}
JPX_PAGE = "https://www.jpx.co.jp/markets/statistics-equities/misc/01.html"
JPX_URLS = ["https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xlsx",
            "https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls"]
INDEX = [("^N225", "日経平均"), ("1306.T", "TOPIX(1306)"), ("2516.T", "グロース250(2516)"), ("NIY=F", "日経225先物(CME円)"),
         ("USDJPY=X", "ドル円"), ("^DJI", "NYダウ"), ("^IXIC", "NASDAQ"), ("^GSPC", "S&P500"), ("^SOX", "SOX指数"),
         ("^VIX", "VIX"), ("^TNX", "米10年債利回り"), ("CL=F", "原油(WTI)"), ("GC=F", "金"), ("000001.SS", "上海総合"), ("^HSI", "香港ハンセン")]
FEEDS = [("Yahoo!ニュース経済", "https://news.yahoo.co.jp/rss/topics/business.xml"),
         ("Googleニュース(株式)", "https://news.google.com/rss/search?q=" + urllib.parse.quote("株式 相場 OR 日経平均 OR 急騰 OR 決算") + "&hl=ja&gl=JP&ceid=JP:ja"),
         ("Googleニュース(材料)", "https://news.google.com/rss/search?q=" + urllib.parse.quote("上方修正 OR 自社株買い OR ストップ高 OR 日銀 OR 円安") + "&hl=ja&gl=JP&ceid=JP:ja"),
         ("Googleニュース(決算)", "https://news.google.com/rss/search?q=" + urllib.parse.quote("決算 OR 業績予想 OR 下方修正 OR 増配") + "&hl=ja&gl=JP&ceid=JP:ja"),
         ("Googleニュース(相場)", "https://news.google.com/rss/search?q=" + urllib.parse.quote("日経平均 OR 東証 OR 米国株 OR 為替") + "&hl=ja&gl=JP&ceid=JP:ja")]
KW = {"ストップ高": 5, "急騰": 4, "急落": 4, "上方修正": 4, "下方修正": 4, "自社株買い": 3, "増配": 3, "減配": 3, "決算": 2, "日銀": 3, "利上げ": 3,
      "円安": 2, "円高": 2, "半導体": 2, "先物": 1, "提携": 2, "M&A": 3, "買収": 3, "TOB": 4, "最高値": 3, "急伸": 3, "不祥事": 3, "訴訟": 2, "規制": 2}

def get(url, t=20, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=t) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503) and i < tries - 1: time.sleep(2 + 3 * i); continue
            raise
        except Exception:
            if i == tries - 1: raise
            time.sleep(1)

def r2(x): return None if x is None else round(x, 2)

def build(price, prev, o, hi, lo, vol, pv, avgvol, vwap, m, atr, pyh, pyl, h52, l52, spark):
    ref = pv or avgvol
    d = dict(price=r2(price), prev=r2(prev), open=r2(o), hi=r2(hi), lo=r2(lo), vol=int(vol), pv=int(pv or 0), avgvol=int(avgvol or 0),
        vr=r2(vol / ref) if ref else 0, val=r2(price * vol / 1e8), chg=r2((price / prev - 1) * 100), chgv=r2(price - prev),
        gap=r2((o / prev - 1) * 100), gapv=r2(o - prev), fo=r2((price / o - 1) * 100), vwap=r2(vwap),
        vd=r2((price / vwap - 1) * 100) if vwap else None, m1=r2(m[0]), m5=r2(m[1]), m15=r2(m[2]),
        rng=r2(hi - lo), atr=r2(atr), used=r2((hi - lo) / atr * 100) if atr else None,
        pyh=r2(pyh), pyl=r2(pyl), h52=r2(h52), l52=r2(l52))
    if spark: d["spark"] = [r2(x) for x in spark]
    return {k: v for k, v in d.items() if v is not None}

def daily(sym):
    d = json.loads(get(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?range=1mo&interval=1d"))["chart"]["result"][0]
    q = d["indicators"]["quote"][0]; m = d["meta"]
    R = [b for b in zip(q["open"], q["high"], q["low"], q["close"], q["volume"]) if None not in (b[1], b[2], b[3])]
    price = m.get("regularMarketPrice") or R[-1][3]; v = [b[4] or 0 for b in R[:-1]]
    r = build(price, R[-2][3], R[-1][0] or price, R[-1][1], R[-1][2], R[-1][4] or 0, 0, sum(v) / len(v) if v else 0, None,
                 (None, None, None), sum(b[1] - b[2] for b in R[:-1]) / max(1, len(R) - 1), R[-2][1], R[-2][2],
                 m.get("fiftyTwoWeekHigh"), m.get("fiftyTwoWeekLow"), None)
    r["_n"] = m.get("longName") or m.get("shortName")
    return r

def intraday(sym):
    d = json.loads(get(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?range=5d&interval=1m"))["chart"]["result"][0]
    m = d["meta"]; off = m.get("gmtoffset", 0); q = d["indicators"]["quote"][0]
    B = [b for b in zip(d["timestamp"], q["open"], q["high"], q["low"], q["close"], q["volume"]) if None not in (b[2], b[3], b[4])]
    day = lambda t: (t + off) // 86400
    tod = lambda t: (t + off) % 86400
    td = day(B[-1][0]); T = [b for b in B if day(b[0]) == td]; Y = [b for b in B if day(b[0]) < td]
    P = [b for b in Y if day(b[0]) == day(Y[-1][0])]; days = {}
    for b in Y: days.setdefault(day(b[0]), []).append(b)
    vols = [sum(x[5] or 0 for x in v) for v in days.values()]
    rngs = [max(x[2] for x in v) - min(x[3] for x in v) for v in days.values()]
    price = m.get("regularMarketPrice") or T[-1][4]; vol = sum(b[5] or 0 for b in T)
    cut = tod(T[-1][0]); pv = sum(b[5] or 0 for b in P if tod(b[0]) <= cut)
    vwap = sum((b[2] + b[3] + b[4]) / 3 * (b[5] or 0) for b in T) / vol if vol else None
    ch = lambda n: (T[-1][4] / T[-1 - n][4] - 1) * 100 if len(T) > n else None
    st = max(1, len(T) // 60)
    r = build(price, P[-1][4], T[0][1] or T[0][4], max(b[2] for b in T), min(b[3] for b in T), vol, pv,
                 sum(vols) / len(vols) if vols else 0, vwap, (ch(1), ch(5), ch(15)), sum(rngs) / len(rngs) if rngs else None,
                 max(b[2] for b in P), min(b[3] for b in P), m.get("fiftyTwoWeekHigh"), m.get("fiftyTwoWeekLow"), [b[4] for b in T[::st]])
    o15 = T[:15]; r["orh"] = r2(max(b[2] for b in o15)); r["orl"] = r2(min(b[3] for b in o15)); r["orf"] = 1 if len(T) >= 15 else 0
    return r

def safe(f, sym):
    try: return f(sym)
    except Exception: return None

def read_table(data):
    if data[:2] == b"PK":                      # xlsx
        import openpyxl
        return list(openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True).active.iter_rows(values_only=True))
    if data[:4] == b"\xd0\xcf\x11\xe0":          # 旧xls
        import xlrd
        sh = xlrd.open_workbook(file_contents=data).sheet_by_index(0)
        return [sh.row_values(r) for r in range(sh.nrows)]
    for enc in ("utf-8-sig", "cp932"):          # csv
        try: return list(csv.reader(io.StringIO(data.decode(enc))))
        except Exception: pass
    raise ValueError("形式を判別できません")

def parse_rows(rows):
    rows = [list(r) for r in rows if r and any(c not in (None, "") for c in r)]
    hdr = [str(c or "") for c in rows[0]]
    ix = lambda n: next(i for i, h in enumerate(hdr) if n in h)
    ic, inm, im, isec = ix("コード"), ix("銘柄名"), ix("市場"), ix("33業種区分")
    out = []
    for row in rows[1:]:
        c = row[ic]; code = str(int(c)) if isinstance(c, (int, float)) else str(c).strip()
        mk = str(row[im] or "")
        if code and any(k in mk for k in ("プライム", "スタンダード", "グロース")):
            out.append(dict(code=code, name=str(row[inm]).strip(), sector=str(row[isec]).strip(), market=re.sub(r"[（(].*", "", mk)))
    return out

def jp_ok(u):
    return len(u) > 1000 and sum(1 for x in u if any(ord(ch) > 127 for ch in x["name"])) > len(u) * 0.3

def load_universe():
    """日本語の銘柄名・33業種つきの一覧を取得する(JPX公開のExcel)。手元の universe.csv があれば最優先。"""
    cands = []
    if os.path.exists("universe.csv"): cands.append(("universe.csv", lambda: open("universe.csv", "rb").read()))
    for u in JPX_URLS: cands.append((u, lambda u=u: get(u, 60)))
    tried_page = False
    while cands:
        name, fn = cands.pop(0)
        try:
            out = parse_rows(read_table(fn()))
            if len(out) > 1000: print(f"銘柄一覧: {len(out)}銘柄 ({name})"); return out
            print("銘柄数が少ないため不採用:", name, len(out))
        except Exception as e:
            print("銘柄一覧の取得に失敗:", name, e)
        if not cands and not tried_page:        # 固定URLが変わった場合に備え、JPXのページからリンクを探す
            tried_page = True
            try:
                html = get(JPX_PAGE, 30).decode("utf-8", "ignore")
                for l in re.findall(r'href="([^"]*data_j\.xlsx?)"', html): cands.append((l, lambda l=l: get(urllib.parse.urljoin(JPX_PAGE, l), 60)))
            except Exception as e: print("JPXページの取得に失敗:", e)
    for p in ("data/universe.json", os.path.join(OUT, "universe.json")):
        try:
            u = json.load(open(p, encoding="utf-8"))
            if jp_ok(u): print("キャッシュの銘柄一覧を使用:", len(u)); return u
        except Exception: pass
    return None

def brute_universe():
    print("JPX一覧が使えないため、証券コード1301〜9999を総当たりで探索します(時間がかかります)")
    codes = [str(c) for c in range(1301, 10000)]
    with ThreadPoolExecutor(WORKERS) as ex:
        res = list(ex.map(lambda c: safe(daily, c + ".T"), codes))
    U, R = [], []
    for c, r in zip(codes, res):
        if r: U.append(dict(code=c, name=r.get("_n") or c, sector="未分類", market="")); R.append(r)
    print("総当たりで見つかった銘柄:", len(U))
    return U, R

def n225_hist():
    try:
        d = json.loads(get("https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?range=1y&interval=1d"))["chart"]["result"][0]
        off = d["meta"].get("gmtoffset", 32400); out = {}; prev = None
        for t, x in zip(d["timestamp"], d["indicators"]["quote"][0]["close"]):
            if x is None: continue
            if prev: out[datetime.datetime.utcfromtimestamp(t + off).strftime("%Y-%m-%d")] = round((x / prev - 1) * 100, 2)
            prev = x
        return out
    except Exception:
        return {}

def news(names):
    seen, items = set(), []
    for src, url in FEEDS:
        try: its = list(ET.fromstring(get(url, 15)).iter("item"))
        except Exception: continue
        for it in its:
            title = (it.findtext("title") or "").strip(); key = re.sub(r"\s*[-－]\s*[^-－]+$", "", title); link = it.findtext("link") or ""
            if not title or key in seen or not link.startswith("http"): continue
            seen.add(key)
            try: ts = parsedate_to_datetime(it.findtext("pubDate")).timestamp()
            except Exception: ts = 0
            tags = [k for k in KW if k in title]
            codes = [c for n, c in names if n in title][:4]
            score = sum(KW[k] for k in tags) + 3 * len(codes) + max(0, 6 - ((time.time() - ts) / 3600 if ts else 24))
            items.append(dict(title=title, link=link, src=src, ts=ts, tags=tags, codes=codes, score=round(score, 1)))
    items.sort(key=lambda x: -x["ts"])      # 新しい順(重要度は画面側で並べ替え可能)
    return items[:100]

def us_dst(d):
    nth = lambda y, m, n: (lambda f: f + datetime.timedelta(days=(6 - f.weekday()) % 7 + 7 * (n - 1)))(datetime.date(y, m, 1))
    return nth(d.year, 3, 2) <= d < nth(d.year, 11, 1)

def events(now):
    d0 = now.date(); dst = us_dst(d0)
    today = [("08:45", "日経225先物 日中寄付"), ("09:00", "東証 寄付(前場)"), ("11:30", "前場引け"), ("12:30", "後場寄付"), ("15:30", "大引け"), ("22:30" if dst else "23:30", "米国市場 寄付")]
    up = []
    for k in range(15):
        d = d0 + datetime.timedelta(k)
        if d.weekday() == 4 and (d.day - 1) // 7 == 1: up.append((d.isoformat(), "09:00", "メジャーSQ" if d.month in (3, 6, 9, 12) else "SQ(オプション・先物)"))
        if d.weekday() == 4 and d.day <= 7: up.append((d.isoformat(), "21:30" if us_dst(d) else "22:30", "米雇用統計(第1金曜・通常)"))
    try:
        for e in json.load(open("events.json", encoding="utf-8")):
            d = datetime.date.fromisoformat(e["date"])
            if d == d0: today.append((e.get("time", "--:--"), e["name"]))
            elif 0 < (d - d0).days <= 14: up.append((e["date"], e.get("time", ""), e["name"]))
    except Exception: pass
    today += [(t, n) for dd, t, n in up if dd == d0.isoformat()]
    return dict(date=d0.isoformat(), today=sorted(today), upcoming=sorted(x for x in up if x[0] != d0.isoformat()))

TDNET = "https://www.release.tdnet.info/inbs/"

class _TD(HTMLParser):
    def __init__(s): super().__init__(); s.rows = []; s.row = None; s.cell = None; s.href = None
    def handle_starttag(s, t, a):
        a = dict(a)
        if t == "tr": s.row = []; s.href = None
        elif t in ("td", "th") and s.row is not None: s.cell = ""
        elif t == "a" and s.row is not None and (a.get("href") or "").lower().endswith(".pdf"): s.href = a["href"]
    def handle_data(s, d):
        if s.cell is not None: s.cell += d
    def handle_endtag(s, t):
        if t in ("td", "th") and s.cell is not None and s.row is not None: s.row.append(s.cell.strip().replace("\u3000", " ")); s.cell = None
        elif t == "tr" and s.row is not None: s.rows.append((s.row, s.href)); s.row = None

def classify(t):
    k = []
    if "決算短信" in t or "決算説明" in t: k.append("決算")
    if "業績予想" in t and ("修正" in t or "差異" in t): k.append("業績修正")
    if "上方" in t: k.append("上方")
    if "下方" in t: k.append("下方")
    if "配当" in t: k.append("配当")
    if "増配" in t: k.append("増配")
    if "減配" in t or "無配" in t: k.append("減配")
    if "自己株式" in t and "取得" in t: k.append("自社株買い")
    if "株式分割" in t: k.append("株式分割")
    if any(x in t for x in ("公開買付", "TOB", "合併", "株式取得", "子会社化", "業務提携", "資本提携", "事業譲渡")): k.append("M&A・提携")
    return k

def disclosures(now, days=3):
    """東証TDnet(適時開示)の一覧から、直近の開示を取得し、タイトルの語句で独自に分類する。取得は低頻度(実行ごとに数リクエスト)。"""
    items, seen = [], set()
    for back in range(days):
        d = now.date() - datetime.timedelta(days=back)
        if d.weekday() >= 5: continue
        got = 0
        for page in range(1, 8):
            url = f"{TDNET}I_list_{page:03d}_{d.strftime('%Y%m%d')}.html"
            try: html = get(url, 20).decode("utf-8", "ignore")
            except Exception: break
            p = _TD(); p.feed(html); n = 0
            for cells, href in p.rows:
                if len(cells) < 4 or not re.fullmatch(r"\d{1,2}:\d{2}", cells[0]) or not re.fullmatch(r"[0-9A-Z]{5}", cells[1]): continue
                key = (d, cells[0], cells[1], cells[3])
                if key in seen: continue
                seen.add(key); n += 1
                items.append(dict(date=d.isoformat(), time=cells[0].zfill(5), code=cells[1][:4], name=cells[2], title=cells[3], url=urllib.parse.urljoin(TDNET, href) if href else "", tags=classify(cells[3])))
            got += n
            if n == 0: break
    items.sort(key=lambda x: (x["date"], x["time"]), reverse=True)
    return dict(asof=now.strftime("%Y-%m-%d %H:%M:%S"), items=items[:600])

def tags_score(h):
    h["score"] = round(min(h["vr"], 10) * 2 + abs(h["chg"]) * 3 + abs(h["gap"]) * 1.5 + abs(h.get("vd", 0)), 1)
    h["tags"] = [t for t, ok in (("急騰", h["chg"] >= 3), ("急落", h["chg"] <= -3), ("出来高急増", h["vr"] >= 2), ("GU", h["gap"] >= 2), ("GD", h["gap"] <= -2)) if ok]

MODE = os.environ.get("MODE", "auto")                      # auto / full / fast
PREV = os.environ.get("PREV", "prev.json")                  # 前回公開された market.json(高速更新用)
FULL_EVERY = int(os.environ.get("FULL_EVERY_MIN", "12"))   # 全銘柄の日足を取り直す間隔(分)

def load_prev():
    try:
        d = json.load(open(PREV, encoding="utf-8"))
        if d.get("stocks") and d.get("ts"): return d
    except Exception: pass
    return None

def write(name, obj, **kw):
    json.dump(obj, open(os.path.join(OUT, name), "w", encoding="utf-8"), ensure_ascii=False, **kw)

def main():
    jst = datetime.timezone(datetime.timedelta(hours=9)); now = datetime.datetime.now(jst)
    os.makedirs(OUT, exist_ok=True); t0 = time.time()
    prev = load_prev() if MODE != "full" and not MAX_STOCKS else None
    fast = bool(prev) and (MODE == "fast" or time.time() - prev.get("full_ts", prev["ts"]) < FULL_EVERY * 60)
    U = None
    if fast:
        S = prev["stocks"]; full_ts = prev.get("full_ts", prev["ts"]); nuni = prev.get("universe", len(S))
        print(f"高速更新: 前回の全銘柄データ({len(S)}銘柄)を再利用し、注目銘柄の分足だけ更新します")
    else:
        U = load_universe(); pre = None
        if U is None: U, pre = brute_universe()
        if MAX_STOCKS: U = U[:MAX_STOCKS]; pre = None
        if pre is None:
            with ThreadPoolExecutor(WORKERS) as ex:
                res = list(ex.map(lambda u: safe(daily, u["code"] + ".T"), U))
        else: res = pre
        S = [dict(code=u["code"], name=u["name"], sector=u["sector"], market=u.get("market", ""), **{k: v for k, v in r.items() if k != "_n"}) for u, r in zip(U, res) if r]
        print(f"日足: {len(S)}/{len(U)}銘柄 ({time.time() - t0:.0f}秒)")
        if len(S) < min(10, len(U)): sys.exit("取得できた銘柄が少なすぎるため中止します")
        for h in S: tags_score(h)
        full_ts = int(time.time()); nuni = len(U)
    pool = [h for h in S if h["val"] >= MIN_VAL]
    cand = {}
    for key, rev in (("chg", True), ("chg", False), ("vr", True), ("val", True), ("gap", True), ("gap", False), ("score", True)):
        for h in sorted(pool, key=lambda x: x[key], reverse=rev)[:15]: cand[h["code"]] = h
    for h in sorted(pool, key=lambda x: -x["score"])[:100]: cand[h["code"]] = h
    with ThreadPoolExecutor(WORKERS) as ex:
        det = list(ex.map(lambda h: safe(intraday, h["code"] + ".T"), cand.values()))
    n_det = 0
    for h, r in zip(cand.values(), det):
        if r: h.update(r); tags_score(h); h["intra"] = 1; n_det += 1
    print(f"分足: {n_det}/{len(cand)}銘柄")
    with ThreadPoolExecutor(8) as ex:
        ir = list(ex.map(lambda s: safe(intraday, s[0]) or safe(daily, s[0]), INDEX))
    idx = [dict(sym=s, name=n, **r) for (s, n), r in zip(INDEX, ir) if r]
    ts = int(time.time()); asof = now.strftime("%Y-%m-%d %H:%M:%S")
    write("market.json", dict(asof=asof, ts=ts, full_ts=full_ts, mode="fast" if fast else "full", count=len(S), universe=nuni, intraday=n_det, index=idx, stocks=S), separators=(",", ":"))
    write("meta.json", dict(ts=ts, full_ts=full_ts, asof=asof, mode="fast" if fast else "full", count=len(S)))
    if U is None: U = [dict(code=h["code"], name=h["name"], sector=h["sector"], market=h.get("market", "")) for h in S]
    names = sorted(((u["name"], u["code"]) for u in U if len(u["name"]) >= 3), key=lambda x: -len(x[0]))
    write("news.json", dict(asof=now.strftime("%H:%M:%S"), items=news(names)))
    write("events.json", events(now))
    try: write("disclosures.json", disclosures(now))
    except Exception as e:
        print("適時開示の取得に失敗:", e); write("disclosures.json", dict(asof="", items=[]))
    write("hist.json", dict(asof=asof, n225=n225_hist()))
    write("universe.json", U, separators=(",", ":"))
    print("完了", "高速" if fast else "全銘柄", f"{time.time() - t0:.0f}秒")

if __name__ == "__main__":
    main()
