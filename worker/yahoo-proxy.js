// Cloudflare Worker(無料プランで動作): ブラウザからYahoo!ファイナンスの1分足をまとめて取得するための中継
// 使い方: Cloudflare ダッシュボード → Workers & Pages → Create → Worker → このコードを貼り付けて Deploy
//   GET /multi?s=7203.T,^N225,...&r=1d&i=1m  → 銘柄ごとのchart JSONをまとめて返す(最大45銘柄・1リクエスト)
//   GET /?url=https://query1.finance.yahoo.com/...  → 許可したドメインのみ中継
// ※ 解析せず文字列を連結するだけなので、無料枠のCPU時間制限に収まります。キャッシュは数秒。
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET", "cache-control": "public, max-age=3" };
const OK = /^https:\/\/(query[12]\.finance\.yahoo\.com|news\.yahoo\.co\.jp|news\.google\.com)\//;
const UA = { "user-agent": "Mozilla/5.0" };
export default {
  async fetch(req) {
    const u = new URL(req.url);
    if (u.pathname === "/multi") {
      const syms = (u.searchParams.get("s") || "").split(",").filter(Boolean).slice(0, 45);
      const r = u.searchParams.get("r") || "1d", i = u.searchParams.get("i") || "1m";
      const parts = await Promise.all(syms.map(async (x) => {
        try {
          const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(x)}?range=${r}&interval=${i}`, { headers: UA, cf: { cacheTtl: 5, cacheEverything: true } });
          return JSON.stringify(x) + ":" + (res.ok ? await res.text() : "null");
        } catch (e) { return JSON.stringify(x) + ":null"; }
      }));
      return new Response("{" + parts.join(",") + "}", { headers: { ...CORS, "content-type": "application/json" } });
    }
    const t = u.searchParams.get("url");
    if (!t || !OK.test(t)) return new Response("bad request", { status: 400, headers: CORS });
    const res = await fetch(t, { headers: UA, cf: { cacheTtl: 5, cacheEverything: true } });
    return new Response(res.body, { status: res.status, headers: { ...CORS, "content-type": res.headers.get("content-type") || "text/plain" } });
  },
};
