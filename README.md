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

백엔드(`axpoint-analysis-api`, :3001)가 떠 있어야 로그인·진단이 동작한다(`NEXT_PUBLIC_API_URL` 미설정 시 `http://localhost:3001`). 인증은 better-auth 쿠키 세션 — 이메일 인증·Google OAuth·게스트.

## 폴더 구조

```
app/                라우트 (App Router, 전 페이지 클라이언트 컴포넌트)
├── layout.tsx      문서 골격 + 전역 컨텍스트만 (공용 헤더·푸터는 (site) 몫)
├── (landing)/      S0 자료 올리기 — 기업 검색 → 확인 → 모두 업로드(중앙 드롭존, 업로드 시 AI 분류 없음)
│                   전용 레이아웃: 진단 스텝 숨김(StepBar showSteps={false}) + 푸터
├── (site)/         진단 플로우 공용 레이아웃(StepBar + main + SiteFooter)
│   ├── collect/    S1 자료 정리 — 2단계. ① 자료 확인(필수 서류 패널·사용 프로그램 선택·사전 설문 4)
│   │               → '자료가 충분해요/자료 없이 진행' 게이트에서 분류 시작(POST classify)
│   │               ② 자료 분류(분류 진행 로그·자료 편집 칸반 팝업·공개데이터 수집·표준 워크플로우·보완 설문)
│   ├── result/     S2 진단 결과 — 5축 점수, 8업무영역 등급, 표준 워크플로우, 종합 분석
│   │               판정 중 진행률 프로그레스바(%), 데이터 로딩 스켈레톤, 통계 칩(공개데이터 연동),
│   │               강등 사유(달성 조건 미충족)·검토 필요(근거 상충) 표시
│   ├── tasks/      S3 개선 과제 — 과제 카탈로그 탐색·담기
│   ├── roadmap/    S4 로드맵 — 담은 과제 기반 단계별 타임라인
│   ├── report/     S5 보고서 — 요약·ROI 드릴다운, 문의 CTA
│   ├── auth/       로그인(이메일 인증 착지 화면 겸용) / 회원가입
│   └── mypage/     내 정보 / 내 정보 수정
└── admin/          관리자 콘솔 — 대시보드·사용자·진단 이력·외부 연동(API 키 등록·테스트)·환경 관리·
                    멀티 에이전트(agents/ — React Flow 그래프에서 노드별 도구·출력 스키마·지시문 편집,
                    진단 건 파일럿 실행·노드 트레이스. 지시문 전체 목록은 prompts/ — 내비에서는 빠지고
                    agents 화면에서 링크로 진입). role=admin 가드. admin.axcore.io.kr은 proxy.ts가 여기로 리라이트

proxy.ts            admin.* 호스트 → /admin 리라이트 (/auth는 제외 — 로그인 공용)

components/
├── ui/             디자인 시스템 프리미티브 (Button, Card, Modal, Stepper …)
├── admin/          어드민 공용 — SortableTable, 개별 관리 안내 팝업
├── auth/           인증 UI + AuthContext (better-auth 쿠키 세션, role 포함)
├── flow/           진단 플로우 공통 — DiagnosisContext(전역 상태), steps.ts(6단계 SSOT), StepBar
│                   WorkflowStandard(표준 워크플로우 3행 카드 — collect·result 공용 데이터),
│                   ClassifyProgress(분류 진행 텍스트 로그), FileEditBoard(자료 편집 칸반 팝업),
│                   PublicDataSection(공개데이터 수집·SSE), SurveyModal(보완 설문)
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
