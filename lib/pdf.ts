import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * 클라이언트 PDF 생성 유틸 (F-RPT-02, F-RPT-06 · 2026-07-09 수정요청v1)
 *
 * 구 방식(긴 캔버스를 A4 높이로 슬라이싱)은 표·행이 페이지 경계에서 잘리는
 * 문제가 있어 폐기. ReportDocument가 페이지 컨테이너 배열(각 794×1123px,
 * `data-report-page` 속성)로 렌더되고, 여기서는 각 페이지 요소를 개별
 * html2canvas 캡처 → jsPDF addPage로 삽입한다. 794×1123은 A4(210×297mm)
 * 비율과 일치하므로 페이지 흐름이 끊어지지 않는다.
 *
 * 주의: html2canvas는 oklch 등 최신 CSS 색상 함수를 지원하지 않으므로
 * ReportDocument 내부는 인라인 hex 스타일만 사용한다 (Tailwind 유틸리티 금지).
 */

const CAPTURE_WIDTH = 794; // A4 210mm @ 96dpi
const CAPTURE_SCALE = 2; // 이미지 품질

/** ReportDocument의 페이지 컨테이너를 식별하는 속성 */
export const REPORT_PAGE_SELECTOR = "[data-report-page]";

/** 파일명에 쓸 수 없는 문자 제거 */
function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  return cleaned.length > 0 ? cleaned : "보고서";
}

/** 다운로드·메일 첨부 공용 파일명 */
export function reportFileName(companyName: string): string {
  return `AXpoint_진단보고서_${sanitizeFileName(companyName)}.pdf`;
}

/**
 * element 내부의 페이지 컨테이너들(각 794×1123px)을 페이지 단위로 캡처해
 * A4 세로 PDF Blob으로 반환한다 — 브라우저 다운로드와 서버 업로드(메일 첨부)에
 * 같은 Blob을 쓴다. 저장은 호출부 책임.
 */
export async function generateReportPdf(element: HTMLElement): Promise<Blob> {
  /* 웹폰트(Pretendard) 로드 완료 후 캡처 — 폰트 미적용 캡처 방지 */
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const pages = Array.from(
    element.querySelectorAll<HTMLElement>(REPORT_PAGE_SELECTOR),
  );
  if (pages.length === 0) {
    throw new Error("보고서 페이지 요소(data-report-page)를 찾을 수 없습니다");
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidthMm = pdf.internal.pageSize.getWidth(); // 210
  const pageHeightMm = pdf.internal.pageSize.getHeight(); // 297

  for (let i = 0; i < pages.length; i += 1) {
    const canvas = await html2canvas(pages[i], {
      scale: CAPTURE_SCALE,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: CAPTURE_WIDTH,
    });

    if (i > 0) pdf.addPage();
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      0,
      0,
      pageWidthMm,
      pageHeightMm,
    );
  }

  return pdf.output("blob");
}
