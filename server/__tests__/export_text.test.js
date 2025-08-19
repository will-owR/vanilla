import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from '../index.js';
import appModule from '../index.js';

beforeAll(async () => {
  // Start server programmatically and ensure it listens
  await startServer({ listen: true });
});

afterAll(async () => {
  // Attempt graceful shutdown of Puppeteer/browser if exposed
  const browser = appModule.browser;
  if (browser && browser.close) {
    try {
      await browser.close();
    } catch (e) {}
  }
});

describe('Ebook export smoke', () => {
  it('POST /api/export/book returns a PDF buffer and contains poem text', async () => {
    const res = await request('http://localhost:3000')
      .post('/api/export/book')
      .send({})
      .set('Content-Type', 'application/json')
      .timeout(20000);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    const buf = res.body;
    // Buffer may be binary; check magic bytes
    const magic = Buffer.from(buf).slice(0, 5).toString('utf8');
    expect(magic.startsWith('%PDF-')).toBe(true);

    // Save and extract text via pdf-parse to verify content
    const outPath = path.resolve('samples', 'test_ebook.pdf');
    fs.writeFileSync(outPath, buf);
    const pdf = await import('pdf-parse');
    const data = fs.readFileSync(outPath);
    const parsed = await pdf.default(data);
    expect(parsed.text).toMatch(/A Summer Day/);
    expect(parsed.text).toMatch(/Midsummer Night/);
  }, 30000);
});
