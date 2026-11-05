// ===== 설정값 (인증키는 .env.local에 두고 server.js가 붙여서 요청함) =====
const CONFIG = {
  // q-net API는 브라우저 직접 호출(CORS)이 막혀 있어 server.js의 중계 주소(/qnet)를 사용
  API_BASE: "/qnet",
  // ① 국가기술자격 대학별 학과 정보
  MAJOR_PATH: "/InquiryUnivUdeptSVC/getList",
  // ② 종목별 시험정보 - 종목별 시험일정
  EXAM_PATH: "/InquiryTestInformationNTQSVC/getJMList",
  // ② 종목별 시험정보 - 응시 수수료
  FEE_PATH: "/InquiryTestInformationNTQSVC/getFeeList",
  // ③ 연도별 회별 합격률
  PASS_PATH: "/InquiryQualPassRateSVC/getList",
  // 한 번에 받아올 개수(학과 692개, 기능사 합격률 약 1500행이라 넉넉히)
  NUM_OF_ROWS: 2000,
  // 학생이 바로 응시할 수 있는 등급 코드: 30 기사, 31 산업기사, 40 기능사
  GRADES: [
    { code: "30", name: "기사" },
    { code: "31", name: "산업기사" },
    { code: "40", name: "기능사" },
  ],
};

// ===== 학과 → 자격증 연결표 =====
// 학과 API에는 자격증 정보가 없어서, 학과명에 들어간 단어로 관련 종목명을 찾음
// major: 학과명에 이 단어가 있으면 / certs: 종목명에 이 단어가 들어간 자격증을 추천
const RULES = [
  { major: ["컴퓨터", "소프트웨어", "전산", "프로그래밍", "인터넷", "웹", "모바일", "사이버", "정보처리", "정보기술", "정보과학", "정보공학"], certs: ["정보처리", "전자계산기", "사무자동화", "프로그래밍", "정보기기", "웹디자인", "임베디드", "로봇소프트웨어"] },
  { major: ["정보통신", "통신", "정보전자", "전자정보"], certs: ["정보처리", "정보기기", "전자기사", "전자산업기사", "전자기능사", "임베디드"] },
  { major: ["전자"], certs: ["전자기사", "전자산업기사", "전자기능사", "반도체", "표면실장", "전자캐드", "전자부품", "임베디드", "의료전자"] },
  { major: ["전기"], certs: ["전기기사", "전기산업기사", "전기기능사", "전기공사", "전기철도", "신재생에너지", "승강기", "소방설비기사(전기", "소방설비산업기사(전기"] },
  { major: ["제어", "자동화", "메카트로닉스", "로봇"], certs: ["자동화설비", "로봇", "전자계산기제어", "설비보전", "생산자동화"] },
  { major: ["기계", "동력"], certs: ["일반기계", "기계설계", "기계가공", "기계조립", "컴퓨터응용", "정밀측정", "설비보전", "공조냉동", "전산응용기계제도"] },
  { major: ["철도"], certs: ["철도"] },
  { major: ["건축", "실내", "인테리어", "공간", "리모델링", "건설공간"], certs: ["건축기사", "건축산업기사", "실내건축", "건축설비", "전산응용건축제도", "건축일반시공", "건축목공", "도배", "타일"] },
  { major: ["건설", "토목"], certs: ["토목", "건설재료", "건설안전", "측량", "콘크리트", "전산응용토목제도"] },
  { major: ["조경"], certs: ["조경", "화훼장식"] },
  { major: ["소방", "방재"], certs: ["소방설비", "화재감식", "위험물", "방재"] },
  { major: ["환경"], certs: ["대기환경", "수질환경", "폐기물", "소음진동", "온실가스", "환경기능사", "토양환경"] },
  { major: ["보건"], certs: ["산업위생관리", "산업안전"] },
  { major: ["디자인", "시각", "광고", "디스플레이", "코디네이션"], certs: ["시각디자인", "컬러리스트", "제품디자인", "컴퓨터그래픽", "웹디자인", "제품응용모델링"] },
  { major: ["애니메이션", "애니매이션", "만화", "멀티미디어", "컨텐츠", "콘텐츠", "게임", "디지털아트"], certs: ["컴퓨터그래픽", "웹디자인", "전자출판", "시각디자인"] },
  { major: ["사진", "영상", "방송", "영화", "촬영", "미디어", "음향"], certs: ["사진기능사", "컴퓨터그래픽", "전자출판", "웹디자인"] },
  { major: ["식품", "영양", "외식"], certs: ["식품", "조리", "제과", "제빵"] },
  { major: ["바이오", "생명", "한약"], certs: ["바이오화학", "식품기사", "식품산업기사", "화학분석"] },
  { major: ["화장품"], certs: ["화학분석", "미용사"] },
  { major: ["의료공학", "의료보장구"], certs: ["의공", "의료전자"] },
  { major: ["해양"], certs: ["해양", "항로표지", "수산", "잠수"] },
  { major: ["안경광학"], certs: ["광학"] },
  { major: ["사무", "의무행정", "의료정보", "병원전산"], certs: ["사무자동화", "정보처리"] },
];

