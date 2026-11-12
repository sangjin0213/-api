// AI 학과 연결 함수: 등록되지 않은 대학·학과를 받아, '국가기술자격 대학별 학과 정보'에 있는 대학·학과 중
// 커리큘럼·과목·진로가 비슷한 4곳을 OpenRouter AI로 골라 줌. Vercel 서버리스 함수(/api/ai)이며 로컬 server.js에서도 사용

// OpenRouter 주소와 사용할 모델(환경변수 OPENROUTER_MODEL로 바꿀 수 있음)
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "baidu/ernie-5.5-flash-preview:free";
// 추천 개수
const PICK_COUNT = 4;
// 받을 후보 개수·글자 수 제한(아무 내용이나 AI로 보내지 못하게)
const MAX_CANDIDATES = 1500;
const MAX_TEXT = 60;

// 요청 본문(JSON) 읽기: Vercel은 req.body를 채워 주고, Node 기본 서버는 직접 읽어야 함
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 200000) throw new Error("요청이 너무 커요");
  }
  return JSON.parse(raw || "{}");
}

// 글자 정리(줄바꿈·구분자 제거, 길이 제한)
const clean = (s) => String(s ?? "").replace(/[\r\n|]/g, " ").trim().slice(0, MAX_TEXT);

// AI 답변에서 JSON 부분만 꺼내기(```json ... ``` 형태도 처리)
function parseJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI 답변을 읽지 못했어요");
  return JSON.parse(text.slice(start, end + 1));
}

module.exports = async function handler(req, res) {
  const send = (status, obj) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(obj));
  };

  if (req.method !== "POST") return send(405, { error: "POST로 요청해 주세요." });
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return send(500, { error: "서버에 OPENROUTER_API_KEY 환경변수가 설정되지 않았어요." });

  // 입력값 확인
  let body;
  try { body = await readBody(req); } catch { return send(400, { error: "요청 형식이 올바르지 않아요." }); }
  const univ = clean(body.univ);
  const major = clean(body.major);
  const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, MAX_CANDIDATES) : [];
  if (!univ || !major || candidates.length === 0) return send(400, { error: "대학·학과·후보 목록이 필요해요." });

  // 후보 목록을 "번호|대학|학과" 줄로 만들기
  const lines = candidates.map((c, i) => `${i}|${clean(c?.univ)}|${clean(c?.major)}`).join("\n");

  const prompt = `사용자는 "${univ}" "${major}"에 재학 중입니다. 이 대학·학과는 아래 목록에 없습니다.
아래 '국가기술자격 대학별 학과' 목록에서 사용자의 학과와 커리큘럼(전공 과목)과 졸업 후 진로가 가장 비슷한 대학·학과를 정확히 ${PICK_COUNT}개 고르세요.
- 학과의 전공 분야가 비슷한 것을 가장 우선하고, 비슷하다면 서로 다른 대학을 고르세요.
- 반드시 목록에 있는 번호만 사용하세요.
- 이유는 한국어 한 문장(40자 이내)으로 쓰세요.
- 다른 말 없이 아래 JSON 형식으로만 답하세요.
{"picks":[{"index":번호,"reason":"이유"}]}

목록(번호|대학|학과):
${lines}`;

  try {
    const apiRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: "당신은 한국 대학 학과의 교육과정과 진로를 잘 아는 진학 상담가입니다. 요청한 JSON만 출력합니다." },
          { role: "user", content: prompt },
        ],
      }),
    });
    const data = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) return send(502, { error: `AI 호출 실패: ${data?.error?.message || apiRes.status}` });

    // AI 답변에서 올바른 번호만 골라 중복 없이 최대 4개
    const parsed = parseJson(data?.choices?.[0]?.message?.content || "");
    const seen = new Set();
    const picks = (Array.isArray(parsed.picks) ? parsed.picks : [])
      .map((p) => ({ index: Number(p?.index), reason: clean(p?.reason) }))
      .filter((p) => Number.isInteger(p.index) && p.index >= 0 && p.index < candidates.length && !seen.has(p.index) && seen.add(p.index))
      .slice(0, PICK_COUNT);
    if (picks.length === 0) return send(502, { error: "AI가 비슷한 학과를 고르지 못했어요. 다시 시도해 주세요." });
    send(200, { picks });
  } catch (err) {
    send(502, { error: "AI 연결 실패: " + err.message });
  }
};
