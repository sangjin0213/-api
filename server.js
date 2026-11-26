// 로컬 테스트용 서버: 웹 파일을 보여주고, q-net API 요청은 api/qnet.js(배포용과 같은 코드)로 전달
// 실행 방법: 터미널에서 `node server.js` → 브라우저에서 http://localhost:8080 열기
// Vercel에 배포할 때는 이 파일을 쓰지 않음(.vercelignore에 등록)

// Node.js 기본 모듈 불러오기(별도 설치 필요 없음)
const http = require("http");
const fs = require("fs");
const path = require("path");

// .env.local 파일의 "이름=값" 줄을 읽어 환경변수로 등록(주석·빈 줄은 건너뜀)
const envFile = path.join(__dirname, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
  }
}

// 인증키가 없으면 실행 방법을 알려주고 종료
if (!process.env.SERVICE_KEY) {
  console.error(".env.local 파일에 SERVICE_KEY=인증키 를 넣어 주세요.");
  process.exit(1);
}

// 배포 환경과 같은 q-net 중계 함수 불러오기
const qnet = require("./api/qnet");
// 전국 대학 목록 중계 함수와 AI 학과 연결 함수
const univ = require("./api/univ");
const ai = require("./api/ai");
// 자격증 좋아요/싫어요 함수(Supabase 저장)
const vote = require("./api/vote");

// 서버 포트 번호(환경변수 PORT가 있으면 그 값 사용)
const PORT = process.env.PORT || 8080;

// 브라우저에 보여줄 파일과 응답 형식(이 3개 외에는 보여주지 않음)
const FILES = { "index.html": "text/html; charset=utf-8", "style.css": "text/css; charset=utf-8", "script.js": "text/javascript; charset=utf-8" };

// 요청이 올 때마다 실행되는 함수
http.createServer((req, res) => {
  // /qnet/... 으로 오면 중계 함수에 맡기기
  if (req.url.startsWith("/qnet/")) return qnet(req, res);
  // /api/univ → 전국 대학 목록, /api/ai → AI 비슷한 학과 추천
  if (req.url.split("?")[0] === "/api/univ") return univ(req, res);
  if (req.url.split("?")[0] === "/api/ai") return ai(req, res);
  // /api/vote → 자격증 좋아요/싫어요
  if (req.url.split("?")[0] === "/api/vote") return vote(req, res);

  // 그 외 요청은 같은 폴더의 파일(index.html, style.css, script.js)을 보여주기
  const urlPath = req.url.split("?")[0];
  const name = urlPath === "/" ? "index.html" : urlPath.slice(1);
  // 허용한 3개 파일만 보여주기(server.js 등 다른 파일 노출 방지)
  const type = FILES[name];
  const file = path.join(__dirname, name);
  if (!type || !fs.existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("파일을 찾을 수 없어요");
    return;
  }
  // 파일 내용을 읽어 응답
  res.writeHead(200, { "Content-Type": type });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`기술자격증 알리미 실행 중 → http://localhost:${PORT}`));
