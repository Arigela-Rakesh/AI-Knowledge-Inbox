import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import dns from 'dns/promises';
import { logger } from '../utils/logger';

const BLOCKED_HOSTS = ['169.254.169.254', 'metadata.google.internal'];
const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some(r => r.test(ip));
}

async function validateUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are allowed');
  }

  const hostname = parsed.hostname;

  if (hostname === 'localhost' || BLOCKED_HOSTS.includes(hostname)) {
    throw new Error('URL hostname is not allowed');
  }

  try {
    const addresses = await dns.resolve4(hostname).catch(() => dns.resolve6(hostname));
    for (const addr of addresses) {
      if (isPrivateIp(addr)) throw new Error('URL resolves to a private IP address');
    }
  } catch (err: unknown) {
    if ((err as Error).message.includes('private IP')) throw err;
    // DNS failure — let axios handle it
  }
}

export interface ExtractedContent {
  title: string;
  content: string;
  url: string;
}

export async function extractUrlContent(rawUrl: string): Promise<ExtractedContent> {
  await validateUrl(rawUrl);

  let html: string;
  try {
    const response = await axios.get<string>(rawUrl, {
      timeout: 15000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'AI-Knowledge-Inbox/1.0' },
      responseType: 'text',
      maxContentLength: 5 * 1024 * 1024, // 5MB
    });
    html = response.data;
  } catch (err: unknown) {
    const msg = (err as Error).message || 'Network error';
    throw new Error(`Failed to fetch URL: ${msg}`);
  }

  const $ = cheerio.load(html);

  // Remove noise
  $('script, style, nav, header, footer, aside, iframe, noscript, [role="navigation"], .ad, .advertisement, #cookie-banner').remove();

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().trim() ||
    'Untitled Page';

  // Extract main content
  const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post', '.entry'];
  let content = '';

  for (const sel of mainSelectors) {
    const text = $(sel).text().trim();
    if (text.length > 200) {
      content = text;
      break;
    }
  }

  if (!content) {
    content = $('body').text();
  }

  // Normalize whitespace
  content = content.replace(/\s+/g, ' ').trim();

  if (content.length < 50) {
    throw new Error('Extracted content is too short or empty');
  }

  logger.info('URL content extracted', { url: rawUrl, contentLength: content.length, title });

  return { title: title.slice(0, 500), content: content.slice(0, 100000), url: rawUrl };
}
