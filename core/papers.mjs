import { XMLParser, XMLValidator } from 'fast-xml-parser';
const list = x => x ? (Array.isArray(x) ? x : [x]) : [];
const clean = x => String(x || '').replace(/\s+/g, ' ').trim();
export function canonicalId(value) {
  const id = String(value).replace(/^https?:\/\/arxiv.org\/(abs|pdf)\//, '').replace(/\.pdf$/, '').replace(/v\d+$/, '');
  if (!/^(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})$/.test(id)) throw new Error('无效的 arXiv 论文编号。');
  return id;
}
export function parseFeed(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('论文源返回了无法解析的数据，请稍后重试。');
  const parsed = new XMLParser({ ignoreAttributes: false, processEntities: true }).parse(xml);
  if (!Object.hasOwn(parsed, 'feed')) throw new Error('论文源返回格式异常，请稍后重试。');
  const papers = list(parsed.feed.entry).flatMap(entry => {
    if (String(entry.id).includes('/api/errors')) throw new Error('论文检索请求未被 arXiv 接受。');
    let id; try { id = canonicalId(entry.id); } catch { return []; }
    if (!entry.title || !entry.summary || !Number.isFinite(Date.parse(entry.published))) return [];
    return [{ id, title: clean(entry.title), abstract: clean(entry.summary), authors: list(entry.author).map(a => clean(a.name)), published: entry.published, updated: entry.updated || entry.published, categories: list(entry.category).map(c => c['@_term']).filter(Boolean), url: `https://arxiv.org/abs/${id}`, pdfUrl: `https://arxiv.org/pdf/${id}` }];
  });
  return { papers, total: Number(parsed.feed['opensearch:totalResults']) || papers.length };
}
export function queryUrl(settings, start = 0, now = new Date()) {
  const from = new Date(now.getTime() - settings.days * 86400000);
  const stamp = d => d.toISOString().slice(0, 10).replaceAll('-', '');
  const terms = settings.keywords.split(/[,，]/).map(x => x.trim().replace(/[^\p{L}\p{N}\s-]/gu, '').slice(0, 80)).filter(Boolean).slice(0, 5);
  let q = `(${settings.topics.map(t => `cat:${t}`).join(' OR ')}) AND submittedDate:[${stamp(from)}0000 TO ${stamp(now)}2359]`;
  if (terms.length) q += ` AND (${terms.map(t => `(ti:"${t}" OR abs:"${t}")`).join(' OR ')})`;
  const u = new URL('https://export.arxiv.org/api/query');
  u.search = new URLSearchParams({ search_query: q, start: String(start), max_results: '100', sortBy: 'submittedDate', sortOrder: 'descending' });
  return u.toString();
}
export class ArxivSource {
  constructor(fetcher = fetch, delay = ms => new Promise(r => setTimeout(r, ms))) { this.fetcher = fetcher; this.delay = delay; this.lastRequest = 0; }
  async search(settings, start, now) {
    await this.delay(Math.max(0, 3100 - (Date.now() - this.lastRequest))); this.lastRequest = Date.now();
    let response;
    try { response = await this.fetcher(queryUrl(settings, start, now), { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'PaperDay/0.1 (personal academic reader)', Accept: 'application/atom+xml' } }); }
    catch { throw new Error('暂时无法连接 arXiv。请检查网络或系统代理后重试；阅读历史仍可离线查看。'); }
    if (!response.ok) throw new Error(response.status === 429 ? 'arXiv 请求较频繁，请稍后再试。' : `论文源暂时不可用（HTTP ${response.status}），请稍后重试。`);
    return parseFeed(await response.text());
  }
}
