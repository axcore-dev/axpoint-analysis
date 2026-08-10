# AXpoint Analysis

중소기업 AX(AI 전환) 진단 플랫폼. 기업 자료를 수집·분석해 5축 채점 기반의 진단 결과와 개선 과제, 로드맵, 보고서를 제공한다.

> 현재 상태: **전 화면 실 API 연동.** 백엔드는 `axpoint-analysis-api`(Hono :3001, 쿠키 세션). `data/`의 시나리오 더미는 더 이상 어떤 화면도 참조하지 않는다(정리 대기 — `docs/로직.md` §5). 더미데이터 데모 버전은 `archive/dummy-data-demo` 브랜치에 보존되어 있다.

## 기술 스택

- **프레임워크**: Next.js 16 (App Router) + React 19 + TypeScript (strict)
- **스타일**: CSS 변수 기반 디자인 토큰(`app/globals.css`) + Tailwind CSS v4
- **서체**: Pretendard Variable woff2 1개 (`@font-face`에 `font-weight: 45 920` 축 범위 선언,
  `layout.tsx`에서 preload). 축 범위를 빼면 브라우저가 굵은 글씨를 합성해 뭉갠다
- **UI**: 자체 프리미티브(`components/ui`) + Radix UI 일부(dialog/tabs/tooltip/collapsible)
- **PDF**: html2canvas + jsPDF (`lib/pdf.ts`)
- **백엔드**: `axpoint-analysis-api` — Hono(:3001) + Drizzle/Postgres + BullMQ/Redis + MinIO, better-auth 쿠키 세션. 설계 문서는 루트 `docs/`(DB 설계.md · 로직.md · 외부 API 명세.md)

## 시작하기

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 프로덕션 빌드
npm run lint    # ESLint
```

백엔드(`axpoint-analysis-api`, :3001)가 떠 있어야 로그인·진단이 동작한다(`NEXT_PUBLIC_API_URL` 미설정 시 `http://localhost:3001`). 인증은 better-auth 쿠키 세션 — 이메일 인증·Google OAuth.

**로그인을 요구하는 지점은 '진단 결과 보기' 한 곳이다** (작업요청 v6-4). 기업을 고르는 순간
`ensureSession()`이 익명 세션을 조용히 발급해 자료 업로드·분류까지 로그인 없이 진행하고,
결과 분석 버튼에서 `LoginModal`을 띄운다. 로그인·가입에 성공하면 서버가 그때까지의 진단을 그 계정으로
옮기므로(`auth.ts` `onLinkAccount`) 흐름이 끊기지 않는다. '체험하기' 버튼은 없앴다.

## 폴더 구조

