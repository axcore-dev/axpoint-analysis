import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * 클라이언트 PDF 생성 유틸 (F-RPT-02, F-RPT-06)
 *
 * 화면 밖(position:fixed, left:-9999px, width:794px = A4 96dpi 폭)에 렌더된
 * ReportDocument DOM을 html2canvas(scale 2)로 캡처한 뒤, 캔버스를 A4 페이지
 * 높이 단위로 잘라 jsPDF(A4 portrait)에 여러 페이지로 삽입한다.
 *
 * 주의: html2canvas는 oklch 등 최신 CSS 색상 함수를 지원하지 않으므로
 * ReportDocument 내부는 인라인 hex 스타일만 사용한다 (Tailwind 유틸리티 금지).
 */

const CAPTURE_WIDTH = 794; // A4 210mm @ 96dpi
const CAPTURE_SCALE = 2; // 이미지 품질

/** 파일명에 쓸 수 없는 문자 제거 */
function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  return cleaned.length > 0 ? cleaned : "보고서";
}

/**
 * element(폭 794px 가정)를 캡처해 A4 세로 PDF로 저장한다.
 * 저장 파일명: AXpoint_진단보고서_{회사명}.pdf
 */
export async function generateReportPdf(
  element: HTMLElement,
  companyName: string,
): Promise<void> {
  /* 웹폰트(Paperlogy) 로드 완료 후 캡처 — 폰트 미적용 캡처 방지 */
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const canvas = await html2canvas(element, {
    scale: CAPTURE_SCALE,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: CAPTURE_WIDTH,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidthMm = pdf.internal.pageSize.getWidth(); // 210
  const pageHeightMm = pdf.internal.pageSize.getHeight(); // 297

  /* 캔버스 픽셀 기준 한 페이지 높이 (표준 슬라이싱 패턴) */
  const pageHeightPx = Math.floor((canvas.width * pageHeightMm) / pageWidthMm);

  let renderedPx = 0;
  let pageIndex = 0;

  while (renderedPx < canvas.height) {
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);

    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeightPx;
    const ctx = slice.getContext("2d");
    if (!ctx) throw new Error("PDF 슬라이스 캔버스 컨텍스트를 생성할 수 없습니다");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(
      canvas,
      0,
      renderedPx,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx,
    );

    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.92),
      "JPEG",
      0,
      0,
      pageWidthMm,
      (sliceHeightPx * pageWidthMm) / canvas.width,
    );

    renderedPx += sliceHeightPx;
    pageIndex += 1;
  }

  pdf.save(`AXpoint_진단보고서_${sanitizeFileName(companyName)}.pdf`);
}
