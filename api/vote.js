// 좋아요/싫어요 함수: 로그인 없이 브라우저마다 익명 ID(쿠키)를 발급하고,
// Supabase에 (자격증, 익명ID) 한 쌍만 저장해 한 사람이 한 자격증에 한 표만 남기게 함.
// Vercel 서버리스 함수(/api/vote)이며 로컬 server.js에서도 같이 사용
//   GET  /api/vote?jmCd=1320,1321          → 자격증별 좋아요·싫어요 수와 내 투표
//   POST /api/vote {"jmCd":"1320","vote":1} → 1 좋아요, -1 싫어요, 0 취소

const crypto = require("crypto");

// 익명 ID를 담을 쿠키 이름과 유효기간(1년)
const COOKIE = "voter_id";
const ONE_YEAR = 60 * 60 * 24 * 365;
// 종목코드 형식(숫자 1~6자리)과 한 번에 조회할 최대 개수
const JM_RE = /^[0-9]{1,6}$/;
const MAX_CODES = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 요청 본문(JSON) 읽기: Vercel은 req.body를 채워 주고, Node 기본 서버는 직접 읽어야 함
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 2000) throw new Error("요청이 너무 커요");
  }
  return JSON.parse(raw || "{}");
}

// 쿠키에서 익명 ID 꺼내기(형식이 올바르지 않으면 없는 것으로 봄)
function getVoterId(req) {
  const m = (req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m && UUID_RE.test(m[1]) ? m[1] : null;
}

// 익명 ID 쿠키 내려주기(자바스크립트로 읽을 수 없게 HttpOnly, 다른 사이트에서 못 보내게 SameSite=Lax)
function setVoterCookie(req, res, id) {
  const https = (req.headers["x-forwarded-proto"] || "").includes("https") || req.socket?.encrypted;
  res.setHeader("Set-Cookie", `${COOKIE}=${id}; Path=/; Max-Age=${ONE_YEAR}; HttpOnly; SameSite=Lax${https ? "; Secure" : ""}`);
}

// Supabase REST API 호출 도우미
async function supabase(path, { method = "GET", body, prefer } = {}) {
  const base = process.env.SUPABASE_URL.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  const headers = { apikey: key, "Content-Type": "application/json" };
  // 예전 방식 service_role 키(JWT, eyJ로 시작)는 Authorization 헤더도 함께 보내야 함
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${base}/rest/v1/${path}`, { method, headers, body: body && JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase 오류 (${res.status}): ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

// 여러 자격증의 좋아요·싫어요 수와 내 투표를 { 종목코드: { likes, dislikes, mine } }로 만들기
async function getCounts(codes, voterId) {
  const list = `(${codes.join(",")})`;
  const [counts, mine] = await Promise.all([
    supabase(`cert_vote_counts?select=jm_cd,likes,dislikes&jm_cd=in.${list}`),
    voterId ? supabase(`cert_votes?select=jm_cd,vote&voter_id=eq.${voterId}&jm_cd=in.${list}`) : [],
  ]);
  const out = {};
  for (const c of codes) out[c] = { likes: 0, dislikes: 0, mine: 0 };
  for (const r of counts) out[r.jm_cd] = { ...out[r.jm_cd], likes: r.likes, dislikes: r.dislikes };
  for (const r of mine) out[r.jm_cd].mine = r.vote;
  return out;
}

module.exports = async function handler(req, res) {
  const send = (status, obj) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(obj));
  };

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return send(500, { error: "서버에 SUPABASE_URL, SUPABASE_SECRET_KEY 환경변수가 설정되지 않았어요." });
  }

  try {
    // ----- 조회 -----
    if (req.method === "GET") {
      const query = new URL(req.url, "http://localhost").searchParams.get("jmCd") || "";
      const codes = [...new Set(query.split(",").map((s) => s.trim()))].filter((c) => JM_RE.test(c)).slice(0, MAX_CODES);
      if (codes.length === 0) return send(400, { error: "jmCd(종목코드)가 필요해요." });
      return send(200, { counts: await getCounts(codes, getVoterId(req)) });
    }

    // ----- 투표 -----
    if (req.method === "POST") {
      // JSON 요청만 받기(다른 사이트의 단순 폼 전송으로 투표하지 못하게)
      if (!String(req.headers["content-type"] || "").includes("application/json")) return send(415, { error: "JSON으로 보내 주세요." });
      let body;
      try { body = await readBody(req); } catch { return send(400, { error: "요청 형식이 올바르지 않아요." }); }
      const jmCd = String(body.jmCd ?? "");
      const vote = Number(body.vote);
      if (!JM_RE.test(jmCd) || ![1, -1, 0].includes(vote)) return send(400, { error: "종목코드와 투표 값(1, -1, 0)이 올바르지 않아요." });

      // 익명 ID가 없으면 새로 만들어 쿠키로 발급
      let voterId = getVoterId(req);
      if (!voterId) voterId = crypto.randomUUID();
      setVoterCookie(req, res, voterId);

      if (vote === 0) {
        // 취소: 내 표 지우기
        await supabase(`cert_votes?jm_cd=eq.${jmCd}&voter_id=eq.${voterId}`, { method: "DELETE", prefer: "return=minimal" });
      } else {
        // 좋아요/싫어요: (자격증, 익명ID)가 이미 있으면 덮어쓰기 → 한 사람당 항상 한 표
        await supabase("cert_votes?on_conflict=jm_cd,voter_id", {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=minimal",
          body: { jm_cd: jmCd, voter_id: voterId, vote, updated_at: new Date().toISOString() },
        });
      }
      return send(200, { counts: await getCounts([jmCd], voterId) });
    }

    send(405, { error: "GET 또는 POST로 요청해 주세요." });
  } catch (err) {
    console.error(err);
    send(502, { error: "좋아요 정보를 처리하지 못했어요." });
  }
};