// 국가기술자격이 아닌 '면허 시험' 대상 학과(안내 문구용)
const LICENSE_MAJORS = ["간호", "치위생", "물리치료", "작업치료", "방사선", "임상병리", "응급구조", "치기공"];

// 등급 정렬 순서
const GRADE_ORDER = { 기사: 1, 산업기사: 2, 기능사: 3 };

// ===== 화면 요소 가져오기 =====
const $form = document.getElementById("searchForm");          // 검색 폼
const $input = document.getElementById("majorInput");         // 학과 입력창
const $btn = $form.querySelector("button");                   // 검색 버튼
const $suggest = document.getElementById("majorSuggest");     // 자동완성 목록
const $status = document.getElementById("status");            // 상태 메시지
const $majorList = document.getElementById("majorList");      // 학과 선택 목록
const $resultTitle = document.getElementById("resultTitle");  // 결과 제목
const $resultNote = document.getElementById("resultNote");    // 결과 안내 문구
const $grid = document.getElementById("cardGrid");            // 카드 그리드
const $modal = document.getElementById("modal");              // 모달
const $modalTitle = document.getElementById("modalTitle");    // 모달 제목
const $modalBody = document.getElementById("modalBody");      // 모달 내용

// ===== 불러온 데이터 저장소(한 번 받으면 다시 요청하지 않음) =====
let majorRows = null;      // 학과 목록(대학별)
let certMap = null;        // 종목코드 → 자격증 정보
let passYear = "";         // 합격률 기준연도

// ===== 공통 도우미 함수 =====

// 사용자 입력·API 값이 HTML로 해석되지 않도록 특수문자 바꾸기
function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// 상태 메시지 표시(오류면 빨간색)
function setStatus(msg, isError = false) {
  $status.textContent = msg;
  $status.classList.toggle("is-error", isError);
}

