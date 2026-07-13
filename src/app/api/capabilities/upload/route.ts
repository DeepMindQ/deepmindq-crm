import { NextResponse } from 'next/server';

/* ── POST: Upload a document and extract text ── */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedExtensions = ['.txt', '.md', '.pdf', '.docx'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json({ error: 'Unsupported file type. Use .txt, .md, .pdf, or .docx' }, { status: 400 });
    }

    // Size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 5MB allowed.' }, { status: 400 });
    }

    let extractedText = '';

    if (ext === '.txt' || ext === '.md') {
      const buffer = await file.arrayBuffer();
      extractedText = new TextDecoder('utf-8').decode(buffer);
    } else if (ext === '.pdf') {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Basic PDF text extraction: extract text between BT and ET markers
      // and from stream objects. This is a simplified extractor.
      const textParts: string[] = [];
      const content = new TextDecoder('latin1').decode(bytes);

      // Strategy 1: Find text between parentheses in Tj/TJ operators
      const textObjRegex = /\(([^)]*)\)\s*Tj/g;
      let match: RegExpExecArray | null;
      while ((match = textObjRegex.exec(content)) !== null) {
        const decoded = decodePdfString(match[1]);
        if (decoded.trim()) textParts.push(decoded);
      }

      // Strategy 2: Find array-based text in TJ operators: [(text1) (text2)] TJ
      const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
      while ((match = tjArrayRegex.exec(content)) !== null) {
        const innerTexts = match[1];
        const strMatches = innerTexts.matchAll(/\(([^)]*)\)\s*-?\d*\.?\d*/g);
        for (const sm of strMatches) {
          const decoded = decodePdfString(sm[1]);
          if (decoded.trim()) textParts.push(decoded);
        }
      }

      // Strategy 3: Broader search for any Tj operators with text
      if (textParts.length === 0) {
        const broadTjRegex = /\(([^)]{1,200})\)/g;
        while ((match = broadTjRegex.exec(content)) !== null) {
          const decoded = decodePdfString(match[1]);
          if (decoded.trim() && decoded.trim().length > 1) {
            textParts.push(decoded);
          }
        }
      }

      extractedText = textParts.join(' ').replace(/\s+/g, ' ').trim();

      if (!extractedText) {
        extractedText = `[PDF text extraction limited for "${file.name}". The PDF structure could not be parsed for text content. Please paste the content manually or use a .txt/.md file.]`;
      }
    } else if (ext === '.docx') {
      // DOCX is a zip file — extract text from word/document.xml
      const buffer = await file.arrayBuffer();

      // Look for <w:t> tags in the raw bytes (simplified extraction)
      const content = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
      const textParts: string[] = [];
      const wTagRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let m: RegExpExecArray | null;
      while ((m = wTagRegex.exec(content)) !== null) {
        if (m[1].trim()) textParts.push(m[1].trim());
      }

      if (textParts.length > 0) {
        extractedText = textParts.join(' ');
      } else {
        extractedText = `[DOCX text extraction limited for "${file.name}". Please paste the content manually or use a .txt/.md file.]`;
      }
    }

    // Clean up extracted text
    extractedText = extractedText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return NextResponse.json({
      success: true,
      extractedText,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    );
  }
}

/* Decode PDF string escape sequences */
function decodePdfString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}