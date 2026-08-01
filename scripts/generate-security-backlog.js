/**
 * DeepMindQ Deferred Security Backlog
 * Lightweight document — no cover, no TOC, just structured backlog
 */

const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, AlignmentType, HeadingLevel, WidthType,
  BorderStyle, ShadingType,
} = require("docx");

const P = { body: "000000", secondary: "506070" };
const T = { headerBg: "2C3E50", headerText: "FFFFFF", innerLine: "CBD5E1", surface: "F1F5F9" };
const c = (hex) => hex.replace("#", "");

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 360 : 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: level === HeadingLevel.HEADING_1 ? 32 : 28, font: { ascii: "Calibri", eastAsia: "SimHei" }, color: c("0F2027") })],
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT, spacing: { line: 312, after: 100 },
    children: [new TextRun({ text, size: 24, font: { ascii: "Calibri" }, color: c(P.body) })],
  });
}

function emptyLine() { return new Paragraph({ spacing: { line: 200 }, children: [] }); }

function headerCell(text, w) {
  return new TableCell({
    width: { size: w, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: c(T.headerBg) },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, size: 21, color: c(T.headerText) })] })],
  });
}

function dataCell(text, w, shade = false) {
  return new TableCell({
    width: { size: w, type: WidthType.PERCENTAGE },
    shading: shade ? { type: ShadingType.CLEAR, fill: c(T.surface) } : undefined,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({ spacing: { line: 280 }, children: [new TextRun({ text, size: 21, color: c(P.body) })] })],
  });
}