// "20260112" 형태 날짜를 "2026.01.12"로 바꾸기
function fmtDate(d) {
  return d && d.length === 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}` : "-";
}

// 시작일~종료일을 한 칸에 표시
function fmtRange(a, b) {
  if (!a) return "-";
  return !b || a === b ? fmtDate(a) : `${fmtDate(a)} ~ ${fmtDate(b)}`;
}

// 학과명 뒤의 괄호 설명을 지워 짧게 보여주기 (예: 간호(학)(과ㆍ전공) → 간호)
function shortName(name) {
  return name.replace(/\(.*?\)/g, "").trim() || name;
}

// API 호출 후 XML 응답을 { items, totalCount }로 바꾸기
async function callApi(apiPath, params = {}) {
  const url = new URL(CONFIG.API_BASE + apiPath, location.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  // 중계 서버가 보낸 오류 문구가 있으면 그대로 보여주기(예: 인증키 미설정)
  if (!res.ok) throw new Error((await res.text()).slice(0, 200) || `서버 응답 오류 (${res.status})`);
  const xml = new DOMParser().parseFromString(await res.text(), "text/xml");
  // 결과코드가 00(정상)이 아니면 오류
  const code = xml.querySelector("resultCode")?.textContent;
  if (code && code !== "00") throw new Error(xml.querySelector("resultMsg")?.textContent || `API 오류 (${code})`);
  // 인증키 오류 등 공공데이터포털 공통 오류
  const authErr = xml.querySelector("returnAuthMsg")?.textContent;
  if (authErr) throw new Error(`인증 오류: ${authErr}`);
  // <item> 하나하나를 { 태그명: 값 } 객체로 변환
  const items = [...xml.getElementsByTagName("item")].map((node) => {
    const obj = {};
    for (const child of node.children) obj[child.tagName] = child.textContent.trim();
    return obj;
  });
  return { items, totalCount: Number(xml.querySelector("totalCount")?.textContent ?? items.length) };
}

// 여러 페이지에 걸친 목록을 모두 받아오기
async function callApiAll(apiPath, params = {}) {
  const all = [];
  for (let page = 1; ; page++) {
    const { items, totalCount } = await callApi(apiPath, { ...params, numOfRows: CONFIG.NUM_OF_ROWS, pageNo: page });
    all.push(...items);
    // 다 받았거나 더 받을 게 없으면 멈추기
    if (items.length === 0 || all.length >= totalCount) return all;
  }
}

// ===== 데이터 불러오기 =====

// 학과 목록 불러오기(처음 한 번만)
async function loadMajors() {
  if (!majorRows) majorRows = await callApiAll(CONFIG.MAJOR_PATH);
  return majorRows;
}

// 합격률 API로 기사·산업기사·기능사 종목 목록과 연간 합격률 만들기(처음 한 번만)
async function loadCerts() {
  if (certMap) return certMap;
  // 작년 자료부터 찾고, 없으면 그 전 해 자료 사용
  const thisYear = new Date().getFullYear();
  for (const year of [thisYear - 1, thisYear - 2]) {
    const lists = await Promise.all(CONFIG.GRADES.map((g) => callApiAll(CONFIG.PASS_PATH, { baseYY: year, grdCd: g.code })));
    const rows = lists.flat();
    if (rows.length === 0) continue;
    passYear = String(year);
    certMap = new Map();
    // 종목코드별로 회차·필기/실기 행을 모아 응시자·합격자 합계 계산
    for (const r of rows) {
      if (!certMap.has(r.jmCd)) certMap.set(r.jmCd, { jmCd: r.jmCd, name: r.jmFldNm, grade: r.grdNm, rows: [], 필기: { recpt: 0, pass: 0 }, 실기: { recpt: 0, pass: 0 } });
      const c = certMap.get(r.jmCd);
      c.rows.push(r);
      const sum = c[r.examTypCcd];
      if (sum) { sum.recpt += Number(r.recptNoCnt) || 0; sum.pass += Number(r.examPassCnt) || 0; }
    }
    return certMap;
  }
  throw new Error("합격률 자료를 찾지 못했어요");
}

// 합계로 합격률(%) 계산
function rate(sum) {
  return sum.recpt ? ((sum.pass / sum.recpt) * 100).toFixed(1) : null;
}

// ===== 1단계: 학과 검색 =====

// 페이지가 열리면 학과 목록을 미리 받아 자동완성 목록 채우기
(async () => {
  try {
    const rows = await loadMajors();
    const names = [...new Set(rows.map((r) => shortName(r.udeptnm)))].sort();
    $suggest.innerHTML = names.map((n) => `<option value="${esc(n)}"></option>`).join("");
    // 주소에 ?q=학과명 이 있으면 바로 검색 (예: index.html?q=전기)
    const q = new URLSearchParams(location.search).get("q");
    if (q) { $input.value = q; $form.requestSubmit(); }
  } catch (err) {
    console.error(err);
    showError(err);
  }
})();

// 검색 폼 제출 시 실행
$form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const keyword = $input.value.trim().replace(/\s/g, "");
  if (!keyword) return;
  // 이전 결과 지우기
  $majorList.innerHTML = "";
  clearResult();
  $btn.disabled = true;
  setStatus("학과 정보를 찾는 중...");
  try {
    const rows = await loadMajors();
    // 학과명별로 개설 대학 모으기
    const groups = new Map();
    for (const r of rows) {
      if (!r.udeptnm.replace(/\s/g, "").includes(keyword)) continue;
      if (!groups.has(r.udeptnm)) groups.set(r.udeptnm, []);
      groups.get(r.udeptnm).push(r.univnm);
    }
    // 찾은 학과가 없을 때
    if (groups.size === 0) {
      setStatus(`'${keyword}'(이)가 들어간 학과를 찾지 못했어요. 더 짧은 단어로 검색해 보세요. (예: 컴퓨터, 전기, 건축)`);
      return;
    }
    setStatus(`${groups.size}개 학과를 찾았어요. 학과를 선택하세요.`);
    renderMajorChips(groups);
  } catch (err) {
    console.error(err);
    showError(err);
  } finally {
    $btn.disabled = false;
  }
});

// 오류 안내 표시
function showError(err) {
  // 파일을 더블클릭해서 열면 중계 서버가 없어 API를 부를 수 없음
  if (location.protocol === "file:") {
    setStatus("터미널에서 'node server.js'를 실행한 뒤 http://localhost:8080 으로 열어 주세요.", true);
    return;
  }
  setStatus(`불러오기 실패: ${err instanceof TypeError ? "서버에 연결하지 못했어요" : err.message}`, true);
}

// 학과 선택 버튼 그리기
function renderMajorChips(groups) {
  for (const [name, univs] of groups) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "major-chip";
    chip.textContent = `${shortName(name)} · ${univs.length}개 대학`;
    chip.title = name;
    // 학과 버튼 클릭 시 해당 학과의 자격증 카드 표시
    chip.onclick = () => {
      $majorList.querySelectorAll(".major-chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      showCertsFor(name, univs);
    };
    $majorList.appendChild(chip);
  }
  // 학과가 하나뿐이면 바로 선택
  if (groups.size === 1) $majorList.querySelector(".major-chip").click();
}

// ===== 2단계: 자격증 카드 표시 =====

// 이전 결과 지우기
function clearResult() {
  $resultTitle.hidden = true;
  $resultNote.hidden = true;
  $grid.innerHTML = "";
}

// 학과명에 맞는 자격증 찾기
function matchCerts(majorName, certs) {
  // 학과명에 들어간 단어로 해당하는 규칙의 종목 키워드 모으기
  const keys = new Set();
  for (const rule of RULES) if (rule.major.some((m) => majorName.includes(m))) rule.certs.forEach((c) => keys.add(c));
  // 종목명에 키워드가 들어간 자격증만 고르기
  return [...certs.values()]
    .filter((c) => [...keys].some((k) => c.name.includes(k)))
    .sort((a, b) => (GRADE_ORDER[a.grade] ?? 9) - (GRADE_ORDER[b.grade] ?? 9) || a.name.localeCompare(b.name, "ko"));
}

// 선택한 학과의 자격증 카드 보여주기
async function showCertsFor(majorName, univs) {
  clearResult();
  setStatus("자격증 정보를 불러오는 중... (처음 한 번은 몇 초 걸려요)");
  try {
    const list = matchCerts(majorName, await loadCerts());
    setStatus("");
    renderCards(majorName, univs, list);
  } catch (err) {
    console.error(err);
    showError(err);
  }
}

// 자격증 카드 목록 그리기
function renderCards(majorName, univs, list) {
  $resultTitle.hidden = false;
  $resultTitle.textContent = `${shortName(majorName)} 관련 기술자격증 ${list.length}개`;
  // 개설 대학과 추천 방식 안내
  $resultNote.hidden = false;
  const univText = univs.length > 5 ? `${univs.slice(0, 5).join(", ")} 외 ${univs.length - 5}곳` : univs.join(", ");
  $resultNote.textContent = `개설 대학: ${univText} · 학과명 키워드로 고른 추천 목록이며, 합격률은 ${passYear}년 기준이에요.`;
  // 관련 자격증이 없을 때 안내
  if (list.length === 0) {
    const isLicense = LICENSE_MAJORS.some((m) => majorName.includes(m));
    $grid.innerHTML = `<p class="note">${
      isLicense
        ? "이 학과는 국가기술자격보다 보건의료 면허 시험(한국보건의료인국가시험원) 대상 학과예요."
        : "연결된 기술자격증을 찾지 못했어요. script.js의 RULES 표에 학과 키워드를 추가해 보세요."
    }</p>`;
    return;
  }
  for (const cert of list) {
    // 카드 키워드 2개: 등급, 최종(실기) 합격률
    const practical = rate(cert.실기);
    const written = rate(cert.필기);
    const passText = practical ? `실기 합격률 ${practical}%` : written ? `필기 합격률 ${written}%` : "합격률 정보 없음";
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.innerHTML = `
      <p class="card__name">${esc(cert.name)}</p>
      <div class="card__tags">
        <span class="tag">${esc(cert.grade)}</span>
        <span class="tag tag--green">${esc(passText)}</span>
      </div>`;
    // 카드 클릭 시 세부정보 열기
    card.onclick = () => openDetail(cert);
    $grid.appendChild(card);
  }
}

// ===== 3단계: 세부정보 모달 =====

// 카드를 눌렀을 때 시험일정·수수료를 불러와 합격률과 함께 표시
async function openDetail(cert) {
  $modalTitle.textContent = cert.name;
  $modalBody.innerHTML = `<p class="note">세부정보를 불러오는 중...</p>`;
  showModal();

  // 시험일정과 수수료를 동시에 요청(하나가 실패해도 나머지는 표시)
  const [exam, fee] = await Promise.allSettled([
    callApi(CONFIG.EXAM_PATH, { jmCd: cert.jmCd }),
    callApi(CONFIG.FEE_PATH, { jmCd: cert.jmCd }),
  ]);
  // 다른 카드를 눌러 모달 내용이 바뀌었으면 그리지 않기
  if ($modalTitle.textContent !== cert.name) return;
  const schedules = exam.status === "fulfilled" ? exam.value.items : [];
  const fees = fee.status === "fulfilled" ? fee.value.items : [];
  const info = schedules[0] || fees[0] || {};

  // 기본 정보 표
  let html = `<h3>기본 정보</h3><div class="table-wrap"><table class="info-table">
    <tr><th>등급</th><td>${esc(cert.grade)}</td></tr>
    <tr><th>직무분야</th><td>${esc([info.obligfldnm, info.mdobligfldnm].filter(Boolean).join(" > ") || "-")}</td></tr>
    <tr><th>종목코드</th><td>${esc(cert.jmCd)}</td></tr>
    ${fees.map((f) => `<tr><th>${esc(f.infogb || "수수료")}</th><td>${esc(formatFee(f.contents))}</td></tr>`).join("")}
  </table></div>`;

  // 시험 일정 표
  html += `<h3>시험 일정</h3>`;
  if (schedules.length) {
    html += `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>회차</th><th>필기 접수</th><th>필기 시험</th><th>필기 발표</th><th>실기 접수</th><th>실기 시험</th><th>최종 발표</th></tr></thead>
      <tbody>${schedules.map((s) => `<tr>
        <td>${esc(s.implplannm || s.description || "-")}</td>
        <td>${fmtRange(s.docregstartdt, s.docregenddt)}</td>
        <td>${fmtRange(s.docexamstartdt || s.docexamdt, s.docexamenddt)}</td>
        <td>${fmtDate(s.docpassdt)}</td>
        <td>${fmtRange(s.pracregstartdt, s.pracregenddt)}</td>
        <td>${fmtRange(s.pracexamstartdt, s.pracexamenddt)}</td>
        <td>${fmtRange(s.pracpassstartdt || s.pracpassdt, s.pracpassenddt)}</td>
      </tr>`).join("")}</tbody></table></div>`;
  } else {
    html += `<p class="note">${exam.status === "rejected" ? "시험일정을 불러오지 못했어요: " + esc(exam.reason.message) : "등록된 시험 일정이 없어요."}</p>`;
  }

  // 합격률 표(회차·필기/실기별)
  html += `<h3>${esc(passYear)}년 회별 합격률</h3>`;
  const passRows = [...cert.rows].sort((a, b) => Number(a.implSeq) - Number(b.implSeq) || a.examTypCcd.localeCompare(b.examTypCcd, "ko"));
  html += `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>회차</th><th>구분</th><th>응시자</th><th>합격자</th><th>합격률</th></tr></thead>
    <tbody>${passRows.map((r) => `<tr>
      <td>${r.implSeq === "0" ? "상시" : esc(r.implSeq) + "회"}</td>
      <td>${esc(r.examTypCcd)}</td>
      <td>${Number(r.recptNoCnt).toLocaleString("ko-KR")}명</td>
      <td>${Number(r.examPassCnt).toLocaleString("ko-KR")}명</td>
      <td>${esc(r.passRate)}</td>
    </tr>`).join("")}</tbody></table></div>`;

  // 모달 내용 교체
  $modalBody.innerHTML = html;
}

// "1차 : 19400, 2차 : 22600" → "필기 19,400원 / 실기 22,600원"
function formatFee(text = "") {
  // 쉼표로 나눈 뒤 차수 이름과 금액 형식을 바꿔 다시 합치기
  return text
    .split(",")
    .map((p) => p.trim().replace(/1차\s*:\s*/, "필기 ").replace(/2차\s*:\s*/, "실기 ").replace(/\d{4,}/, (n) => Number(n).toLocaleString("ko-KR") + "원"))
    .filter(Boolean)
    .join(" / ");
}

// 모달 열기(뒤쪽 페이지 스크롤 막기)
function showModal() {
  $modal.hidden = false;
  document.body.style.overflow = "hidden";
  $modal.querySelector(".modal__close").focus();
}

// 모달 닫기
function hideModal() {
  $modal.hidden = true;
  $modalTitle.textContent = "";
  document.body.style.overflow = "";
}

// 배경이나 × 버튼을 누르면 모달 닫기
$modal.addEventListener("click", (e) => { if (e.target.hasAttribute("data-close")) hideModal(); });

// Esc 키로 모달 닫기
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$modal.hidden) hideModal(); });
