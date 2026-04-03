import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";

import type { WeeklyPresentationRequest, WeeklyPresentationResult } from "../types/researchArtifacts.js";
import type { ResearchReport, ResearchReportSummary } from "../types/research.js";
import type { ResearchService } from "./researchService.js";
import { ResearchLinkIngestionService } from "./researchLinkIngestionService.js";
import { ResearchPaperAnalysisService } from "./researchPaperAnalysisService.js";

const PRESENTATION_INDEX_FILE = "research/presentations/index.json";

interface PresentationStore {
  updatedAt: string;
  items: WeeklyPresentationResult[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgoIso(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function buildSlideMarkdown(reports: ResearchReport[], title: string): string {
  const lines = [
    `# ${title}`,
    "",
    "## Overview",
    "",
    ...reports.map((report, index) => `${index + 1}. ${report.topic} (${report.generatedAt.slice(0, 10)})`),
    "",
  ];

  for (const report of reports) {
    lines.push(`## ${report.topic}`);
    lines.push("");
    lines.push(`- Summary: ${report.summary}`);
    if (report.findings.length > 0) {
      lines.push(`- Key findings:`);
      for (const finding of report.findings.slice(0, 4)) {
        lines.push(`  - ${finding}`);
      }
    }
    if (report.nextActions.length > 0) {
      lines.push(`- Next actions:`);
      for (const action of report.nextActions.slice(0, 3)) {
        lines.push(`  - ${action}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i]!;
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(date.getFullYear(), 1980);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    time: (hours << 11) | (minutes << 5) | seconds,
    date: ((year - 1980) << 9) | (month << 5) | day,
  };
}

function buildZip(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const now = new Date();
  const dos = dosDateTime(now);

  for (const entry of entries) {
    const fileName = Buffer.from(entry.name.replace(/\\/gu, "/"), "utf8");
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(dos.time, 10);
    localHeader.writeUInt16LE(dos.date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, fileName, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(dos.time, 12);
    centralHeader.writeUInt16LE(dos.date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, fileName);
    offset += localHeader.length + fileName.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function buildContentTypes(slideCount: number, imageEntries: Array<{ ext: string }>): string {
  const imageDefaults = [...new Set(imageEntries.map((entry) => entry.ext.toLowerCase()))]
    .map((ext) => {
      const contentType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
      return `<Default Extension="${ext}" ContentType="${contentType}"/>`;
    })
    .join("");
  const slideOverrides = Array.from({ length: slideCount }, (_, index) =>
    `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${imageDefaults}
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideOverrides}
</Types>`;
}

function buildRootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
}

function buildPresentationXml(slideCount: number): string {
  const slideIds = Array.from({ length: slideCount }, (_, index) =>
    `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>${slideIds}</p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
}

function buildPresentationRels(slideCount: number): string {
  const slideRels = Array.from({ length: slideCount }, (_, index) =>
    `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slideRels}
</Relationships>`;
}

function buildSlideMasterXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld name="Master"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`;
}

function buildSlideMasterRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;
}

function buildSlideLayoutXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="titleAndContent" preserve="1">
  <p:cSld name="Layout"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

function buildSlideLayoutRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
}

function buildThemeXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="ReAgent Theme"><a:themeElements><a:clrScheme name="ReAgent Colors"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F1F1F"/></a:dk2><a:lt2><a:srgbClr val="F7F7F7"/></a:lt2><a:accent1><a:srgbClr val="1F77B4"/></a:accent1><a:accent2><a:srgbClr val="FF7F0E"/></a:accent2><a:accent3><a:srgbClr val="2CA02C"/></a:accent3><a:accent4><a:srgbClr val="D62728"/></a:accent4><a:accent5><a:srgbClr val="9467BD"/></a:accent5><a:accent6><a:srgbClr val="8C564B"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Aptos"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>`;
}

function buildTextBox(id: number, name: string, x: number, y: number, cx: number, cy: number, lines: string[], fontSize = 2000): string {
  const runs = lines
    .map((line) => `<a:p><a:r><a:rPr lang="en-US" sz="${fontSize}"/><a:t>${escapeXml(line)}</a:t></a:r></a:p>`)
    .join("");
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${runs}</p:txBody></p:sp>`;
}

function buildPicture(id: number, relId: string, x: number, y: number, cx: number, cy: number): string {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

function buildSlideXml(title: string, bullets: string[], imageRelId?: string): string {
  const shapes = [
    buildTextBox(2, "Title", 457200, 274320, 8229600, 685800, [title], 2600),
    buildTextBox(3, "Content", 457200, 1219200, 6400800, 4114800, bullets, 1800),
  ];

  if (imageRelId) {
    shapes.push(buildPicture(4, imageRelId, 7315200, 1371600, 3200400, 2743200));
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes.join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function buildSlideRels(imageTarget?: string): string {
  const relationships = [`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`];
  if (imageTarget) {
    relationships.push(`<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${imageTarget}"/>`);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}</Relationships>`;
}

function defaultStore(): PresentationStore {
  return {
    updatedAt: nowIso(),
    items: [],
  };
}

async function writePptx(outputPath: string, manifest: { title: string; subtitle: string; slides: Array<{ title: string; bullets: string[]; imagePath?: string }> }): Promise<void> {
  const entries: Array<{ name: string; data: Buffer }> = [];
  const mediaEntries: Array<{ ext: string; name: string; data: Buffer } | undefined> = [];

  for (const [index, slide] of manifest.slides.entries()) {
    if (!slide.imagePath) {
      continue;
    }
    const imageData = await readFile(slide.imagePath);
    const ext = path.extname(slide.imagePath).replace(/^\./u, "").toLowerCase() || "png";
    mediaEntries[index] = {
      ext,
      name: `image${index + 1}.${ext}`,
      data: imageData,
    };
  }

  const definedMediaEntries = mediaEntries.filter((entry): entry is { ext: string; name: string; data: Buffer } => Boolean(entry));
  const slideCount = manifest.slides.length + 1;
  entries.push({ name: "[Content_Types].xml", data: Buffer.from(buildContentTypes(slideCount, definedMediaEntries), "utf8") });
  entries.push({ name: "_rels/.rels", data: Buffer.from(buildRootRels(), "utf8") });
  entries.push({ name: "ppt/presentation.xml", data: Buffer.from(buildPresentationXml(slideCount), "utf8") });
  entries.push({ name: "ppt/_rels/presentation.xml.rels", data: Buffer.from(buildPresentationRels(slideCount), "utf8") });
  entries.push({ name: "ppt/slideMasters/slideMaster1.xml", data: Buffer.from(buildSlideMasterXml(), "utf8") });
  entries.push({ name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: Buffer.from(buildSlideMasterRels(), "utf8") });
  entries.push({ name: "ppt/slideLayouts/slideLayout1.xml", data: Buffer.from(buildSlideLayoutXml(), "utf8") });
  entries.push({ name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: Buffer.from(buildSlideLayoutRels(), "utf8") });
  entries.push({ name: "ppt/theme/theme1.xml", data: Buffer.from(buildThemeXml(), "utf8") });
  entries.push({ name: "ppt/slides/slide1.xml", data: Buffer.from(buildSlideXml(manifest.title, [manifest.subtitle]), "utf8") });
  entries.push({ name: "ppt/slides/_rels/slide1.xml.rels", data: Buffer.from(buildSlideRels(), "utf8") });

  manifest.slides.forEach((slide, index) => {
    const media = mediaEntries[index];
    entries.push({
      name: `ppt/slides/slide${index + 2}.xml`,
      data: Buffer.from(buildSlideXml(slide.title, slide.bullets, media ? "rId2" : undefined), "utf8"),
    });
    entries.push({
      name: `ppt/slides/_rels/slide${index + 2}.xml.rels`,
      data: Buffer.from(buildSlideRels(media?.name), "utf8"),
    });
  });

  for (const media of definedMediaEntries) {
    entries.push({ name: `ppt/media/${media.name}`, data: media.data });
  }

  await writeFile(outputPath, buildZip(entries));
}

export class ResearchPresentationService {
  private readonly presentationsDir: string;
  private readonly presentationIndexPath: string;
  private readonly assetsDir: string;
  private readonly linkIngestionService: ResearchLinkIngestionService;
  private readonly paperAnalysisService: ResearchPaperAnalysisService;

  constructor(
    private readonly workspaceDir: string,
    private readonly researchService: Pick<ResearchService, "listRecentReports" | "getReport">,
  ) {
    this.presentationsDir = path.join(workspaceDir, "research", "presentations");
    this.presentationIndexPath = path.join(workspaceDir, PRESENTATION_INDEX_FILE);
    this.assetsDir = path.join(this.presentationsDir, "assets");
    this.linkIngestionService = new ResearchLinkIngestionService(workspaceDir);
    this.paperAnalysisService = new ResearchPaperAnalysisService(workspaceDir);
  }

  private async readStore(): Promise<PresentationStore> {
    try {
      const raw = await readFile(this.presentationIndexPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<PresentationStore>;
      return {
        updatedAt: parsed.updatedAt?.trim() || nowIso(),
        items: Array.isArray(parsed.items) ? parsed.items : [],
      };
    } catch {
      return defaultStore();
    }
  }

  private async writeStore(store: PresentationStore): Promise<void> {
    await mkdir(path.dirname(this.presentationIndexPath), { recursive: true });
    await writeFile(
      this.presentationIndexPath,
      `${JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2)}\n`,
      "utf8",
    );
  }

  async listRecent(limit = 20): Promise<WeeklyPresentationResult[]> {
    const store = await this.readStore();
    return store.items.slice(0, Math.max(1, Math.min(limit, 50)));
  }

  async getPresentation(presentationId: string): Promise<WeeklyPresentationResult | null> {
    const id = presentationId.trim();
    if (!id) {
      return null;
    }

    const store = await this.readStore();
    return store.items.find((item) => item.id === id) ?? null;
  }

  private async resolveImagePath(reportTaskId: string, sourceItemId?: string | undefined): Promise<string | undefined> {
    if (!sourceItemId) {
      return undefined;
    }

    const sourceItem = await this.linkIngestionService.getItem(sourceItemId);
    const imageUrl = sourceItem?.imageUrls?.[0];
    if (!imageUrl) {
      return undefined;
    }

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "ReAgent/0.1"
      }
    });
    if (!response.ok) {
      return undefined;
    }

    const contentType = response.headers.get("content-type") ?? "image/png";
    const extension = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
    const bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(this.assetsDir, { recursive: true });
    const filePath = path.join(this.assetsDir, `${reportTaskId}.${extension}`);
    await writeFile(filePath, bytes);
    return filePath;
  }

  async generateWeeklyPresentation(input: WeeklyPresentationRequest = {}): Promise<WeeklyPresentationResult> {
    const days = Math.max(1, Math.min(input.days ?? 7, 30));
    const lowerBound = daysAgoIso(days);
    const topicFilter = input.topic?.trim().toLowerCase();
    const summaries: ResearchReportSummary[] = await this.researchService.listRecentReports(30);
    const selectedSummaries = summaries.filter((summary) => {
      const generatedAtMs = Date.parse(summary.generatedAt);
      if (!Number.isFinite(generatedAtMs) || generatedAtMs < lowerBound) {
        return false;
      }
      if (!topicFilter) {
        return true;
      }
      return `${summary.topic} ${summary.summary}`.toLowerCase().includes(topicFilter);
    });

    const reports = (
      await Promise.all(selectedSummaries.map((summary) => this.researchService.getReport(summary.taskId)))
    ).filter((report): report is ResearchReport => Boolean(report));

    const deepReports = await this.paperAnalysisService.listRecent(50);
    const generatedAt = nowIso();
    const title = topicFilter
      ? `Research Meeting Deck: ${input.topic?.trim()}`
      : `Research Meeting Deck (${generatedAt.slice(0, 10)})`;
    const slideMarkdown = buildSlideMarkdown(reports, title);
    await mkdir(this.presentationsDir, { recursive: true });
    const fileName = `meeting-deck-${generatedAt.slice(0, 10)}-${reports.length}`;
    const markdownPath = path.join(this.presentationsDir, `${fileName}.md`);
    await writeFile(markdownPath, `${slideMarkdown}\n`, "utf8");

    const slides: Array<{ title: string; bullets: string[]; imagePath?: string }> = [];
    for (const report of reports) {
      const deepReport = deepReports.find((item) => item.paper.title === report.topic || item.paper.url === report.papers[0]?.url);
      const imagePath = await this.resolveImagePath(report.taskId, deepReport?.sourceItemId);
      slides.push({
        title: report.topic,
        bullets: [
          `Summary: ${report.summary}`,
          ...report.findings.slice(0, 3).map((finding) => `Finding: ${finding}`),
          ...report.nextActions.slice(0, 2).map((action) => `Next: ${action}`),
          ...(imagePath ? ["Illustration image attached on the right."] : ["No extracted image was available."])
        ],
        ...(imagePath ? { imagePath } : {}),
      });
    }

    const pptxPath = path.join(this.presentationsDir, `${fileName}.pptx`);
    await writePptx(pptxPath, {
      title,
      subtitle: `Generated at ${generatedAt}`,
      slides,
    });

    const result: WeeklyPresentationResult = {
      id: fileName,
      title,
      generatedAt,
      sourceReportTaskIds: reports.map((report) => report.taskId),
      slideMarkdown,
      filePath: markdownPath,
      pptxPath,
      imagePaths: slides.flatMap((slide) => slide.imagePath ? [slide.imagePath] : []),
    };

    const store = await this.readStore();
    await this.writeStore({
      ...store,
      items: [result, ...store.items].slice(0, 50),
    });

    return result;
  }
}
