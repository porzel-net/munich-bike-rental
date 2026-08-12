import { describe, expect, it } from "vitest";

import { detectFinancialDocumentMime, safeFinancialDocumentFileName } from "../../lib/financial/documents";

describe("financial document upload validation", () => {
  it("detects supported formats from magic bytes", () => {
    expect(detectFinancialDocumentMime(Buffer.from("%PDF-1.7"))).toBe("application/pdf");
    expect(detectFinancialDocumentMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectFinancialDocumentMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "image/png",
    );
    expect(detectFinancialDocumentMime(Buffer.from("RIFFxxxxWEBP"))).toBe("image/webp");
    expect(detectFinancialDocumentMime(Buffer.from("<script>alert(1)</script>"))).toBeNull();
  });

  it("removes path and control characters from download names", () => {
    expect(safeFinancialDocumentFileName('../../evil"\r\n.html')).toBe("evil-.html");
  });
});
