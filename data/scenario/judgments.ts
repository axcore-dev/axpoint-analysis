import type { Judgment } from "@/lib/types";

/**
 * (주)데모기업 — 27문항 판정 결과 (채점기준서 v0.1 앵커 분류)
 *
 * 실서비스에서는 자동 규칙·LLM·HITL이 산출하는 값. 데모에서는 업로드
 * 문서(documents.ts)·공개 데이터(publicData.ts)·HITL 응답(hitl.ts)과
 * 정합하도록 수작업 설계했다. 판정 원칙:
 * - 점수를 매기지 않고 앵커 서술에 분류한다 (rationale에 앵커 서술 인용)
 * - 중간 판정 불허 — 애매하면 낮은 쪽
 * - 근거 부족은 감점이 아닌 판정 보류(anchor: null)
 *
 * 기대 축 점수 (engine.ts 통과 결과):
 *   ICS 45.0 (5/5) · AOS 37.5 (4/5, 커버리지 80%) · OCS 55.0 (5/5)
 *   TAS 56.25 (4/4) · FRS 81.25 (4/4) · SCS 68.75 (4/4)
 *   종합 57.29 → 57점 → Lv.3 부분 적용
 */
export const judgments: Judgment[] = [
  /* ============ ICS · 인프라·연동 성숙도 — 45.0 ============ */
  {
    questionId: "ICS-01",
    anchor: "A2",
    rationale:
      "생산일지는 수기 스캔(L1), 작업일보는 생산팀장 개인 엑셀(L2)로 이중 기록 — \"개인 엑셀/한글로 기록, 개인 PC 산재\" 상태에 해당.",
    evidence: [
      { kind: "upload", refId: "d01", label: "3월 생산일지", snippet: "종이 양식에 볼펜 수기 작성 후 스캔" },
      { kind: "upload", refId: "d02", label: "작업일보 엑셀", snippet: "개인 PC에서 관리, 월별 시트 복사본 증식" },
    ],
  },
  {
    questionId: "ICS-02",
    anchor: "A1",
    rationale:
      "발주서·재고표·생산일지 간 품목 표기 대조 결과 매칭률 28% — \"문서마다 다른 명칭·코드 혼용(매칭률 30% 미만)\"에 해당. 동일 품목이 'BRK-102'·'브라켓 B-102'·'브라켓(소)'로 3가지 표기.",
    evidence: [
      { kind: "upload", refId: "d03", label: "발주서 묶음", snippet: "'BRK-102', '브라켓 B-102', '브라켓(소)' 혼용" },
      { kind: "upload", refId: "d05", label: "재고현황표", snippet: "품목명이 발주서 표기와 상이" },
      { kind: "upload", refId: "d01", label: "3월 생산일지", snippet: "품목명 표기가 일자별로 상이" },
    ],
  },
  {
    questionId: "ICS-03",
    anchor: "A2",
    rationale:
      "회계 SW(더존)만 사용 중, 생산·재고 시스템 없음 — \"단일 시스템 일부 업무만 사용\"에 해당. 업로드 자료 중 시스템 출력물은 회계전표 1종뿐.",
    evidence: [
      { kind: "hitl", refId: "hitl-1", label: "설문 1: 사용 시스템", snippet: "회계SW(더존)만 사용, 생산·재고는 시스템 없음" },
      { kind: "upload", refId: "d09", label: "회계전표(더존 출력)", snippet: "더존 회계모듈 출력 포맷 확인" },
    ],
  },
  {
    questionId: "ICS-04",
    anchor: "A2",
    rationale:
      "공유폴더(NAS)를 쓰지만 폴더 규칙 없음 — \"공유폴더/NAS 사용하나 규칙 없음\"에 해당. 견적 이력은 개인 PC 폴더에 산재.",
    evidence: [
      { kind: "hitl", refId: "hitl-2", label: "설문 2: 파일 보관 위치", snippet: "공유폴더·NAS" },
      { kind: "upload", refId: "d11", label: "견적서 양식", snippet: "과거 견적 이력은 개인 PC 폴더에 파일명으로만 구분" },
    ],
  },
  {
    questionId: "ICS-05",
    anchor: "A2",
    rationale:
      "설비점검표를 월 1회 종이에 수기 작성(확인 응답), 일부 설비에 센서 있으나 수치 관리로 이어지지 않음 — \"점검표를 정기 수기 작성\"에 해당. A3(엑셀 수치 관리)와 애매하나 낮은 쪽 판정 원칙 적용.",
    evidence: [
      { kind: "upload", refId: "d07", label: "설비점검표", snippet: "월 1회 정기 점검 항목 체크 기록 (수기 작성 확인)" },
      { kind: "hitl", refId: "hitl-3", label: "설문 3: 센서/PLC", snippet: "일부 설비만" },
    ],
  },

  /* ============ AOS · 업무 자동화 기회 — 37.5 (4/5 판정) ============ */
  {
    questionId: "AOS-01",
    anchor: "A1",
    rationale:
      "동일 생산 수량이 ①수기 생산일지 → ②작업일보 엑셀 → ③월 집계표 → ④회계 전표로 4회 재입력됨 — \"같은 값 4회 이상 재입력\"에 해당.",
    evidence: [
      { kind: "upload", refId: "d01", label: "3월 생산일지", snippet: "일자별 품목·수량 수기 기록" },
      { kind: "upload", refId: "d02", label: "작업일보 엑셀", snippet: "생산일지 내용을 매일 저녁 엑셀에 다시 입력" },
      { kind: "upload", refId: "d08", label: "월생산집계", snippet: "작업일보와 동일 수치가 재입력된 흔적" },
      { kind: "upload", refId: "d09", label: "회계전표", snippet: "생산·재고 데이터와의 연동 없이 수기 대사로 이관" },
    ],
  },
  {
    questionId: "AOS-02",
    anchor: "A2",
    rationale:
      "업로드 12건 중 L1~L2 비중 67% (L1 3건 + L2 5건) — A2 기준(70% 이상)에 3%p 못 미치고 A3 기준(L3 이상 50%)에도 미달하는 경계 구간. 중간 판정 불허 원칙에 따라 낮은 쪽(A2) 판정.",
    evidence: [
      { kind: "upload", refId: "d01", label: "디지털화수준 태그 집계", snippet: "L1 3건 · L2 5건 · L3 3건 · L4 1건 (총 12건)" },
    ],
  },
  {
    questionId: "AOS-03",
    anchor: "A2",
    rationale:
      "수기 생산일지를 사무실에서 엑셀 집계표에 재입력(확인 응답) — \"수기 일보를 엑셀에 재입력해 집계\"에 해당. 집계표에 수식 없음(값 직접 입력).",
    evidence: [
      { kind: "upload", refId: "d08", label: "월생산집계", snippet: "월별 생산 합계를 값으로 직접 입력(수식 없음)" },
      { kind: "hitl", refId: "d08", label: "원탭 확인: 집계 방식", snippet: "일보를 보고 사무실에서 다시 입력" },
    ],
  },
  {
    questionId: "AOS-04",
    anchor: "A1",
    rationale:
      "검사성적서·생산일지 모두 불량 수량만 기록하고 사유 없음 — \"불량 수량만 기록(사유 없음)\"에 해당. 서술형 사유조차 없어 A2 미달.",
    evidence: [
      { kind: "upload", refId: "d06", label: "검사성적서", snippet: "합/불 판정과 불량 수량은 있으나 불량 사유·코드 없음" },
      { kind: "upload", refId: "d01", label: "3월 생산일지", snippet: "불량은 수량만 기록되고 사유 없음" },
    ],
  },
  {
    questionId: "AOS-05",
    anchor: null,
    deferReason:
      "발주서가 최근 2개월분(8건)뿐이라 소진 패턴 분석에 필요한 기간(3개월 이상) 미달 — 재고·발주 시점 대조 불가로 판정 보류. 3개월 이상 발주 이력 업로드 시 판정 가능.",
    rationale: "판정 보류 — 감점이 아닌 자료 충분도 하락으로 처리 (REQ-N-02).",
    evidence: [
      { kind: "upload", refId: "d03", label: "발주서 묶음", snippet: "5~6월 2개월분 8건" },
      { kind: "upload", refId: "d05", label: "재고현황표", snippet: "안전재고·발주점 열 없음" },
    ],
  },

  /* ============ OCS · 조직 준비도 — 55.0 ============ */
  {
    questionId: "OCS-01",
    anchor: "A3",
    rationale:
      "대표가 결정하되 관리팀장이 담당자로 지정되어 실무를 받침 — \"결정권자와 담당 부서 지정\"에 해당. 예산 프로세스는 미확인이라 A4 미달.",
    evidence: [
      { kind: "hitl", refId: "hitl-4", label: "설문 4: 의사결정 구조", snippet: "대표+담당자" },
    ],
  },
  {
    questionId: "OCS-02",
    anchor: "A2",
    rationale:
      "관리팀장이 전산 업무 겸임(전담 없음), 고용정보상 IT 직무 채용 이력 0건 — \"타 업무 겸직자 1명\"에 해당.",
    evidence: [
      { kind: "hitl", refId: "hitl-5", label: "설문 5: IT 인력", snippet: "겸직 — 관리팀장이 전산 업무 겸임" },
      { kind: "public", refId: "pub-emp", label: "고용정보", snippet: "IT·전산 직무 채용 이력: 0건" },
    ],
  },
  {
    questionId: "OCS-03",
    anchor: "A2",
    rationale:
      "현장 상황이 단톡방·사진 전송으로 사무실에 전달됨 — \"단톡방·사진 전송\"에 해당.",
    evidence: [
      { kind: "hitl", refId: "hitl-6", label: "설문 6: 현장-사무 전달", snippet: "단톡·사진" },
    ],
  },
  {
    questionId: "OCS-04",
    anchor: "A2",
    rationale:
      "프레스 공정 표준서가 있으나 2019년 이후 갱신 없음(2023년 신규 설비 미반영) — \"주요 공정만 문서화(갱신 안 됨)\"에 해당.",
    evidence: [
      { kind: "upload", refId: "d10", label: "작업표준서", snippet: "최종 수정일 2019-11. 신규 설비(2023 CNC 증설분) 반영 안 됨" },
    ],
  },
  {
    questionId: "OCS-05",
    anchor: "A2",
    rationale:
      "담당자가 주 1일 수준 투입 가능 — \"담당자 주 1일 수준 투입 가능\"에 해당.",
    evidence: [
      { kind: "hitl", refId: "hitl-7", label: "설문 7: 실행 여력", snippet: "주1일" },
    ],
  },

  /* ============ TAS · 기술 수용성 — 56.25 ============ */
  {
    questionId: "TAS-01",
    anchor: "A2",
    rationale:
      "현장이 단톡방 사진 전송을 일상적으로 활용하고 사무직은 엑셀 사용 — \"현장도 사진·메신저 활용\"에 해당. 현장의 공유 엑셀·태블릿 사용 흔적은 없어 A3 미달.",
    evidence: [
      { kind: "hitl", refId: "hitl-6", label: "설문 6: 현장-사무 전달", snippet: "단톡·사진" },
      { kind: "upload", refId: "d02", label: "작업일보 엑셀", snippet: "사무 측 엑셀 활용 확인" },
    ],
  },
  {
    questionId: "TAS-02",
    anchor: "A2",
    rationale:
      "CNC 증설·용접 로봇 등 설비 도입 경험은 있으나 SW(바코드 재고관리)는 6개월 만에 중단 — \"설비 위주 도입(SW 경험 없음)\"에 해당.",
    evidence: [
      { kind: "hitl", refId: "hitl-8", label: "설문 8: 도입 경험", snippet: "장비 위주로 도입해 봤어요 — CNC 2대 증설, 바코드 재고관리 앱은 6개월 만에 중단" },
      { kind: "public", refId: "pub-pps", label: "조달 이력", snippet: "낙찰 2건 (2023, 2025)" },
    ],
  },
  {
    questionId: "TAS-03",
    anchor: "A3",
    rationale:
      "정부 R&D 참여(2024 지역 뿌리기업 공정개선)·자동화 설비 투자 협약(2023)·대표의 디지털 전환 교육 수료(2025)·최근 특허 출원(2025) — \"정부사업 참여·교육 이수 등 능동 신호\"에 해당.",
    evidence: [
      { kind: "public", refId: "pub-rnd", label: "R&D 프로젝트", snippet: "2024 지역 뿌리기업 공정개선 R&D 참여" },
      { kind: "public", refId: "pub-news", label: "뉴스", snippet: "자동화 설비 투자 협약 · 대표 디지털 전환 교육 수료" },
      { kind: "public", refId: "pub-kipo", label: "특허·실용신안", snippet: "최근 3년 출원 1건 (2025)" },
    ],
  },
  {
    questionId: "TAS-04",
    anchor: "A2",
    rationale:
      "자기보고는 '회의적'이나 젊은 직원층은 수용적 — \"일부 젊은 층만 수용적\"에 해당. 리뷰 데이터 5건 미만으로 설문을 필수 근거로 사용.",
    evidence: [
      { kind: "hitl", refId: "hitl-9", label: "설문 9: 직원 수용 분위기", snippet: "회의적 (젊은 직원들은 해보자는 분위기)" },
      { kind: "public", refId: "pub-sns", label: "커뮤니티/SNS", snippet: "언급 3건 (5건 미만) — 보조 근거로만 사용" },
    ],
  },

  /* ============ FRS · 투자 여력·ROI — 81.25 ============ */
  {
    questionId: "FRS-01",
    anchor: "A3",
    rationale:
      "3년 연속 흑자(영업이익 3.2억) — \"흑자 기조 유지\"에 해당. 매출 성장률 +5.1%는 뚜렷한 성장세로 보기 애매하여 낮은 쪽(A3) 판정.",
    evidence: [
      { kind: "public", refId: "pub-dart", label: "재무정보", snippet: "매출 82억(+5.1%) · 영업이익 3.2억 — 3년 연속 흑자" },
    ],
  },
  {
    questionId: "FRS-02",
    anchor: "A4",
    rationale:
      "중소 제조(45인)로 스마트공장 등 주요 사업 대상이며, 금속가공(뿌리산업)·비수도권(광주) 우대 요건 보유 — \"대상 + 우대 요건(뿌리산업·지역 등) 보유\"에 해당.",
    evidence: [
      { kind: "public", refId: "pub-disclosure", label: "전자공시(DART)", snippet: "업종: 금속가공제품 제조업 (C259) — 뿌리산업" },
      { kind: "public", refId: "pub-emp", label: "고용정보", snippet: "피보험자 45명 (중소기업 요건)" },
    ],
  },
  {
    questionId: "FRS-03",
    anchor: "A3",
    rationale:
      "보유 자료 기반 즉시 착수 가능 과제 3건(작업일보 전자화·재고 알림·검사 전자화) 중 단기 회수형 2~3건 — \"단기 과제 2~3건\"에 해당. 자료가 이미 확보된 A4 요건(3건 이상 + 자료 확보)과 경계이나 낮은 쪽 판정.",
    evidence: [
      { kind: "upload", refId: "d02", label: "작업일보 엑셀", snippet: "전자 일보 전환의 기반 양식 보유" },
      { kind: "upload", refId: "d05", label: "재고현황표", snippet: "재고 알림 자동화의 기초 데이터 보유" },
      { kind: "upload", refId: "d06", label: "검사성적서", snippet: "검사 기록 전자화 대상 확인" },
    ],
  },
  {
    questionId: "FRS-04",
    anchor: "A3",
    rationale:
      "CNC 2대 증설(2023, 약 6억)·용접 로봇(2021) 등 설비 투자 이력 — \"설비 증설·인증 취득 이력\"에 해당. 디지털 투자(바코드)는 중단되어 A4 미달.",
    evidence: [
      { kind: "hitl", refId: "hitl-11", label: "설문 11: 투자 내역", snippet: "CNC 2대 증설(약 6억), 용접 로봇 1대" },
      { kind: "public", refId: "pub-news", label: "뉴스", snippet: "자동화 설비 투자 협약 (2023-11)" },
    ],
  },

  /* ============ SCS · 보안·배포 여건 — 68.75 ============ */
  {
    questionId: "SCS-01",
    anchor: "A3",
    rationale:
      "일반 금속가공 제조(자동차 부품)로 강한 규제 산업 아님 — \"일반 제조(경미한 제약)\"에 해당.",
    evidence: [
      { kind: "public", refId: "pub-disclosure", label: "전자공시(DART)", snippet: "업종: 금속가공제품 제조업 (C259)" },
    ],
  },
  {
    questionId: "SCS-02",
    anchor: "A2",
    rationale:
      "고객사 도면에 '외부 반출 금지' 표기, 설문에서도 반출 금지 확인 — \"일부 고객 도면 반출 금지\"에 해당.",
    evidence: [
      { kind: "upload", refId: "d12", label: "고객사 도면", snippet: "표제란 '외부 반출 금지' 문구 확인" },
      { kind: "hitl", refId: "hitl-12", label: "설문 12: 보안 요구", snippet: "도면 반출금지" },
    ],
  },
  {
    questionId: "SCS-03",
    anchor: "A3",
    rationale:
      "네이버웍스(메일·드라이브)를 업무에 사용 중 — \"일부 업무 클라우드 사용 중\"에 해당. 전사 적극 사용 수준은 아니라 A4 미달.",
    evidence: [
      { kind: "hitl", refId: "hitl-13", label: "설문 13: 클라우드 사용", snippet: "사용 중 — 네이버웍스(메일·드라이브)" },
    ],
  },
  {
    questionId: "SCS-04",
    anchor: "A3",
    rationale:
      "업로드 자료의 개인정보는 작업자·검사자 성명 수준으로 최소(마스킹 처리 완료), 공정 데이터 중심 — \"개인정보 최소 취급\"에 해당.",
    evidence: [
      { kind: "upload", refId: "d01", label: "마스킹 스캔 결과", snippet: "작업자 성명 마스킹 — 개인정보 최소 취급 확인" },
    ],
  },
];
