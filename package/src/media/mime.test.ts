import { describe, expect, it } from "vitest";

import {
  getExtensionFromContentTypeOrUrl,
  getExtensionFromMime,
  getMimeFromFilename,
} from "./mime.js";

describe("mime helpers", () => {
  it("maps file extensions to MIME types case-insensitively", () => {
    expect(getMimeFromFilename("photo.JPG")).toBe("image/jpeg");
    expect(getMimeFromFilename("archive.unknown")).toBe("application/octet-stream");
  });

  it("maps MIME types to extensions and ignores parameters", () => {
    expect(getExtensionFromMime("image/jpeg")).toBe(".jpg");
    expect(getExtensionFromMime("text/plain; charset=utf-8")).toBe(".txt");
    expect(getExtensionFromMime("application/x-custom")).toBe(".bin");
  });

  it("prefers a known content type and falls back to the URL path", () => {
    expect(getExtensionFromContentTypeOrUrl("video/mp4", "https://example.com/file.bin")).toBe(".mp4");
    expect(getExtensionFromContentTypeOrUrl(null, "https://example.com/assets/report.pdf?sig=123")).toBe(".pdf");
    expect(getExtensionFromContentTypeOrUrl("application/x-custom", "https://example.com/assets/file")).toBe(
      ".bin",
    );
  });
});
