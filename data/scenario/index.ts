/**
 * (주)데모기업 시나리오 배럴 — 화면은 이 모듈을 통해 시나리오에 접근한다.
 * 추후 백엔드 확장 시 이 계층을 API 클라이언트로 교체하면 된다.
 */
export { demoCompany, companyStats } from "./company";
export { uploadedDocs, hitlDocs } from "./documents";
export { publicSources } from "./publicData";
export { hitlResponses, getHitlResponse } from "./hitl";
export { judgments } from "./judgments";
export { areaAssessments, areaCoverages } from "./areas";
export { valueChainAnalysis } from "./valueChain";
export { roiAssumptions } from "./roi";
export {
  overallOpinion,
  positionFootnote,
  axisFindings,
  comprehensiveAnalysis,
  strategyType,
} from "./narrative";
