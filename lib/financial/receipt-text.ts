import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_TEXT_BYTES = 250_000;

/**
 * Uses only local tools. Poppler reads text PDFs; Tesseract is used for image
 * receipts. Missing tools deliberately produce no text rather than sending a
 * financial document to a third party.
 */
export async function recognizeFinancialDocumentText(bytes: Uint8Array, mimeType: string) {
  const suffix = mimeType === "application/pdf" ? ".pdf" : mimeType === "image/png" ? ".png" : ".img";
  const directory = await mkdtemp(join(tmpdir(), "mbr-receipt-"));
  const filePath = join(directory, `receipt${suffix}`);
  try {
    await writeFile(filePath, bytes, { mode: 0o600 });
    const command = mimeType === "application/pdf" ? "pdftotext" : "tesseract";
    const args = mimeType === "application/pdf" ? ["-layout", filePath, "-"] : [filePath, "stdout", "-l", "deu+eng"];
    const { stdout } = await execFileAsync(command, args, {
      timeout: 20_000,
      maxBuffer: MAX_TEXT_BYTES,
      windowsHide: true,
    });
    return stdout.slice(0, MAX_TEXT_BYTES).replace(/\0/g, " ");
  } catch {
    return "";
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
