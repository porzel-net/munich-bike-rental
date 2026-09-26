import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { PDFParse } from "pdf-parse";

const execFileAsync = promisify(execFile);
const MAX_TEXT_BYTES = 250_000;
const MAX_PDF_PAGES = 20;

function normalizedText(value: string) {
  return value.slice(0, MAX_TEXT_BYTES).replace(/\0/g, " ");
}

function imageSuffix(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".img";
  }
}

function logExtractionFailure(kind: "PDF" | "image", error: unknown) {
  // Never log document text, file names, senders, or an external tool's raw
  // output. Those values may contain personal or accounting data.
  console.warn(`Local ${kind} receipt text extraction failed`, {
    error: error instanceof Error ? error.name : "unknown",
  });
}

async function extractPdfText(bytes: Uint8Array) {
  let parser: PDFParse | undefined;
  try {
    parser = new PDFParse({ data: bytes });
    // Receipts rarely exceed a few pages. A bounded page count makes a large,
    // attacker-controlled PDF unable to consume unbounded parsing work.
    const result = await parser.getText({ first: MAX_PDF_PAGES });
    return normalizedText(result.text);
  } catch (error) {
    logExtractionFailure("PDF", error);
    return "";
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}

async function extractImageText(bytes: Uint8Array, mimeType: string) {
  const directory = await mkdtemp(join(tmpdir(), "mbr-receipt-"));
  const filePath = join(directory, `receipt${imageSuffix(mimeType)}`);
  try {
    await writeFile(filePath, bytes, { mode: 0o600 });
    const { stdout } = await execFileAsync("tesseract", [filePath, "stdout", "-l", "deu+eng"], {
      timeout: 20_000,
      maxBuffer: MAX_TEXT_BYTES,
      windowsHide: true,
    });
    return normalizedText(stdout);
  } catch (error) {
    logExtractionFailure("image", error);
    return "";
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/**
 * Uses only local tools. A bundled JavaScript parser reads text PDFs;
 * Tesseract is used for image receipts. Documents are never sent to a third
 * party for OCR.
 */
export async function recognizeFinancialDocumentText(bytes: Uint8Array, mimeType: string) {
  return mimeType === "application/pdf" ? extractPdfText(bytes) : extractImageText(bytes, mimeType);
}