function makeTable(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: c(T.innerLine) },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: c(T.innerLine) },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: c(T.innerLine) },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => headerCell(h, widths[i])) }),
      ...rows.map((row, ri) => new TableRow({ cantSplit: true, children: row.map((cell, ci) => dataCell(cell, widths[ci], ri % 2 === 1)) })),
    ],
  });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: { run: { font: { ascii: "Calibri" }, size: 32, bold: true, color: c("0F2027") } },
      heading2: { run: { font: { ascii: "Calibri" }, size: 28, bold: true, color: c("0F2027") } },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "DeepMindQ Deferred Security Backlog", size: 18, italics: true, color: c(P.secondary) })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Page ", size: 18, color: c(P.secondary) }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary) }),
          ],
        })],
      }),
    },
    children: [
      heading("Deferred Security Backlog"),
      body("This document lists security items identified during the DeepMindQ hardening program (Phases 2 through 4) that were explicitly deferred. These items should NOT be implemented unless the stated trigger condition occurs. The current deployment model is single-user, single-tenant, single-instance, which makes these items low-priority or unnecessary."),
      body("Baseline tag: security-baseline-v1  |  Date: August 2026  |  Final score: 8.3/10"),
      emptyLine(),

      heading("1. Dependency: xlsx Package Migration"),
      body("Severity: HIGH  |  Current: SheetJS Community Edition (unfixed Prototype Pollution + ReDoS)"),
      body("The xlsx package has an unfixable HIGH severity Prototype Pollution vulnerability. Malicious .xlsx files uploaded through the import pipeline could trigger prototype pollution in JavaScript objects. However, the current system only allows the authenticated admin to upload files, making self-attack the only viable scenario. This becomes exploitable if external users gain file upload capability."),
      makeTable(
        ["Field", "Detail"],
        [
          ["Trigger", "Multi-user file upload support is added"],
          ["Recommended Action", "Migrate to ExcelJS or xlsx-populate; add file content validation"],
          ["Breaking Change", "Yes — different API surface; import pipeline requires rewrite"],
          ["Effort Estimate", "2-3 days"],
        ],
        [25, 75]
      ),
      emptyLine(),

      heading("2. npm Audit Cleanup"),
      body("Severity: Mixed (1 critical, 15 high, 7 moderate, 2 low)  |  Total: 25 vulnerabilities"),
      body("Four vulnerabilities are immediately fixable via npm audit fix (uuid buffer overflow, @babel/core arbitrary file read, ajv ReDoS). The remaining 21 require breaking changes or have no available fix. The most concerning are the @xenova/transformers CVEs via sharp and onnxruntime-web, which are transitive dependencies with no non-breaking upgrade path."),
      makeTable(
        ["Field", "Detail"],
        [
          ["Trigger", "Any dependency update cycle or production deployment review"],
          ["Recommended Action", "Run npm audit fix for the 4 fixable items; scope @xenova/transformers upgrade separately"],
          ["Breaking Change", "Partial — uuid, babel, ajv are safe; @xenova/transformers is breaking"],
          ["Effort Estimate", "0.5 days (safe fixes); 2-3 days (transformers upgrade)"],
        ],
        [25, 75]
      ),
      emptyLine(),

      heading("3. CSP Hardening"),
      body("Severity: MEDIUM  |  Current: script-src allows unsafe-inline and unsafe-eval"),
      body("The Content Security Policy permits inline scripts and eval(), which negates XSS protection. Refactoring to a nonce-based CSP requires modifying all script loading in the frontend application. The current risk is low because the system is admin-only with no user-generated HTML content."),
      makeTable(
        ["Field", "Detail"],
        [
          ["Trigger", "Multi-user access or user-generated content features are added"],
          ["Recommended Action", "Implement nonce-based CSP; move all inline scripts to external files"],
          ["Breaking Change", "Yes — requires Next.js script loading refactor"],
          ["Effort Estimate", "3-5 days"],
        ],
        [25, 75]
      ),
      emptyLine(),

      heading("4. Redis/Global Rate Limiting"),
      body("Severity: MEDIUM  |  Current: In-memory rate limiting (per-instance)"),
      body("Rate limits are stored in memory within each function instance. In a multi-instance serverless deployment (e.g., multiple Vercel functions), each instance maintains its own counter, effectively multiplying the rate limit by the number of instances. This is adequate for single-instance deployment but becomes a gap under horizontal scaling."),
      makeTable(
        ["Field", "Detail"],
        [
          ["Trigger", "Multi-instance deployment (horizontal scaling, serverless)"],
          ["Recommended Action", "Migrate rate limit store to Redis (Upstash or similar)"],
          ["Breaking Change", "No — external dependency addition only"],
          ["Effort Estimate", "1-2 days"],
        ],
        [25, 75]
      ),
      emptyLine(),

      heading("5. AUTHORIZED_EMAIL Consolidation"),
      body("Severity: LOW  |  Current: Hardcoded in 3 locations"),
      body("The authorized email (shanker001@gmail.com) is duplicated in request-otp/route.ts, verify-otp/route.ts, and lib/otp.ts. If the email changes, all three locations must be updated simultaneously. This is a DRY violation with zero runtime risk for the current single-tenant setup but could cause subtle auth failures during maintenance."),
      makeTable(
        ["Field", "Detail"],
        [
          ["Trigger", "Any auth-touching change or authorized email update"],
          ["Recommended Action", "Consolidate to a single environment variable; reference from one location"],
          ["Breaking Change", "No"],
          ["Effort Estimate", "0.5 days"],
        ],
        [25, 75]
      ),
      emptyLine(),

      heading("6. Dependency Upgrades Requiring Architectural Decisions"),
      body("Several dependencies have major version upgrades available that fix known vulnerabilities but introduce breaking API changes. These should be evaluated individually during feature development cycles, not as standalone security work."),
      makeTable(
        ["Dependency", "Issue", "Upgrade Path", "Breaking"],
        [
          ["@xenova/transformers", "4 CVEs via sharp/onnxruntime-web", "v1.4.2+ (API changes)", "Yes"],
          ["@mdxeditor/editor", "js-yaml vulnerability", "v4.1.1+ (API changes)", "Yes"],
          ["SheetJS (xlsx)", "Prototype Pollution, ReDoS", "ExcelJS replacement", "Yes"],
          ["Next.js", "Routine security patches", "Latest minor/patch", "No (patch)"],
        ],
        [20, 30, 30, 20]
      ),
      emptyLine(),

      heading("7. Review Policy"),
      body("This backlog should be reviewed under the following circumstances: (1) before any production deployment to a new environment, (2) when the system adds multi-user access or external-facing upload endpoints, (3) during quarterly dependency update cycles, and (4) if any security incident is reported. Items should not be implemented speculatively outside of these triggers."),
    ],
  }],
});

const OUTPUT = "/home/z/my-project/download/DeepMindQ-Deferred-Security-Backlog.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUTPUT, buf);
  console.log("Document written to " + OUTPUT);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
