import type { HitlResponse } from "@/lib/types";

/**
 * HITL 최소 설문 응답 (F-BCK-03) — (주)데모기업 시나리오
 * 응답은 해당 문항 판정에 직결되고(judgments.ts), 시스템 현황 데이터로도
 * 재활용된다 (REQ-F-08 ③). 10번(매출 구간)은 재무 데이터가 확인되어
 * 조건부 미노출 — 응답 없음.
 */
export const hitlResponses: HitlResponse[] = [
  {
    questionNo: 1,
    questionId: "ICS-03",
    answer: "회계SW",
    answerDetail: "더존 회계모듈만 사용, 생산·재고는 시스템 없음",
  },
  { questionNo: 2, questionId: "ICS-04", answer: "공유폴더·NAS" },
  { questionNo: 3, questionId: "ICS-05", answer: "일부 설비만" },
  { questionNo: 4, questionId: "OCS-01", answer: "대표+담당자" },
  { questionNo: 5, questionId: "OCS-02", answer: "겸직", answerDetail: "관리팀장이 전산 업무 겸임" },
  { questionNo: 6, questionId: "OCS-03", answer: "단톡·사진" },
  { questionNo: 7, questionId: "OCS-05", answer: "주1일" },
  {
    questionNo: 8,
    questionId: "TAS-02",
    answer: "장비 위주로 도입해 봤어요",
    answerDetail: "2023년 CNC 2대 증설. 2024년 바코드 재고관리 앱 도입 시도 후 6개월 만에 중단",
  },
  { questionNo: 9, questionId: "TAS-04", answer: "회의적", answerDetail: "젊은 직원들은 해보자는 분위기" },
  /* 10번: 재무 확인됨 → 조건부 미노출 (survey.ts condition 참조) */
  {
    questionNo: 11,
    questionId: "FRS-04",
    answer: "있다",
    answerDetail: "2023년 CNC 2대 증설 (약 6억원), 용접 로봇 1대 (2021)",
  },
  { questionNo: 12, questionId: "SCS-02", answer: "도면 반출금지" },
  { questionNo: 13, questionId: "SCS-03", answer: "사용 중", answerDetail: "네이버웍스(메일·드라이브) 사용" },
];

export function getHitlResponse(questionNo: number): HitlResponse | undefined {
  return hitlResponses.find((r) => r.questionNo === questionNo);
}
