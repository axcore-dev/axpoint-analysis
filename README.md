# AXpoint Analysis

중소기업 AX(AI 전환) 진단 플랫폼. 기업 자료를 수집·분석해 6축 채점 기반의 진단 결과와 개선 과제, 로드맵, 보고서를 제공한다.

> 현재 상태: **프론트엔드 데모 완성 단계.** 모든 데이터는 `data/`의 시나리오 더미로 동작하며, 백엔드는 리뉴얼 설계 진행 중이다. 더미데이터 전체가 담긴 데모 버전은 `archive/dummy-data-demo` 브랜치에 보존되어 있다.

## 기술 스택

- **프레임워크**: Next.js 16 (App Router) + React 19 + TypeScript (strict)
- **스타일**: CSS 변수 기반 디자인 토큰(`app/globals.css`) + Tailwind CSS v4
- **UI**: 자체 프리미티브(`components/ui`) + Radix UI 일부(dialog/tabs/tooltip/collapsible)
- **PDF**: html2canvas + jsPDF (`lib/pdf.ts`)
- **백엔드(예정)**: 구버전은 Contabo 서버 Docker(FastAPI + Celery + Postgres + Redis + MinIO). 리뉴얼 설계는 `docs/작업 지시/`, `docs/DB(new)/` 참고 (docs는 로컬 전용)

## 시작하기

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 프로덕션 빌드
npm run lint    # ESLint
```

별도 환경 변수 없이 실행된다(데모 단계). 로그인은 가짜 인증으로, 어떤 값이든 통과한다.

## 폴더 구조

```
app/                라우트 (App Router, 전 페이지 클라이언트 컴포넌트)
├── page.tsx        S0 자료 올리기 — 기업 검색 → 확인 → 자료 업로드
├── collect/        S1 자료 정리 — 공개 데이터 수집, HITL 확인, 설문, 워크플로우
├── result/         S2 진단 결과 — 6축 점수, 8영역 등급, 종합 분석
├── tasks/          S3 개선 과제 — 과제 카탈로그 탐색·담기
├── roadmap/        S4 로드맵 — 담은 과제 기반 단계별 타임라인
├── report/         S5 보고서 — 요약, PDF 다운로드, 문의 CTA
├── auth/           로그인 / 회원가입
└── mypage/         내 정보 / 내 정보 수정

components/
├── ui/             디자인 시스템 프리미티브 (Button, Card, Modal, Stepper …)
├── auth/           인증 UI + AuthContext (현재 데모용 가짜 인증)
├── flow/           진단 플로우 공통 — DiagnosisContext(전역 상태), steps.ts(6단계 SSOT), StepBar
└── report/         ReportDocument — PDF용 A4 페이지 DOM

data/               ★ 더미데이터 계층 = 백엔드 대체물 (API 연동 시 이 계층을 교체)
├── rubric/         채점 체계 SSOT — 27문항(questions), 앵커 환산·레벨 기준(meta), 설문(survey)
├── scenario/       (주)데모기업 단일 시나리오 — 기업/문서/판정/서사/ROI 등 12개 파일
├── catalog/        개선 과제 22건(tasks), AX 7단계 방법론(method)
└── glossary.ts     용어사전 (툴팁)

lib/                순수 계산 로직 (부수효과 없음 — 서버 이식 가능)
├── types.ts        도메인 타입 SSOT — 백엔드 API 계약의 출발점
├── scoring/        6축 채점 엔진 (앵커 판정 → 축 점수 → 레벨/균형)
├── roadmap.ts      선택 과제 → 의존성 해소 → 단계별 로드맵
├── roi.ts          선택 과제 → 연 효과·회수 기간
└── pdf.ts          ReportDocument DOM → A4 PDF

public/             로고, Paperlogy 폰트
docs/               기획·수정요청·참고자료·작업 로그 (.gitignore — git 미추적, 로컬 전용)
```

## 데이터 흐름

```
data/rubric (채점 기준) + data/scenario/judgments (문항별 앵커 판정)
        │
        ▼
lib/scoring/engine ──► 종합 점수·레벨·6축·강점/병목 ──► result / report 화면
        │
사용자 과제 선택 (DiagnosisContext)
        ├──► lib/roadmap ──► 로드맵
        └──► lib/roi ──► ROI
                │
                ▼
        ReportDocument ──► lib/pdf ──► PDF
```

- 점수는 하드코딩하지 않는다. 항상 `rubric`(기준) × `judgments`(판정) → `engine`(계산) 3층 구조를 거친다.
- 백엔드 연동 시 교체 지점은 세 곳: `data/scenario/index.ts`(배럴 → API 클라이언트), `components/auth/AuthContext.tsx`(가짜 인증 → 실제 세션), `app/mypage/page.tsx`(하드코딩 분석 기록).

## 협업 규칙

- **저장소**: `https://github.com/axcore-dev/axpoint-analysis` (조직 소유). 커밋은 조직 이메일 계정으로 한다.
- **브랜치**: `main` 보호를 원칙으로, 기능 단위 브랜치 → PR → 머지. (현재 1인 개발이라 main 직접 커밋 허용, 팀원 합류 시 PR 필수로 전환)
- `archive/dummy-data-demo`: 더미데이터 데모 버전 보존 브랜치. 삭제 금지.
- **커밋**: 기능 단위로 쪼개고, 한국어로 무엇을 했는지 명확히 쓴다.
- **문서**: `docs/`는 git 미추적(로컬 전용)이므로, 팀원과 공유할 문서는 별도 채널로 전달하거나 추적 전환을 논의한다.
