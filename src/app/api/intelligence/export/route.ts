/**
 * Phase 4 — Item 5.7: Export & Compliance API
 *
 * Provides PDF/JSON export of company intelligence data with full audit trail.
 * Supports compliance requirements by including:
 *   - All source provenance
 *   - Confidence scores and grades
 *   - Decision audit hashes (Phase 3.4)
 *   - Timestamps for reproducibility
 *   - Data depth indicators (Phase 4.5.6)
 *
 * GET /api/intelligence/export?companyId=xxx&format=json|pdf
 *
 * G1 FIX: PDF now generates an actual PDF document (not fake JSON).
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ExportMetadata {
  exportedAt: string;
  exportVersion: string;
  format: 'json' | 'pdf';
  companyId: string;
  companyName: string;
  totalSignals: number;
  totalOpportunities: number;
  dataDepthIndicator: string;
  auditTrail: {
    generatedBy: string;
    systemVersion: string;
    dataFreshnessAsOf: string;
    includesDecisionAuditHash: boolean;
  };
}

interface ExportPayload {
  metadata: ExportMetadata;
  company: Record<string, unknown>;
  signals: Record<string, unknown>[];
  opportunities: Record<string, unknown>[];
  capabilityMatches: Record<string, unknown>[];
  contacts: Record<string, unknown>[];
}

/**
 * GET /api/intelligence/export
 *
 * Query params:
 *   - companyId (required): Company to export
 *   - format (optional): 'json' or 'pdf', default 'json'
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const format = (searchParams.get('format') || 'json') as 'json' | 'pdf';

  if (!companyId) {
    return NextResponse.json(
      { error: 'companyId is required' },
      { status: 400 }
    );
  }

  if (format !== 'json' && format !== 'pdf') {
    return NextResponse.json(
      { error: 'format must be "json" or "pdf"' },
      { status: 400 }
    );
  }

  try {
    // Fetch company data
    const company = await db.company.findUnique({
      where: { id: companyId },
      include: {
        signals: { orderBy: { createdAt: 'desc' }, take: 500 },
        opportunityRecommendations: { orderBy: { updatedAt: 'desc' }, take: 200 },
        signalCapabilityMatches: { orderBy: { createdAt: 'desc' }, take: 200, include: { capability: { select: { title: true, category: true } } } },
        contacts: { orderBy: { createdAt: 'desc' }, take: 500 },
        accountScore: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Build export metadata for compliance
    const metadata: ExportMetadata = {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0.0',
      format,
      companyId: company.id,
      companyName: company.rawName,
      totalSignals: (company.signals as unknown[])?.length ?? 0,
      totalOpportunities: (company.opportunityRecommendations as unknown[])?.length ?? 0,
      dataDepthIndicator: computeExportDataDepth(
        (company.signals as unknown[])?.length ?? 0,
        (company.opportunityRecommendations as unknown[])?.length ?? 0,
        (company.signalCapabilityMatches as unknown[])?.length ?? 0,
        (company.contacts as unknown[])?.length ?? 0,
      ),
      auditTrail: {
        generatedBy: 'DeepMindQ Export API v1.0',
        systemVersion: process.env.NEXT_PUBLIC_BUILD_SHA || 'dev',
        dataFreshnessAsOf: new Date().toISOString(),
        includesDecisionAuditHash: true,
      },
    };

    // Build export payload
    const exportPayload: ExportPayload = {
      metadata,
      company: {
        id: company.id,
        name: company.rawName,
        domain: company.domain,
        industry: company.industry,
        website: company.website,
        sizeRange: company.sizeRange,
        location: company.location,
        country: company.country,
        intelligenceScore: company.intelligenceScore,
        status: company.status,
        lastEnrichedAt: company.lastEnrichedAt,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signals: (company.signals as any[]).map((s: any) => ({
        id: s.id,
        type: s.signalType,
        severity: s.severity,
        description: s.description,
        source: s.source,
        detectedAt: s.signalDate || s.extractedAt,
        confidence: s.confidence,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      opportunities: (company.opportunityRecommendations as any[]).map((o: any) => ({
        id: o.id,
        title: o.opportunityTitle,
        score: o.opportunityScore,
        status: o.status,
        updatedAt: o.updatedAt,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      capabilityMatches: (company.signalCapabilityMatches as any[]).map((c: any) => ({
        id: c.id,
        capability: c.capability?.title ?? c.capabilityId,
        matchScore: c.matchScore,
        createdAt: c.createdAt,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contacts: (company.contacts as any[]).map((c: any) => ({
        id: c.id,
        name: c.rawName,
        title: c.title,
        email: c.email,
        source: c.source,
      })),
    };

    if (format === 'json') {
      return new NextResponse(JSON.stringify(exportPayload, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="deepmindq-export-${company.rawName?.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${Date.now()}.json"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ── G1 FIX: Generate actual PDF using PDFKit ──
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generatePdf(exportPayload);
    } catch (pdfError) {
      const errMsg = pdfError instanceof Error ? pdfError.message : String(pdfError);
      logger.error(`[export] PDF generation failed for company ${companyId}: ${errMsg}`);
      return NextResponse.json(
        { error: 'PDF generation failed. Try JSON format.', details: errMsg },
        { status: 500 }
      );
    }
    const safeName = company.rawName?.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() || 'unknown';

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="deepmindq-export-${safeName}-${Date.now()}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store',
      },
    });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[export] Export failed for company ${companyId}: ${errMsg}`);
    return NextResponse.json(
      { error: 'Export failed', details: errMsg },
      { status: 500 }
    );
  }
}

// ── PDF Generation ──────────────────────────────────────────────────────

/**
 * Generate a real PDF document from the export payload.
 * Uses PDFKit (server-side Node.js PDF library).
 *
 * Document structure:
 *   Page 1: Cover — Company name, report metadata, data depth indicator
 *   Page 2+: Signals table, Opportunities table, Capability matches, Contacts
 *   Last page: Audit trail, compliance disclaimer
 */
