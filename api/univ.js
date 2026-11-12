// 전국 대학 목록 중계 함수: 커리어넷 학교정보 API(공공데이터포털 '전국 대학 정보'의 실제 제공처)를 호출해
// 대학 이름 목록만 JSON으로 돌려줌. Vercel 서버리스 함수(/api/univ)이며 로컬 server.js에서도 같이 사용

// 커리어넷 학교정보 API 주소(환경변수 UNIV_API_URL로 바꿀 수 있음)
const UNIV_API = process.env.UNIV_API_URL || "https://www.career.go.kr/cnet/openapi/getOpenApi";
// 한 번에 받을 개수
const PER_PAGE = 1000;
// 대학 이름이 들어 있을 수 있는 필드명(API마다 이름이 달라서 여러 개 확인)
const NAME_KEYS = ["schoolName", "schoolNm", "schlNm", "univNm", "univnm", "학교명", "대학명"];

// 서버가 살아 있는 동안 목록을 기억해 두기(매번 외부 API를 부르지 않도록)
let cache = null;

// JSON 안을 돌아다니며 대학 이름 값 모으기
function collectNames(node, out) {
  if (Array.isArray(node)) node.forEach((n) => collectNames(n, out));
  else if (node && typeof node === "object") {
    for (const k of NAME_KEYS) if (typeof node[k] === "string" && node[k].trim()) out.push(node[k].trim());
    Object.values(node).forEach((v) => typeof v === "object" && collectNames(v, out));
  }
  return out;
}

// 전체 대학 목록 받아오기(4년제 + 전문대, 여러 페이지)
async function fetchAll(key) {
  const names = new Set();
  for (let page = 1; page <= 20; page++) {
    const url = new URL(UNIV_API);
    url.searchParams.set("apiKey", key);
    url.searchParams.set("svcType", "api");
    url.searchParams.set("svcCode", "SCHOOL");
    url.searchParams.set("contentType", "json");
    url.searchParams.set("gubun", "univ_list");
    url.searchParams.set("perPage", PER_PAGE);
    url.searchParams.set("thisPage", page);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`대학 정보 API 응답 오류 (${res.status})`);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error("대학 정보 API 응답을 읽지 못했어요: " + text.slice(0, 120)); }
    const found = collectNames(json, []);
    const before = names.size;
    found.forEach((n) => names.add(n));
    // 더 받을 게 없으면 멈추기
    if (found.length < PER_PAGE || names.size === before) break;
  }
  if (names.size === 0) throw new Error("대학 정보 API에서 대학 목록을 받지 못했어요. 인증키를 확인해 주세요.");
  return [...names].sort((a, b) => a.localeCompare(b, "ko"));
}

module.exports = async function handler(req, res) {
  const send = (status, body, type = "application/json; charset=utf-8", cacheHeader = "no-store") => {
    res.statusCode = status;
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", cacheHeader);
    res.end(body);
  };

  const key = process.env.UNIV_API_KEY;
  if (!key) return send(500, "서버에 UNIV_API_KEY 환경변수가 설정되지 않았어요.", "text/plain; charset=utf-8");

  try {
    if (!cache) cache = await fetchAll(key);
    // 대학 목록은 자주 바뀌지 않으니 하루 동안 Vercel에 캐시
    send(200, JSON.stringify({ names: cache }), undefined, "public, s-maxage=86400, stale-while-revalidate=604800");
  } catch (err) {
    send(502, err.message, "text/plain; charset=utf-8");
  }
};
