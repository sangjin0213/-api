// q-net API 중계 함수: Vercel 서버리스 함수로 쓰이고, 로컬 server.js에서도 같이 사용
// 브라우저 대신 q-net을 호출해 CORS 문제를 피하고, 인증키를 브라우저에 노출하지 않음

// q-net API 실제 주소
const QNET = "http://openapi.q-net.or.kr/api/service/rest";

// 중계를 허용할 기능 목록(이 외의 주소는 막아서 아무 요청이나 대신 보내지 않게 함)
const ALLOWED = new Set([
  "InquiryUnivUdeptSVC/getList",              // ① 대학별 학과 정보
  "InquiryTestInformationNTQSVC/getJMList",   // ② 종목별 시험일정
  "InquiryTestInformationNTQSVC/getFeeList",  // ② 종목별 응시 수수료
  "InquiryQualPassRateSVC/getList",           // ③ 연도별 회별 합격률
]);

// 요청 하나를 처리하는 함수(Vercel과 Node 기본 서버 모두에서 동작하도록 기본 기능만 사용)
module.exports = async function handler(req, res) {
  // 응답을 보내는 공통 함수
  const send = (status, body, type = "text/plain; charset=utf-8", cache = "no-store") => {
    res.statusCode = status;
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", cache);
    res.end(body);
  };

  // 환경변수에서 인증키 읽기(Vercel: 프로젝트 설정, 로컬: .env.local)
  const key = process.env.SERVICE_KEY;
  if (!key) return send(500, "서버에 SERVICE_KEY 환경변수가 설정되지 않았어요.");

  // 요청 주소에서 기능 경로와 나머지 파라미터 꺼내기
  const incoming = new URL(req.url, "http://localhost");
  // Vercel 주소 변환(/qnet/... → /api/qnet?path=...)이면 path 파라미터, 로컬이면 /qnet/ 뒤 경로 사용
  const apiPath = (incoming.searchParams.get("path") || incoming.pathname.replace(/^\/qnet\//, "")).replace(/^\/+/, "");
  incoming.searchParams.delete("path");
  if (!ALLOWED.has(apiPath)) return send(404, "허용되지 않은 API 경로예요.");

  // q-net 요청 주소 만들기(브라우저가 보낸 파라미터 + 서버만 아는 인증키)
  const target = new URL(`${QNET}/${apiPath}`);
  for (const [k, v] of incoming.searchParams) if (k.toLowerCase() !== "servicekey") target.searchParams.set(k, v);
  target.searchParams.set("serviceKey", key);

  try {
    // q-net 호출 후 받은 XML을 그대로 돌려주기
    const apiRes = await fetch(target);
    const text = await apiRes.text();
    // 정상 응답은 1시간 동안 Vercel에 캐시해서 q-net 호출 횟수 줄이기
    const cache = apiRes.ok ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store";
    send(apiRes.status, text, "application/xml; charset=utf-8", cache);
  } catch (err) {
    // q-net 연결 실패
    send(502, "q-net 연결 실패: " + err.message);
  }
};
