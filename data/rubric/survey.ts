import type { SurveyQuestion } from "@/lib/types";

/**
 * 최소 설문지(HITL) — 외부 데이터로 판정 불가한 문항에서 역산한 13문항
 * 원본: docs/참고자료/AXpoint_6축_채점기준서_v0.1.xlsx · 시트 3
 * 자료 정리 단계(S1)의 원탭 확인 질문으로 사용. 응답은 해당 문항 판정에
 * 직결되며 MES/ERP 도입현황 등 진단 데이터 수집을 겸한다. (F-BCK-03)
 */
export const surveyQuestions: SurveyQuestion[] = [
  {
    no: 1,
    questionId: "ICS-03",
    axis: "ICS",
    question: "현재 사용 중인 시스템이 있나요?",
    type: "multi",
    options: ["ERP", "MES", "WMS", "회계SW", "없음"],
  },
  {
    no: 2,
    questionId: "ICS-04",
    axis: "ICS",
    question: "작업 파일은 주로 어디에 보관하시나요?",
    type: "single",
    options: ["개인PC", "공유폴더·NAS", "시스템 내"],
  },
  {
    no: 3,
    questionId: "ICS-05",
    axis: "ICS",
    question: "설비 가동 데이터를 자동으로 수집하는 장치(센서·PLC)가 있나요?",
    type: "single",
    options: ["있다", "일부 설비만", "없다", "모른다"],
  },
  {
    no: 4,
    questionId: "OCS-01",
    axis: "OCS",
    question: "시스템 도입을 결정하는 분은 누구인가요?",
    type: "single",
    options: ["대표 단독", "대표+담당자", "부서 위임"],
  },
  {
    no: 5,
    questionId: "OCS-02",
    axis: "OCS",
    question: "IT·전산 업무를 담당하는 직원이 있나요?",
    type: "single",
    options: ["전담 있음", "겸직", "없음"],
  },
  {
    no: 6,
    questionId: "OCS-03",
    axis: "OCS",
    question: "현장 상황은 사무실에 주로 어떻게 전달되나요?",
    type: "single",
    options: ["구두", "수기 전표", "단톡·사진", "공유문서", "시스템"],
  },
  {
    no: 7,
    questionId: "OCS-05",
    axis: "OCS",
    question: "도입 프로젝트에 직원이 시간을 낼 수 있는 상황인가요?",
    type: "single",
    options: ["전담 배치 가능", "병행 가능", "주1일", "여력 없음"],
  },
  {
    no: 8,
    questionId: "TAS-02",
    axis: "TAS",
    question: "최근 3년 내 새 장비나 프로그램을 도입한 적이 있나요? 결과는 어땠나요?",
    type: "single_text",
    options: ["있다", "없다"],
  },
  {
    no: 9,
    questionId: "TAS-04",
    axis: "TAS",
    question: "새 시스템 도입 시 직원들 반응은 어떨 것 같나요?",
    type: "single",
    options: ["적극적", "수용적", "회의적", "거부감"],
  },
  {
    no: 10,
    questionId: "FRS-01",
    axis: "FRS",
    question: "연 매출 규모가 어느 구간인가요?",
    type: "single",
    options: ["10억 미만", "10~50억", "50~120억", "120억 이상"],
    condition: "재무 데이터 미확인 시에만 노출",
  },
  {
    no: 11,
    questionId: "FRS-04",
    axis: "FRS",
    question: "최근 3년 내 설비나 시스템에 투자하신 내역이 있나요?",
    type: "single_text",
    options: ["있다", "없다"],
  },
  {
    no: 12,
    questionId: "SCS-02",
    axis: "SCS",
    question: "고객사에서 도면·데이터 보안을 요구받고 있나요?",
    type: "single",
    options: ["엄격(망분리 등)", "도면 반출금지", "일반 NDA", "없음"],
  },
  {
    no: 13,
    questionId: "SCS-03",
    axis: "SCS",
    question: "구글드라이브·네이버웍스 같은 클라우드 서비스를 쓰고 계신가요?",
    type: "single",
    options: ["사용 중", "검토 가능", "불가(사유)"],
  },
];
