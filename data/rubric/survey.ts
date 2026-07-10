import type { SurveyQuestion } from "@/lib/types";

/**
 * 최소 설문지 — 외부 데이터로 판정 불가한 문항에서 역산한 13문항 (v2)
 * 원본: docs/참고자료/AXpoint_6축_채점기준서_v0.1.xlsx · 시트 3
 * 자료 정리 단계(S1)의 확인 질문으로 사용. 응답은 해당 문항 판정에
 * 직결되며 MES/ERP 도입현황 등 진단 데이터 수집을 겸한다. (F-BCK-03)
 *
 * v2 설문 규칙 (2026-07-09 수정요청v1):
 * - 모든 문항 skippable — 스킵 시 해당 문항은 판정 보류(감점 아님).
 *   스킵 안내 문구는 화면 몫.
 * - 선지는 채점 앵커(A0~A4)와 매핑 가능한 범위에서만 설계·변경한다.
 */
export const surveyQuestions: SurveyQuestion[] = [
  // 설계 근거: 보유 시스템 전수 파악 — 복수 선택 + 기타 직접 입력으로 실제 구성 누락 방지
  {
    no: 1,
    questionId: "ICS-03",
    axis: "ICS",
    question: "현재 사용 중인 시스템이 있나요?",
    type: "multi",
    options: ["ERP", "MES", "WMS", "회계SW", "없음"],
    allowOther: true,
    skippable: true,
  },
  // 설계 근거: 보관 위치는 현실적으로 병존(개인PC+NAS 등) — 복수 선택으로 실태 그대로 수집
  {
    no: 2,
    questionId: "ICS-04",
    axis: "ICS",
    question: "작업 파일은 어디에 보관하시나요? (모두 골라 주세요)",
    type: "multi",
    options: ["개인PC", "공유폴더·NAS", "시스템 내"],
    skippable: true,
  },
  // 설계 근거: 전무~전부 전 범위 커버 + "모른다"로 불확실 응답을 오판정 대신 보류로 유도
  {
    no: 3,
    questionId: "ICS-05",
    axis: "ICS",
    question: "설비 가동 데이터를 자동으로 수집하는 장치(센서·PLC)가 있나요?",
    type: "single",
    options: ["있다", "일부 설비만", "없다", "모른다"],
    skippable: true,
  },
  // 설계 근거: 의사결정 집중도 3단계 — 상호배타적이며 앵커(단독~위임)와 1:1 매핑
  {
    no: 4,
    questionId: "OCS-01",
    axis: "OCS",
    question: "시스템 도입을 결정하는 분은 누구인가요?",
    type: "single",
    options: ["대표 단독", "대표+담당자", "부서 위임"],
    skippable: true,
  },
  // 설계 근거: 전담/겸직/없음 3단계 — 전 범위 커버, 중간 상태(겸직)를 명시해 과대응답 방지
  {
    no: 5,
    questionId: "OCS-02",
    axis: "OCS",
    question: "IT·전산 업무를 담당하는 직원이 있나요?",
    type: "single",
    options: ["전담 있음", "겸직", "없음"],
    skippable: true,
  },
  // 설계 근거: 전달 수단을 디지털화 단계 순으로 나열 — 구두(L1)~시스템(L4) 앵커 매핑
  {
    no: 6,
    questionId: "OCS-03",
    axis: "OCS",
    question: "현장 상황은 사무실에 주로 어떻게 전달되나요?",
    type: "single",
    options: ["구두", "수기 전표", "단톡·사진", "공유문서", "시스템"],
    skippable: true,
  },
  // 설계 근거: 투입 가능 시간을 구체 단위(전담/병행/주1일/없음)로 물어 희망 응답 편향 완화
  {
    no: 7,
    questionId: "OCS-05",
    axis: "OCS",
    question: "AX 프로젝트에 직원이 시간을 낼 수 있는 상황인가요?",
    type: "single",
    options: ["전담 배치 가능", "병행 가능", "주1일", "여력 없음"],
    skippable: true,
  },
  // 설계 근거: "있다/없다" 대신 상태 서술형 4지선다 — 도입 결과까지 한 번에 수집, 앵커(A0 없음~A4 정착) 균형 매핑
  {
    no: 8,
    questionId: "TAS-02",
    axis: "TAS",
    question: "최근 3년 내 새 장비나 프로그램을 도입한 적이 있나요? 결과는 어땠나요?",
    type: "single",
    options: [
      "도입해서 잘 쓰고 있어요",
      "도입했지만 지금은 안 써요",
      "장비 위주로 도입해 봤어요",
      "도입한 적 없어요",
    ],
    allowOther: true,
    skippable: true,
  },
  // 설계 근거: 수용도 4단계(적극~거부) 균형 선지 — 중립 없이 방향을 드러내되 자유 서술로 보완
  {
    no: 9,
    questionId: "TAS-04",
    axis: "TAS",
    question: "새 시스템 도입 시 직원들 반응은 어떨 것 같나요?",
    type: "single",
    options: ["적극적", "수용적", "회의적", "거부감"],
    skippable: true,
  },
  // 설계 근거: 매출 구간 4밴드 — 공개 재무 확인 시 미노출(조건부)로 중복 질문 방지
  {
    no: 10,
    questionId: "FRS-01",
    axis: "FRS",
    question: "연 매출 규모가 어느 구간인가요?",
    type: "single",
    options: ["10억 미만", "10~50억", "50~120억", "120억 이상"],
    condition: "재무 데이터 미확인 시에만 노출",
    skippable: true,
  },
  // 설계 근거: 유/무 판별 + 자유 서술로 투자 규모·내역 수집 — 서술이 앵커 세부 판정 근거
  {
    no: 11,
    questionId: "FRS-04",
    axis: "FRS",
    question: "최근 3년 내 설비나 시스템에 투자하신 내역이 있나요?",
    type: "single_text",
    options: ["있다", "없다"],
    skippable: true,
  },
  // 설계 근거: 보안 요구 강도 4단계(엄격~없음) — 상호배타, 강한 쪽부터 나열해 과소응답 방지
  {
    no: 12,
    questionId: "SCS-02",
    axis: "SCS",
    question: "고객사에서 도면·데이터 보안을 요구받고 있나요?",
    type: "single",
    options: ["엄격(망분리 등)", "도면 반출금지", "일반 NDA", "없음"],
    skippable: true,
  },
  // 설계 근거: 사용/검토/불가 3단계 — "불가" 선택 시 사유 입력을 받아 배포 방식 설계에 반영
  {
    no: 13,
    questionId: "SCS-03",
    axis: "SCS",
    question: "구글드라이브·네이버웍스 같은 클라우드 서비스를 쓰고 계신가요?",
    type: "single",
    options: ["사용 중", "검토 가능", "불가"],
    reasonOn: ["불가"],
    skippable: true,
  },
];