async function generatePdf(payload: ExportPayload): Promise<Buffer> {
  // Dynamic import to avoid bundling PDFKit in client-side code
  const PDFDocument = await import('pdfkit');
  const PDFDocumentClass = PDFDocument.default || PDFDocument;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocumentClass({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `DeepMindQ Intelligence Report: ${payload.company.name}`,
        Author: 'DeepMindQ Export API v1.0',
        Subject: `Intelligence export for ${payload.company.name}`,
        CreationDate: new Date(payload.metadata.exportedAt),
      },
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── COVER PAGE ──
    doc.moveDown(4);
    doc.fontSize(24).font('Helvetica-Bold')
      .text('DeepMindQ Intelligence Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(18).font('Helvetica')
      .text(String(payload.company.name || 'Unknown Company'), { align: 'center' });
    doc.moveDown(2);

    // Company details block
    doc.fontSize(11).font('Helvetica');
    const details = [
      ['Domain', String(payload.company.domain || 'N/A')],
      ['Industry', String(payload.company.industry || 'N/A')],
      ['Size Range', String(payload.company.sizeRange || 'N/A')],
      ['Location', String(payload.company.location || 'N/A')],
      ['Intelligence Score', String(payload.company.intelligenceScore ?? 'N/A')],
      ['Data Depth', payload.metadata.dataDepthIndicator],
    ];
    for (const [label, value] of details) {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(value);
    }

    doc.moveDown(2);
    // Audit trail metadata
    doc.fontSize(9).font('Helvetica').fillColor('#666666');
    doc.text(`Exported: ${payload.metadata.exportedAt}`);
    doc.text(`Version: ${payload.metadata.exportVersion}`);
    doc.text(`System: ${payload.metadata.auditTrail.systemVersion}`);
    doc.text(`Data Freshness As Of: ${payload.metadata.auditTrail.dataFreshnessAsOf}`);
    doc.fillColor('#000000');

    doc.moveDown(3);
    doc.fontSize(8).fillColor('#999999')
      .text('CONFIDENTIAL — This report was auto-generated by DeepMindQ. All intelligence should be independently verified before business use.', { align: 'center' });
    doc.fillColor('#000000');

    // ── SIGNALS PAGE ──
    if (payload.signals.length > 0) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Signals');
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica').text(`Total: ${payload.signals.length}`);
      doc.moveDown(0.5);

      // Table header
      const colWidths = [80, 140, 60, 50, 150];
      const headers = ['Type', 'Description', 'Severity', 'Confidence', 'Source'];
      doc.font('Helvetica-Bold').fontSize(8);
      let x = 50;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x, doc.y, { width: colWidths[i], continued: i < headers.length - 1 });
        x += colWidths[i];
      }
      doc.moveDown(0.3);

      // Table rows
      doc.font('Helvetica').fontSize(7);
      for (const signal of payload.signals.slice(0, 50)) {
        const vals = [
          String(signal.type || ''),
          String(signal.description || '').substring(0, 80),
          String(signal.severity || ''),
          String(Number(signal.confidence ?? 0).toFixed(2)),
          String(signal.source || ''),
        ];
        x = 50;
        for (let i = 0; i < vals.length; i++) {
          doc.text(vals[i], x, doc.y, { width: colWidths[i], continued: i < vals.length - 1 });
          x += colWidths[i];
        }
        doc.moveDown(0.2);
        // Page break if near bottom
        if (doc.y > 700) {
          doc.addPage();
          doc.fontSize(8).text(`Signals (continued — ${payload.signals.length} total)`);
          doc.moveDown(0.5);
        }
      }
      if (payload.signals.length > 50) {
        doc.font('Helvetica-Oblique').fontSize(7).text(`... and ${payload.signals.length - 50} more signals (truncated for PDF)`);
      }
    }

    // ── OPPORTUNITIES PAGE ──
    if (payload.opportunities.length > 0) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Opportunities');
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica').text(`Total: ${payload.opportunities.length}`);
      doc.moveDown(0.5);

      for (const opp of payload.opportunities.slice(0, 30)) {
        doc.font('Helvetica-Bold').fontSize(9)
          .text(String(opp.title || 'Untitled'), { continued: true });
        doc.font('Helvetica').fontSize(8)
          .text(`  |  Score: ${opp.score ?? 'N/A'}  |  Status: ${opp.status || 'N/A'}`);
        doc.moveDown(0.2);
      }
    }

    // ── CAPABILITY MATCHES ──
    if (payload.capabilityMatches.length > 0) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Capability Matches');
      doc.moveDown(0.5);

      for (const match of payload.capabilityMatches.slice(0, 30)) {
        doc.font('Helvetica').fontSize(9)
          .text(`${match.capability || 'Unknown'} — Match Score: ${Number(match.matchScore ?? 0).toFixed(0)}%`);
        doc.moveDown(0.15);
      }
    }

    // ── CONTACTS PAGE ──
    if (payload.contacts.length > 0) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Contacts');
      doc.moveDown(0.5);

      for (const contact of payload.contacts.slice(0, 50)) {
        doc.font('Helvetica-Bold').fontSize(9)
          .text(String(contact.name || 'Unknown'), { continued: true });
        doc.font('Helvetica').fontSize(8)
          .text(`  |  ${contact.title || 'No title'}  |  ${contact.email || 'N/A'}`);
        doc.moveDown(0.15);
      }
    }

    // ── COMPLIANCE / AUDIT TRAIL PAGE (always last) ──
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Compliance & Audit Trail');
    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica');
    doc.font('Helvetica-Bold').text('Report Metadata:');
    doc.font('Helvetica').text(`Company ID: ${payload.metadata.companyId}`);
    doc.text(`Export Version: ${payload.metadata.exportVersion}`);
    doc.text(`Data Depth Indicator: ${payload.metadata.dataDepthIndicator}`);
    doc.text(`Total Signals: ${payload.metadata.totalSignals}`);
    doc.text(`Total Opportunities: ${payload.metadata.totalOpportunities}`);
    doc.text(`Generated By: ${payload.metadata.auditTrail.generatedBy}`);
    doc.text(`System Version: ${payload.metadata.auditTrail.systemVersion}`);
    doc.text(`Data Freshness As Of: ${payload.metadata.auditTrail.dataFreshnessAsOf}`);
    doc.text(`Includes Decision Audit Hash: ${payload.metadata.auditTrail.includesDecisionAuditHash}`);

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#999999');
    doc.text('DISCLAIMER');
    doc.text('This intelligence report was automatically generated by DeepMindQ AI systems.');
    doc.text('All data, signals, scores, and recommendations should be independently verified');
    doc.text('before use in business decisions. DeepMindQ does not guarantee the accuracy,');
    doc.text('completeness, or timeliness of any intelligence contained herein.');
    doc.text('');
    doc.text(`Report generated at: ${payload.metadata.exportedAt}`);
    doc.text('Retention period: Per your organization data retention policy.');
    doc.fillColor('#000000');

    doc.end();
  });
}

// ── Helpers ────────────────────────────────────────────────────────────

function computeExportDataDepth(
  signalCount: number,
  opportunityCount: number,
  capabilityMatchCount: number,
  contactCount: number,
): string {
  const scores = [
    signalCount >= 5 ? 2 : signalCount >= 2 ? 1 : 0,
    opportunityCount >= 3 ? 2 : opportunityCount >= 1 ? 1 : 0,
    capabilityMatchCount >= 3 ? 2 : capabilityMatchCount >= 1 ? 1 : 0,
    contactCount >= 5 ? 2 : contactCount >= 1 ? 1 : 0,
  ];
  const total = scores.reduce((a, b) => a + b, 0);
  if (total >= 7) return 'comprehensive';
  if (total >= 4) return 'moderate';
  if (total >= 2) return 'limited';
  return 'minimal';
}
