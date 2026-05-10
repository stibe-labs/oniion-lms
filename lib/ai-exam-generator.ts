// =================================================================
// AI Exam Generator — Groq Cloud API (text + vision)
// Extracts/generates MCQ questions from uploaded files (PDF, images, office docs)
// =================================================================

import { readFile, writeFile, mkdir, mkdtemp, rm, readdir } from 'fs/promises';
import { copyFileSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import { getIntegrationConfig } from '@/lib/integration-config';

const execFileAsync = promisify(execFile);

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_TIMEOUT_MS = 120_000; // 2 minutes
const MAX_PDF_PAGES = 20;
const OFFICE_CONVERTIBLE_EXTS = new Set([
  '.ppt', '.pptx', '.odp',
  '.doc', '.docx', '.odt', '.rtf',
  '.xls', '.xlsx', '.ods',
]);

// ── Convert office document to PDF using LibreOffice headless ──
async function convertOfficeToPdf(inputPath: string): Promise<string> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'office-conv-'));
  // Copy original file into tmpDir so LibreOffice output lands there
  const baseName = path.basename(inputPath);
  const tmpInput = path.join(tmpDir, baseName);
  copyFileSync(inputPath, tmpInput);

  try {
    await execFileAsync('soffice', [
      '--headless', '--convert-to', 'pdf', '--outdir', tmpDir, tmpInput,
    ], { timeout: 120_000 });
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(`LibreOffice conversion failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  // Find the generated PDF
  const files = await readdir(tmpDir);
  const pdfFile = files.find(f => f.endsWith('.pdf'));
  if (!pdfFile) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw new Error('LibreOffice produced no PDF output from office file');
  }

  const pdfPath = path.join(tmpDir, pdfFile);
  console.log(`[ai-exam] Converted office file → PDF: ${pdfPath}`);
  return pdfPath; // caller must clean up tmpDir
}

// Parse page number ranges like "1-3,5,7-9" into a Set of page numbers
function parsePageNumbers(spec: string): Set<number> {
  const pages = new Set<number>();
  for (const part of spec.split(',')) {
    const trimmed = part.trim();
    const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let i = start; i <= Math.min(end, 200); i++) pages.add(i);
    } else {
      const n = parseInt(trimmed, 10);
      if (!isNaN(n) && n > 0) pages.add(n);
    }
  }
  return pages;
}

export interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_answer: number; // 0-indexed
  marks: number;
  difficulty: 'easy' | 'medium' | 'hard';
  sort_order: number;
  image_url?: string;
  solution_steps?: string;
}

// ── Text extraction from PDF ─────────────────────────────────
async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

// ── Check if PDF text is meaningful (not just page markers) ──
function hasRealTextContent(text: string | null): boolean {
  if (!text) return false;
  const clean = text
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '')
    .replace(/page\s*\d+/gi, '')
    .trim();
  return clean.length > 100;
}

// ── Render PDF pages to base64 JPEG images ───────────────────
async function renderPdfToImages(pdfPath: string): Promise<string[]> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'pdf-ocr-'));
  const outPrefix = path.join(tmpDir, 'page');

  try {
    await execFileAsync('pdftoppm', [
      '-jpeg', '-r', '200', '-f', '1', '-l', String(MAX_PDF_PAGES),
      pdfPath, outPrefix,
    ], { timeout: 60_000 });
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(`pdftoppm failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  const files = await readdir(tmpDir);
  const jpegPaths = files.filter(f => f.endsWith('.jpg')).sort().map(f => path.join(tmpDir, f));

  const base64Images: string[] = [];
  for (const jp of jpegPaths) {
    const buf = await readFile(jp);
    base64Images.push(buf.toString('base64'));
  }

  await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  console.log(`[ai-exam] Rendered ${base64Images.length} PDF pages to JPEG`);
  return base64Images;
}

// ── Save page images permanently and return base64 + URLs ────
async function savePageImages(
  topicId: string, filePaths: string[],
): Promise<{ images: string[]; pageUrls: string[] }> {
  const saveDir = path.join(process.cwd(), 'public', 'uploads', 'exam-questions', topicId);
  await mkdir(saveDir, { recursive: true });

  const allImages: string[] = [];
  const allUrls: string[] = [];
  let pageNum = 0;

  for (const fp of filePaths) {
    const ext = path.extname(fp).toLowerCase();
    if (OFFICE_CONVERTIBLE_EXTS.has(ext)) {
      // Convert office file → PDF → images
      const pdfPath = await convertOfficeToPdf(fp);
      const pptTmpDir = path.dirname(pdfPath);
      try {
        const tmpDir2 = await mkdtemp(path.join(os.tmpdir(), 'ppt-img-'));
        const outPrefix2 = path.join(tmpDir2, 'page');
        try {
          await execFileAsync('pdftoppm', [
            '-jpeg', '-r', '200', '-f', '1', '-l', String(MAX_PDF_PAGES),
            pdfPath, outPrefix2,
          ], { timeout: 60_000 });
        } catch (err) {
          await rm(tmpDir2, { recursive: true, force: true }).catch(() => {});
          throw new Error(`pdftoppm (office PDF) failed: ${err instanceof Error ? err.message : 'unknown'}`);
        }
        const pptFiles = (await readdir(tmpDir2)).filter(f => f.endsWith('.jpg')).sort();
        for (const f of pptFiles) {
          pageNum++;
          const buf = await readFile(path.join(tmpDir2, f));
          allImages.push(buf.toString('base64'));
          const fileName = `page-${String(pageNum).padStart(3, '0')}.jpg`;
          await writeFile(path.join(saveDir, fileName), buf);
          allUrls.push(`/uploads/exam-questions/${topicId}/${fileName}`);
        }
        await rm(tmpDir2, { recursive: true, force: true }).catch(() => {});
      } finally {
        await rm(pptTmpDir, { recursive: true, force: true }).catch(() => {});
      }
    } else if (ext === '.pdf') {
      const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'pdf-save-'));
      const outPrefix = path.join(tmpDir, 'page');
      try {
        await execFileAsync('pdftoppm', [
          '-jpeg', '-r', '200', '-f', '1', '-l', String(MAX_PDF_PAGES),
          fp, outPrefix,
        ], { timeout: 60_000 });
      } catch (err) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        throw new Error(`pdftoppm failed: ${err instanceof Error ? err.message : 'unknown'}`);
      }
      const files = (await readdir(tmpDir)).filter(f => f.endsWith('.jpg')).sort();
      for (const f of files) {
        pageNum++;
        const buf = await readFile(path.join(tmpDir, f));
        allImages.push(buf.toString('base64'));
        const fileName = `page-${String(pageNum).padStart(3, '0')}.jpg`;
        await writeFile(path.join(saveDir, fileName), buf);
        allUrls.push(`/uploads/exam-questions/${topicId}/${fileName}`);
      }
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    } else if (IMAGE_EXTS.has(ext)) {
      pageNum++;
      const buf = await readFile(fp);
      allImages.push(buf.toString('base64'));
      const fileName = `page-${String(pageNum).padStart(3, '0')}${ext}`;
      await writeFile(path.join(saveDir, fileName), buf);
      allUrls.push(`/uploads/exam-questions/${topicId}/${fileName}`);
    }
  }

  console.log(`[ai-exam] Saved ${allImages.length} page images to ${saveDir}`);
  return { images: allImages, pageUrls: allUrls };
}

