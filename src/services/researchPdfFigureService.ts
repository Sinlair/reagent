import { mkdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";

interface ExtractPdfImagesRunner {
  (pdfUrl: string, outputDir: string): Promise<string[]>;
}

function defaultRunner(pdfUrl: string, outputDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile(
      "D:/anaconda3/python.exe",
      [path.join(process.cwd(), "scripts", "extract_pdf_images.py"), pdfUrl, outputDir],
      { windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          const payload = JSON.parse(stdout) as { image_paths?: unknown };
          const imagePaths = Array.isArray(payload.image_paths)
            ? payload.image_paths.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : [];
          resolve(imagePaths);
        } catch (parseError) {
          reject(parseError instanceof Error ? parseError : new Error(String(parseError || stderr)));
        }
      }
    );
  });
}

export class ResearchPdfFigureService {
  constructor(
    private readonly workspaceDir: string,
    private readonly runner: ExtractPdfImagesRunner = defaultRunner,
  ) {}

  async extract(pdfUrl: string, key: string): Promise<string[]> {
    const outputDir = path.join(this.workspaceDir, "research", "presentations", "pdf-images", key);
    await mkdir(outputDir, { recursive: true });
    try {
      return await this.runner(pdfUrl, outputDir);
    } catch {
      return [];
    }
  }
}