```
app/                라우트 (App Router, 전 페이지 클라이언트 컴포넌트)
├── layout.tsx      문서 골격 + 전역 컨텍스트만 (공용 헤더·푸터는 (site) 몫)
├── (landing)/      S0 파일 업로드 — 기업 검색 → 확인 → 모두 업로드(중앙 드롭존, 업로드 시 AI 분류 없음)
│                   전용 레이아웃: 진단 스텝 숨김(StepBar showSteps={false}) + 푸터
├── (site)/         진단 플로우 공용 레이아웃(StepBar + main + SiteFooter)
│   ├── collect/    S1 자료 정리 — 2단계. ① 자료 확인(필수 서류 현황 + 부족 자료 우측 패널·사용 프로그램)
│   │               → 진입과 동시에 분류 시작. 사전 설문 스텝은 v5에서 삭제(설문은 판정 후 결과 화면에서)
│   │               ② 자료 분류(분류 진행 로그·자료 편집 칸반 팝업·공개데이터 수집·워크플로우 플로우차트)
│   ├── result/     S2 진단 결과 — 5개 섹션 고정 순서(v8): ① 진단 개요(기업·레벨·통계 칩 + 거시 해설)
│   │               → ② 카테고리 분석(레이더 + 5축 상세 카드, 문항 코드는 사람 말로 치환)
│   │               → ③ 워크플로우 분석(차트 + 업무 흐름 진단 문단) → ④ 업무영역 분석(8영역 카드에
│   │               추천 과제·활용 AI 연결, /tasks 이동 CTA) → ⑤ 종합분석(여정 요약 + 강점·보완·전략).
│   │               우측 sticky TOC(scroll spy + 읽기 진행률, lg 미만 숨김).
│   │               판정 중 진행률 프로그레스바(%), 데이터 로딩 스켈레톤, 통계 칩 캐러셀(양방향 화살표),
│   │               강등 사유(달성 조건 미충족)·검토 필요(근거 상충) 표시,
│   │               결측 문항 보완 설문 — 에이전트 생성 질문을 카드 모달로 1문항씩 자동 진행(v5)
│   ├── tasks/      S3 개선 과제 — 과제 카탈로그 탐색·담기
│   ├── roadmap/    S4 로드맵 — 담은 과제 기반 단계별 타임라인
│   ├── report/     S5 보고서 — 요약·ROI 드릴다운, 문의 CTA
│   ├── auth/       로그인(이메일 인증 착지 화면 겸용) / 회원가입
│   └── mypage/     내 정보 / 내 정보 수정
└── admin/          관리자 콘솔 — 대시보드·사용자(체험 계정 수동 정리 포함)·진단 이력·
                    외부 연동(API 키 등록·테스트)·환경 관리·
                    멀티 에이전트(agents/ — 그래프 탭은 메인 에이전트를 진단 순서(서버 PROMPT_FLOW)대로 잇고,
                    그 메인을 거드는 지시문을 서브로 매단 관계도. 연결선에 관계(전처리·폴백·보조·후처리·
                    파일럿)를 적는다. 노드마다 위=외부 API·아래=도구(에이전트)/읽는 자료(단일 호출)를
                    점선으로 매단다. 편집 가능한 지시문이 전부 노드로 올라간다. 노드를 누르면 팝업에서
                    지시문·모델·버전(v0=코드 기본값)을, 에이전트면 도구·도구 호출 상한·출력 스키마까지
                    편집한다. 실행 로그 탭은 노드 실행·실패를 진단과 무관하게 조회).
                    role=admin 가드. admin.axcore.io.kr은 proxy.ts가 여기로 리라이트
                    ※ 어드민 화면은 전부 좌측 내비에 있다 — 링크로만 들어가는 화면을 두지 않는다.
                      지시문 편집(prompts/)이 그래서 안 보였고 2026-08-07에 agents/로 합쳤다.

proxy.ts            admin.* 호스트 → /admin 리라이트 (/auth는 제외 — 로그인 공용)

components/
├── ui/             디자인 시스템 프리미티브 (Button, Card, Modal, Stepper, PasswordInput …)
├── admin/          어드민 공용 — SortableTable, 개별 관리 안내 팝업,
│                   AgentCanvas(멀티 에이전트 캔버스 — 메인은 진단 순서대로 좌→우, 서브는 메인
│                   왼쪽 통로를 타고 내려가 연결. 에이전트에는 위=외부 API·아래=도구를 매단다),
│                   FieldHelp(라벨 옆 물음표 → 설명·예시 팝업)
├── auth/           인증 UI + AuthContext (better-auth 쿠키 세션, role 포함)
├── flow/           진단 플로우 공통 — DiagnosisContext(전역 상태), steps.ts(6단계 SSOT), StepBar
│                   WorkflowChart(React Flow 플로우차트 — 화살표·업로드 문서 칩·영역/업무 드래그 편집·
│                   에이전트 업무 연결선. WorkflowSection=자료 정리 편집용, 결과 화면은 섹션 카드 안에
│                   직접 삽입. WorkflowStandard는 워크플로우 응답 타입만 남음),
│                   ClassifyProgress(분류 진행 텍스트 로그), FileEditBoard(자료 편집 칸반 팝업),
│                   PublicDataSection(공개데이터 수집·SSE), CoverageSurveyModal(보완 설문 카드 모달 — v5)
└── report/         ReportDocument — PDF용 A4 페이지 DOM (보고서 화면의 실데이터 요약으로 렌더)

data/               구 더미데이터 계층 — 시나리오·카탈로그는 전 화면 미참조(정리 보류 — 루트 docs/로직.md §5)
├── rubric/         구 채점 체계 — 화면은 meta의 DIGITAL_LEVELS(L1~L4 라벨)만 참조
├── scenario/       (주)데모기업 더미 시나리오 — 화면 미참조
├── catalog/        구 과제 카탈로그 — 화면 미참조 (실데이터는 백엔드 시드)
└── glossary.ts     용어사전 (툴팁) — result 화면이 참조

lib/                API 클라이언트 + 순수 계산 로직
├── api.ts          백엔드 호출 공통 (쿠키 세션 credentials 포함)
├── companySearch.ts 기업 검색 자동완성 공용 — 첫 화면·내 정보가 공유
├── types.ts        도메인 타입 SSOT — 백엔드 API 계약의 출발점
├── scoring/        (미참조) 구 프론트 채점 엔진 — 채점은 백엔드가 한다
├── roadmap.ts      (미참조) 구 로드맵 계산 — 화면은 서버 응답 표시
├── roi.ts          (미참조) 구 ROI 계산 — 보고서 ROI는 백엔드 산출
└── pdf.ts          ReportDocument DOM → A4 PDF Blob (브라우저 다운로드 + 메일 첨부 업로드 공용)

public/             로고, fonts/PretendardVariable.woff2 (본문 서체 — 유일한 웹폰트)
docs/               기획·수정요청·참고자료 (로컬 전용) — update/(작업 기록)만 git 추적
```

## 데이터 흐름

```
업로드 → 분류(방법론 C) → 문항 판정(A0~A4) → 채점·서사·추천   (전부 백엔드)
                              │
                              ▼
result / report 화면 ◄── lib/api.ts (쿠키 세션, 진행률 SSE·폴링)
        │
사용자 과제 담기 (서버 저장)
        ├──► roadmap 화면 — 서버 로드맵 응답 표시
        └──► report 화면 — 요약·ROI 드릴다운
                              │
                              ▼
              ReportDocument ──► lib/pdf ──► PDF 다운로드·이메일 발송
```

- 채점·판정·추천은 전부 백엔드(`axpoint-analysis-api`)가 계산한다. 프론트는 표시 전용이며 점수를 재계산하지 않는다.
- 로직 사양은 루트 `docs/로직.md`, 구 프론트 계산기(`lib/scoring` 등)는 미참조 — 정리 보류(같은 문서 §5).

## 협업 규칙

- **저장소**: `https://github.com/axcore-dev/axpoint-analysis` (조직 소유). 커밋은 조직 이메일 계정으로 한다.
- **브랜치**: `main` 보호를 원칙으로, 기능 단위 브랜치 → PR → 머지. (현재 1인 개발이라 main 직접 커밋 허용, 팀원 합류 시 PR 필수로 전환)
- `archive/dummy-data-demo`: 더미데이터 데모 버전 보존 브랜치. 삭제 금지.
- **커밋**: 기능 단위로 쪼개고, 한국어로 무엇을 했는지 명확히 쓴다.
- **문서**: `docs/`는 로컬 전용(미추적)이되 `docs/update/`(작업 기록)만 git으로 추적한다. 그 외 공유할 문서는 별도 채널로 전달하거나 추적 전환을 논의한다.