// ── Groq text generation (70B model) ─────────────────────────
async function callGroq(prompt: string): Promise<string> {
  const cfg = await getIntegrationConfig();
  const apiKey = cfg.groq.apiKey;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  try {
    console.log(`[ai-exam] Calling Groq text (${cfg.groq.model}), prompt: ${prompt.length} chars`);
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: cfg.groq.model,
        messages: [
          { role: 'system', content: 'You are an expert exam question extractor and generator. Always respond with valid JSON. Never use LaTeX notation — write math in plain text.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 16384,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown error');
      throw new Error(`Groq text failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content || '';
    console.log(`[ai-exam] Groq text responded: ${content.length} chars`);
    return content;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('Groq text generation timed out.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Groq vision (Scout model — images + text prompt) ─────────
async function callGroqVision(prompt: string, imageBase64s: string[]): Promise<string> {
  const cfg = await getIntegrationConfig();
  const apiKey = cfg.groq.apiKey;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: prompt },
  ];
  for (const b64 of imageBase64s) {
    content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } });
  }

  try {
    console.log(`[ai-exam] Calling Groq vision (${cfg.groq.visionModel}), ${imageBase64s.length} images`);
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: cfg.groq.visionModel,
        messages: [{ role: 'user', content }],
        temperature: 0.2,
        max_tokens: 8192,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown error');
      throw new Error(`Groq vision failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const result = data.choices?.[0]?.message?.content || '';
    console.log(`[ai-exam] Groq vision responded: ${result.length} chars`);
    return result;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('Groq vision request timed out.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Collect images from files (for QP vision mode) ───────────
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

async function collectImagesFromFiles(filePaths: string[]): Promise<string[]> {
  const allImages: string[] = [];
  for (const fp of filePaths) {
    const ext = path.extname(fp).toLowerCase();
    if (OFFICE_CONVERTIBLE_EXTS.has(ext)) {
      // Convert office file → PDF → images
      const pdfPath = await convertOfficeToPdf(fp);
      const tmpDir = path.dirname(pdfPath);
      try {
        const images = await renderPdfToImages(pdfPath);
        allImages.push(...images);
      } finally {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    } else if (ext === '.pdf') {
      const images = await renderPdfToImages(fp);
      allImages.push(...images);
    } else if (IMAGE_EXTS.has(ext)) {
      const buf = await readFile(fp);
      allImages.push(buf.toString('base64'));
    }
  }
  return allImages;
}

// ── Extract text content from file (for topic mode) ──────────
export async function extractFileContent(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await readFile(filePath);

  if (OFFICE_CONVERTIBLE_EXTS.has(ext)) {
    // Convert office file → PDF → extract text (or OCR via vision)
    console.log(`[ai-exam] Extracting text from office file via PDF conversion...`);
    const pdfPath = await convertOfficeToPdf(filePath);
    const pptTmpDir = path.dirname(pdfPath);
    try {
      const pdfBuffer = await readFile(pdfPath);
      const text = await extractPdfText(pdfBuffer);
      if (hasRealTextContent(text)) return text;
      // Scan-heavy office export with minimal text — use vision OCR
      console.log(`[ai-exam] Office file has minimal text, using Groq vision OCR...`);
      const images = await renderPdfToImages(pdfPath);
      if (images.length === 0) return text || '';
      const ocrText = await callGroqVision(
        'Extract ALL text from these document pages exactly as written. Preserve the structure, headings, bullet points, tables, and formatting. Output only the extracted text.',
        images,
      );
      return ocrText.trim() || text || '';
    } finally {
      await rm(pptTmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  if (ext === '.pdf') {
    const text = await extractPdfText(buffer);
    if (hasRealTextContent(text)) return text;
    // Scanned PDF — use Groq vision as OCR
    console.log(`[ai-exam] PDF is scanned, using Groq vision for OCR...`);
    const images = await renderPdfToImages(filePath);
    if (images.length === 0) return text || '';
    const ocrText = await callGroqVision(
      'Extract ALL text from these document pages exactly as written. Preserve the structure, headings, numbering, and formatting. Output only the extracted text.',
      images,
    );
    return ocrText.trim() || text || '';
  }

  if (IMAGE_EXTS.has(ext)) {
    const base64 = buffer.toString('base64');
    return await callGroqVision('Extract ALL text from this image exactly as written. Output only the extracted text.', [base64]);
  }

  if (ext === '.txt' || ext === '.csv' || ext === '.md' || ext === '.json') return buffer.toString('utf-8');
  return '';
}

// ── QP extraction prompt (vision — sent with page images) ────
function buildQPVisionPrompt(subject: string, grade: string, topicTitle: string, startPage: number, endPage: number): string {
  return `You are looking at scanned pages from a school exam question paper.
The images provided are pages ${startPage} to ${endPage} of the paper. Image 1 = Page ${startPage}, Image 2 = Page ${startPage + 1}, and so on.

Subject: ${subject}
Grade: ${grade}
Topic: ${topicTitle}

STEP 1 — STUDY THE PAPER STRUCTURE:
Before extracting questions, carefully study the entire question paper:
- Identify sections (Section A, B, C, etc.) and their mark allocations.
- Note the marks assigned to each question (e.g., "1 mark", "2 marks", "5 marks").
- Identify "OR" questions — where two alternatives are given (e.g., "21(a) OR 21(b)", "Question 5 OR Question 5").
- Identify sub-parts like (a), (b), (c), (i), (ii) etc.

STEP 2 — EXTRACTION RULES:
1. Extract EVERY question EXACTLY as it appears — same wording, same values, same numbers. Do NOT rephrase or modify anything.
2. If a question is already MCQ with options, keep the EXACT same options in the same order.
3. If a question is NOT MCQ (short-answer, fill-in-the-blank, descriptive, numerical, proof, etc.):
   - You MUST actually SOLVE the question to find the correct answer.
   - Create 4 SPECIFIC, REALISTIC answer options based on your solution. One must be correct, three must be plausible but wrong.
   - NEVER use placeholders like "Option A", "Option B", "A", "B", "C", "D" as options. Every option must be a real, specific answer.
   - Provide step-by-step solution in "solution_steps" explaining HOW to arrive at the correct answer.
4. For questions with DIAGRAMS, FIGURES, GRAPHS, or TABLES: describe the visual content in detail within the question text.
5. Extract ALL questions from ALL pages. Do not skip ANY question.
6. "OR" QUESTIONS: When a question has alternatives (e.g., "21(a) OR 21(b)", or "Answer any one"), create EACH alternative as a SEPARATE question. Prefix the question_text with the original number: e.g., "21(a). Find the value..." and "21(b). Prove that...".
7. SUB-PARTS: Each sub-part (a), (b), (c), (i), (ii) must be a SEPARATE question. Include the parent question context if needed. E.g., for Q3(a) and Q3(b), create two entries: "3(a). ..." and "3(b). ...".
8. MARKS: Include the marks for each question as shown on the paper. If a parent question says "5 marks" and has sub-parts (a) and (b), try to determine individual marks. If not specified, divide equally.
9. ABSOLUTELY NO LaTeX notation. Write ALL math in plain text:
   - Matrices: "matrix [[-1, 0, 0], [0, 1, 0], [0, 0, 1]]"
   - Fractions: "3/4" or "(x+1)/(x-1)"
   - Powers: "x^2" or "x squared"
   - Roots: "sqrt(x)" or "cube root(x)"
   - Greek: "alpha", "beta", "theta", "pi"
   - Trig: "sin(30 degrees)", "cos(theta)"
   - Symbols: >=, <=, !=, infinity, +/-, degrees
   - Integrals: "integral from 0 to 1 of f(x) dx"
   - Limits: "limit as x approaches 0 of f(x)"
   - Summation: "sum from i=1 to n of i^2"
10. Preserve the original question numbering in question_text.
11. PAGE TRACKING (CRITICAL): For EACH question, you MUST set "page_number" to the EXACT page where that question appears. Look at which image the question is visible in:
    - Image 1 = Page ${startPage}
    - Image 2 = Page ${startPage + 1}
    ${endPage > startPage + 1 ? `- Image 3 = Page ${startPage + 2}` : ''}
    ${endPage > startPage + 2 ? `- Image 4 = Page ${startPage + 3}` : ''}
    ${endPage > startPage + 3 ? `- Image 5 = Page ${startPage + 4}` : ''}
    Questions from different pages MUST have different page_number values. Double-check each question's page.

CRITICAL — OPTIONS QUALITY:
- NEVER output generic placeholders like "Option A", "Option B", "A", "B", "C", "D" as options.
- Every option must be a SPECIFIC, MEANINGFUL answer (a number, a formula, a phrase, a name, etc.).
- For non-MCQ questions: solve the problem first, then create 4 realistic options from your solution.
- For solution_steps: explain the key steps to arrive at the correct answer. Keep it concise but clear.

Output Format: Return ONLY a valid JSON object. No markdown, no code fences.
{
  "questions": [
    {
      "question_text": "1. Find the value of x if 2x + 5 = 15",
      "options": ["5", "10", "3", "7"],
      "correct_answer": 0,
      "difficulty": "easy",
      "marks": 1,
      "page_number": ${startPage},
      "solution_steps": "Step 1: 2x + 5 = 15. Step 2: 2x = 10. Step 3: x = 5."
    },
    {
      "question_text": "5. The area of a circle with radius 7 cm is",
      "options": ["154 sq cm", "44 sq cm", "88 sq cm", "22 sq cm"],
      "correct_answer": 0,
      "difficulty": "medium",
      "marks": 2,
      "page_number": ${Math.min(startPage + 1, endPage)},
      "solution_steps": "Area = pi x r^2 = 22/7 x 7 x 7 = 154 sq cm."
    }
  ]
}
Where "correct_answer" is 0-based index (0=first option, 1=second, 2=third, 3=fourth).
"difficulty" is "easy", "medium", or "hard".
"marks" is the mark allocation for that question (integer).
"page_number" is the EXACT page (${startPage} to ${endPage}) where you see that question in the images. MUST vary across pages.
"solution_steps" is a brief step-by-step explanation of how to get the correct answer (required for non-MCQ questions, optional for MCQ).

Extract all questions now:`;
}

// ── QP extraction prompt (text — for text PDFs) ──────────────
function buildQPTextPrompt(content: string, subject: string, grade: string, topicTitle: string): string {
  return `You are extracting questions from a school exam question paper.

Subject: ${subject}
Grade: ${grade}
Topic: ${topicTitle}

Question Paper Content:
---
${content.slice(0, 30000)}
---

STEP 1 — STUDY THE PAPER STRUCTURE:
Before extracting, carefully study the entire paper:
- Identify sections (Section A, B, C, etc.) and their mark allocations.
- Note marks assigned to each question.
- Identify "OR" questions — where two alternatives are given.
- Identify sub-parts like (a), (b), (c), (i), (ii).

STEP 2 — EXTRACTION RULES:
1. Extract EVERY question EXACTLY as written — same wording, same values, same numbers. Do NOT rephrase or modify.
2. If a question is already MCQ, keep the EXACT same options in the same order.
3. If a question is NOT MCQ (short-answer, numerical, fill-in-blank, descriptive, proof, etc.):
   - You MUST actually SOLVE the question to find the correct answer.
   - Create 4 SPECIFIC, REALISTIC answer options (one correct, three plausible but wrong).
   - NEVER use generic placeholders like "Option A", "Option B", "A", "B", "C", "D".
   - Provide "solution_steps" explaining how to arrive at the correct answer.
4. Extract ALL questions. Do not skip any.
5. "OR" QUESTIONS: When a question has alternatives (e.g., "21(a) OR 21(b)"), create EACH alternative as a SEPARATE question. Prefix with original number.
6. SUB-PARTS: Each sub-part (a), (b), (c), (i), (ii) must be a SEPARATE question. Include parent context if needed.
7. MARKS: Include marks for each question as shown on the paper.
8. Write math in plain text. No LaTeX.
9. Preserve original question numbering in question_text.

CRITICAL — OPTIONS QUALITY:
- NEVER output generic placeholders like "Option A", "Option B", "A", "B", "C", "D" as options.
- Every option must be a SPECIFIC, MEANINGFUL answer (a number, a formula, a phrase, a name, etc.).
- For non-MCQ questions: solve the problem first, then create 4 realistic options.

Output Format: Return ONLY valid JSON:
{
  "questions": [
    {
      "question_text": "21(a). Find the zeroes of the polynomial x^2 - 5x + 6",
      "options": ["2 and 3", "1 and 6", "-2 and -3", "2 and -3"],
      "correct_answer": 0,
      "difficulty": "medium",
      "marks": 2,
      "solution_steps": "x^2 - 5x + 6 = (x-2)(x-3). Setting each factor to 0: x = 2 or x = 3."
    }
  ]
}
Where "correct_answer" is 0-based (0=first option, 1=second, 2=third, 3=fourth).
"marks" is the mark allocation for that question (integer).
"solution_steps" is a brief step-by-step explanation of how to get the correct answer (required for non-MCQ questions).

Extract all questions now:`;
}

// ── Topic generation prompt ──────────────────────────────────
function buildTopicPrompt(
  content: string, subject: string, grade: string,
  topicTitle: string, count: number,
): string {
  return `You are an expert exam question generator for school students.
You are given educational content on a topic — create exam questions that test understanding.

Subject: ${subject}
Grade: ${grade}
Topic: ${topicTitle}

Content from uploaded file(s):
---
${content.slice(0, 8000)}
---

INSTRUCTIONS:
1. Generate exactly ${count} MCQs based ONLY on the content provided.
2. Questions should test understanding, not just memorization.
3. Mix difficulty: ~30% easy, ~50% medium, ~20% hard.
4. Each question must be clear, unambiguous, and grade-appropriate.
5. Each question must have exactly 4 options.
6. Exactly one option must be correct. Options should be plausible.
7. Do NOT use LaTeX. Write math in plain text.
8. NEVER use generic placeholders like "Option A", "Option B" etc. Every option must be a SPECIFIC, MEANINGFUL answer.
9. For each question, include "solution_steps" explaining the reasoning to arrive at the correct answer.

Output Format: Return ONLY valid JSON:
{
  "questions": [
    {
      "question_text": "What is the boiling point of water at sea level?",
      "options": ["100 degrees C", "90 degrees C", "110 degrees C", "80 degrees C"],
      "correct_answer": 0,
      "difficulty": "easy",
      "solution_steps": "Water boils at 100 degrees Celsius (212 degrees F) at standard atmospheric pressure at sea level."
    }
  ]
}
Where "correct_answer" is 0-based (0=first option, 1=second, 2=third, 3=fourth).

Generate the questions now:`;
}

// ── Sanitize LaTeX in raw JSON string before parsing ─────────
function stripLatexFromJson(raw: string): string {
  let s = raw;
  // Replace \begin{env}...\end{env} blocks with plain text
  s = s.replace(/\\begin\{([^}]+)\}([\s\S]*?)\\end\{\1\}/g, (_m, _env, body) => {
    return body.replace(/\\\\/g, '; ').replace(/&/g, ', ').trim();
  });
  // Replace \frac{a}{b} → (a)/(b)
  s = s.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)');
  // Replace \sqrt{x} → sqrt(x)
  s = s.replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)');
  // Replace \text{x} → x
  s = s.replace(/\\text\{([^}]*)\}/g, '$1');
  // Replace \overrightarrow{AB} → AB(vector)
  s = s.replace(/\\overrightarrow\{([^}]*)\}/g, '$1(vector)');
  // Replace \vec{a} → a(vector)
  s = s.replace(/\\vec\{([^}]*)\}/g, '$1(vector)');
  // Replace \hat{a} → a(hat)
  s = s.replace(/\\hat\{([^}]*)\}/g, '$1(hat)');
  // Replace \left and \right with nothing
  s = s.replace(/\\left[|({[]/g, '').replace(/\\right[|)}\]]/g, '');
  // Replace \times → x, \div → /, \pm → +/-, \mp → -/+
  s = s.replace(/\\times/g, ' x ').replace(/\\div/g, '/').replace(/\\pm/g, '+/-').replace(/\\mp/g, '-/+');
  // Replace \leq → <=, \geq → >=, \neq → !=
  s = s.replace(/\\leq/g, '<=').replace(/\\geq/g, '>=').replace(/\\neq/g, '!=');
  // Replace \infty → infinity
  s = s.replace(/\\infty/g, 'infinity');
  // Replace \pi → pi, \theta → theta, etc.
  s = s.replace(/\\(alpha|beta|gamma|delta|theta|phi|psi|omega|lambda|mu|sigma|epsilon|pi)/g, '$1');
  // Replace \sin, \cos, \tan, \log, \ln → sin, cos, etc.
  s = s.replace(/\\(sin|cos|tan|cot|sec|csc|log|ln|lim|max|min|det|deg)/g, '$1');
  // Replace \cdot → ·, \ldots → ..., \dots → ...
  s = s.replace(/\\cdot/g, '·').replace(/\\[lr]?dots/g, '...');
  // Replace \in → in, \subset → subset, \forall → for all, \exists → exists
  s = s.replace(/\\in\b/g, ' in ').replace(/\\subset/g, ' subset ');
  // Replace \int → integral, \sum → sum, \prod → product
  s = s.replace(/\\int/g, 'integral ').replace(/\\sum/g, 'sum ').replace(/\\prod/g, 'product ');
  // Replace \to → →, \rightarrow → →, \Rightarrow → =>
  s = s.replace(/\\to\b/g, '→').replace(/\\rightarrow/g, '→').replace(/\\Rightarrow/g, '=>');
  // Replace ^{n} → ^n and _{n} → _n
  s = s.replace(/\^\{([^}]*)\}/g, '^($1)').replace(/_\{([^}]*)\}/g, '_($1)');
  // Replace \quad, \qquad, \, \; \! with spaces
  s = s.replace(/\\(quad|qquad|,|;|!|\s)/g, ' ');
  // Replace \( ... \) and \[ ... \] inline/display math delimiters
  s = s.replace(/\\\(/g, '').replace(/\\\)/g, '').replace(/\\\[/g, '').replace(/\\\]/g, '');
  // Replace remaining \commandname with empty (catch-all for unknown commands)
  s = s.replace(/\\[a-zA-Z]+/g, '');
  // Clean up multiple spaces
  s = s.replace(/  +/g, ' ');
  return s;
}

// ── Parse and validate AI response ───────────────────────────
function parseQuestions(responseText: string, maxCount: number): GeneratedQuestion[] {
  let jsonStr = responseText.trim();

  // Strip markdown code fences
  jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // Aggressively strip LaTeX before any JSON parsing attempt
  jsonStr = stripLatexFromJson(jsonStr);

  // Handle JSON object wrapper: { "questions": [...] }
  try {
    const obj = JSON.parse(jsonStr);
    if (obj && !Array.isArray(obj) && typeof obj === 'object') {
      const arr = Object.values(obj).find(v => Array.isArray(v));
      if (arr) jsonStr = JSON.stringify(arr);
    }
  } catch { /* continue with cleanup */ }

  // Try to find JSON array in the response
  const arrayMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) jsonStr = arrayMatch[0];

  // Fix trailing commas
  jsonStr = jsonStr.replace(/,\s*([\]\}])/g, '$1');

  // Fix LaTeX backslashes that break JSON
  jsonStr = jsonStr.replace(/\\(?!["\\\/bfnrtu])/g, '\\\\');

  let parsed: Array<{
    question_text: string; options: string[];
    correct_answer: number; difficulty: string;
    marks?: number; page_number?: number;
    solution_steps?: string;
  }>;

  try { parsed = JSON.parse(jsonStr); }
  catch (e) {
    console.error('[ai-exam] JSON parse failed. Raw (first 500):', responseText.substring(0, 500));
    throw new Error('AI returned invalid JSON. Please try again.');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('AI returned empty or invalid question array');
  }

  const questions: GeneratedQuestion[] = [];
  for (let i = 0; i < Math.min(parsed.length, maxCount); i++) {
    const q = parsed[i];
    if (!q.question_text || !Array.isArray(q.options) || q.options.length !== 4) continue;
    if (typeof q.correct_answer !== 'number' || q.correct_answer < 0 || q.correct_answer > 3) continue;

    questions.push({
      question_text: q.question_text.trim(),
      options: q.options.map((o: string) => String(o).trim()),
      correct_answer: q.correct_answer,
      marks: (typeof q.marks === 'number' && q.marks >= 1) ? q.marks : 1,
      difficulty: (['easy', 'medium', 'hard'].includes(q.difficulty)
        ? q.difficulty as 'easy' | 'medium' | 'hard' : 'medium'),
      sort_order: i,
      ...(q.solution_steps ? { solution_steps: String(q.solution_steps).trim() } : {}),
      ...( q.page_number != null ? { _page_number: Math.round(Number(q.page_number)) || undefined } : {}),
    } as GeneratedQuestion & { _page_number?: number });
  }

  return questions;
}

// ═════════════════════════════════════════════════════════════
// Main entry: generate from multiple files on disk
// ═════════════════════════════════════════════════════════════
export type ProgressStage = 'extracting' | 'building_prompt' | 'generating_ai' | 'parsing' | 'saving';

export async function generateQuestionsFromFiles(
  filePaths: string[],
  subject: string,
  grade: string,
  topicTitle: string,
  isQuestionPaper: boolean,
  count?: number,
  onProgress?: (stage: ProgressStage) => void,
  topicId?: string,
  pageNumbers?: string | null,
): Promise<GeneratedQuestion[]> {
  const effectiveCount = count ?? (isQuestionPaper ? 200 : 10);
  let responseText!: string;
  let questions!: GeneratedQuestion[];

  if (isQuestionPaper) {
    // ═══ QP Mode: Extract EXACT questions from the paper ═══
    onProgress?.('extracting');

    // Save page images permanently if topicId provided
    let images: string[];
    let pageUrls: string[] = [];
    if (topicId) {
      const saved = await savePageImages(topicId, filePaths);
      images = saved.images;
      pageUrls = saved.pageUrls;
    } else {
      images = await collectImagesFromFiles(filePaths);
    }

    // Filter to specific pages if pageNumbers provided (e.g. "1-3,5,7-9")
    if (pageNumbers) {
      const allowedPages = parsePageNumbers(pageNumbers);
      if (allowedPages.size > 0) {
        const filteredImages: string[] = [];
        const filteredUrls: string[] = [];
        images.forEach((img, i) => {
          if (allowedPages.has(i + 1)) {
            filteredImages.push(img);
            if (pageUrls[i]) filteredUrls.push(pageUrls[i]);
          }
        });
        console.log(`[ai-exam] Page filter: ${images.length} → ${filteredImages.length} pages (requested: ${pageNumbers})`);
        images = filteredImages;
        pageUrls = filteredUrls;
      }
    }

    const GROQ_MAX_IMAGES = 5; // Scout model limit

    if (images.length > 0) {
      // Vision path: send page images to Groq vision in batches of 5
      console.log(`[ai-exam] QP vision mode: ${images.length} page images → Groq Scout (batches of ${GROQ_MAX_IMAGES})`);
      onProgress?.('generating_ai');

      const allQuestions: (GeneratedQuestion & { _page_number?: number })[] = [];
      const batches: string[][] = [];
      for (let i = 0; i < images.length; i += GROQ_MAX_IMAGES) {
        batches.push(images.slice(i, i + GROQ_MAX_IMAGES));
      }

      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        const startPage = b * GROQ_MAX_IMAGES + 1;
        const endPage = b * GROQ_MAX_IMAGES + batch.length;
        const batchLabel = `pages ${startPage}-${endPage}`;
        const prompt = buildQPVisionPrompt(subject, grade, topicTitle, startPage, endPage);
        console.log(`[ai-exam] QP vision batch ${b + 1}/${batches.length} (${batchLabel}, ${batch.length} images)...`);

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const batchResponse = await callGroqVision(prompt, batch);
            const batchQs = parseQuestions(batchResponse, effectiveCount);
            console.log(`[ai-exam] Batch ${b + 1} extracted ${batchQs.length} questions`);
            allQuestions.push(...(batchQs as (GeneratedQuestion & { _page_number?: number })[]));            break;
          } catch (err) {
            if (attempt === 2) {
              console.error(`[ai-exam] Batch ${b + 1} failed after 2 attempts:`, (err as Error).message);
              // Continue with other batches instead of failing entirely
            } else {
              console.warn(`[ai-exam] Batch ${b + 1} attempt ${attempt} failed, retrying:`, (err as Error).message);
            }
          }
        }
      }

      // ═══ Assign full page images with intelligent page detection ═══
      onProgress?.('parsing');

      // Validate and fix AI-reported page numbers
      const totalPages = pageUrls.length;
      if (totalPages > 0) {
        // Step 1: Extract base question number from question_text for ordering
        const extractQNum = (text: string): number => {
          const m = text.match(/^\s*(\d+)/);
          return m ? parseInt(m[1], 10) : 0;
        };

        // Step 2: Check if AI page numbers are usable
        const reportedPages = allQuestions.map(q => q._page_number).filter((p): p is number => typeof p === 'number' && p >= 1 && p <= totalPages);
        const uniqueReported = new Set(reportedPages);
        const aiPagesUsable = uniqueReported.size > 1 || totalPages === 1;

        if (!aiPagesUsable && allQuestions.length > 0) {
          // AI returned all same page or no pages at all — infer from question numbering
          console.log(`[ai-exam] AI page_numbers unreliable (${uniqueReported.size} unique for ${totalPages} pages). Inferring from question numbers.`);

          // Sort questions by their question number to find distribution
          const qNums = allQuestions.map(q => extractQNum(q.question_text));
          const maxQNum = Math.max(...qNums.filter(n => n > 0), 1);

          // Real papers: page 1 has header taking ~25% space, so fewer questions.
          // Distribute questions proportionally: page 1 gets fewer, rest get more.
          // Use question numbers to map to pages.
          for (let i = 0; i < allQuestions.length; i++) {
            const qNum = qNums[i] || (i + 1);
            // Map question number linearly across pages, with page 1 having slightly fewer
            const normalizedPos = qNum / maxQNum; // 0..1
            // Shift slightly: first 20% of questions → page 1, rest distributed evenly
            const page1Share = 1 / (totalPages + 0.5); // Page 1 gets slightly less
            let pageIdx: number;
            if (normalizedPos <= page1Share) {
              pageIdx = 0;
            } else {
              pageIdx = Math.min(
                Math.floor(((normalizedPos - page1Share) / (1 - page1Share)) * (totalPages - 1)) + 1,
                totalPages - 1,
              );
            }
            (allQuestions[i] as { _page_number?: number })._page_number = pageIdx + 1;
          }
          console.log(`[ai-exam] Inferred page numbers for ${allQuestions.length} questions across ${totalPages} pages`);
        } else {
          // AI pages look reasonable — validate bounds
          for (const q of allQuestions) {
            const p = q._page_number;
            if (typeof p !== 'number' || p < 1 || p > totalPages) {
              // Missing or out-of-range: try to infer from neighbors
              const idx = allQuestions.indexOf(q);
              const prev = idx > 0 ? allQuestions[idx - 1]._page_number : 1;
              const next = idx < allQuestions.length - 1 ? allQuestions[idx + 1]._page_number : totalPages;
              (q as { _page_number?: number })._page_number = prev ?? next ?? 1;
            }
          }
        }
      }

      // Build final questions with page image URLs
      const croppedQuestions: GeneratedQuestion[] = [];
      for (let i = 0; i < allQuestions.length; i++) {
        const q = allQuestions[i];
        let imageUrl: string | undefined;
        const pageNum = q._page_number;
        if (totalPages > 0 && typeof pageNum === 'number') {
          const pageIdx = pageNum - 1;
          if (pageIdx >= 0 && pageIdx < totalPages) {
            imageUrl = pageUrls[pageIdx];
          }
        }
        const { _page_number, ...rest } = q;
        croppedQuestions.push({ ...rest, sort_order: i, ...(imageUrl ? { image_url: imageUrl } : {}) });
      }

      // Log page distribution for debugging
      const pageDist: Record<number, number> = {};
      for (const q of croppedQuestions) {
        if (q.image_url) {
          const pIdx = pageUrls.indexOf(q.image_url) + 1;
          pageDist[pIdx] = (pageDist[pIdx] || 0) + 1;
        }
      }
      console.log(`[ai-exam] Page distribution:`, pageDist);

      questions = croppedQuestions;
    } else {
      // Text path: extract text from files → Groq text model
      const texts: string[] = [];
      for (const fp of filePaths) {
        try {
          const content = await extractFileContent(fp);
          if (content.trim()) texts.push(content);
        } catch (err) { console.error(`[ai-exam] Failed to extract ${fp}:`, err); }
      }
      const combined = texts.join('\n\n---\n\n');
      if (combined.trim().length < 30) throw new Error('Could not extract text from uploaded files.');

      console.log(`[ai-exam] QP text mode: ${combined.length} chars → Groq 70B`);
      const prompt = buildQPTextPrompt(combined, subject, grade, topicTitle);

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          onProgress?.('generating_ai');
          responseText = await callGroq(prompt);
          onProgress?.('parsing');
          questions = parseQuestions(responseText, effectiveCount);
          break;
        } catch (err) {
          if (attempt === 2) throw err;
          console.warn(`[ai-exam] QP text attempt ${attempt} failed, retrying:`, (err as Error).message);
        }
      }
    }
  } else {
    // ═══ Topic Mode: Generate questions from content ═══
    onProgress?.('extracting');
    const texts: string[] = [];
    for (const fp of filePaths) {
      try {
        const content = await extractFileContent(fp);
        if (content.trim()) texts.push(content);
      } catch (err) { console.error(`[ai-exam] Failed to extract ${fp}:`, err); }
    }

    const combined = texts.join('\n\n---\n\n');
    console.log(`[ai-exam] Topic mode: ${combined.length} chars from ${texts.length} file(s)`);
    if (combined.trim().length < 30) {
      throw new Error('Could not extract sufficient text from uploaded files.');
    }

    onProgress?.('building_prompt');
    const prompt = buildTopicPrompt(combined, subject, grade, topicTitle, effectiveCount);

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        onProgress?.('generating_ai');
        console.log(`[ai-exam] Topic attempt ${attempt}: generating ${effectiveCount} questions...`);
        responseText = await callGroq(prompt);
        onProgress?.('parsing');
        questions = parseQuestions(responseText, effectiveCount);
        break;
      } catch (err) {
        if (attempt === 2) throw err;
        console.warn(`[ai-exam] Attempt ${attempt} failed, retrying:`, (err as Error).message);
      }
    }
  }

  if (!questions || questions.length < 1) {
    throw new Error(`Only ${questions?.length || 0} valid questions extracted. Try re-generating.`);
  }

  onProgress?.('saving');
  return questions;
}
