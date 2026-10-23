import { validateSettings, localDay, profileKey } from './catalog.mjs';
import { canonicalId } from './papers.mjs';
import { generateSummary } from './ai.mjs';
export class PaperService {
  constructor(store, source, secrets, clock = () => new Date(), ai = generateSummary) { this.store = store; this.source = source; this.secrets = secrets; this.clock = clock; this.ai = ai; this.queue = Promise.resolve(); this.summarizing = new Map(); }
  exclusive(fn) { const task = this.queue.then(fn); this.queue = task.catch(() => {}); return task; }
  snapshot() {
    const s = this.store.state;
    return { settings: { ...s.settings, hasKey: !!s.encryptedKey }, papers: s.papers, history: s.history, summaries: s.summaries, daily: s.daily, today: localDay(this.clock()) };
  }
  async saveSettings(input) { return this.exclusive(async () => {
    const settings = validateSettings(input, this.store.state.settings);
    if (input.apiKey !== undefined && (typeof input.apiKey !== 'string' || input.apiKey.length > 4096)) throw new Error('API Key 格式无效。');
    let encrypted = this.store.state.encryptedKey;
    const oldUrl = this.store.state.settings.baseUrl;
    if (encrypted && oldUrl && settings.baseUrl && new URL(oldUrl).origin !== new URL(settings.baseUrl).origin && !input.apiKey?.trim() && input.clearKey !== true) throw new Error('更换模型服务域名时，请重新填写该服务的 API Key，或勾选移除旧密钥。');
    if (input.clearKey === true) encrypted = '';
    else if (input.apiKey?.trim()) encrypted = await this.secrets.encrypt(input.apiKey.trim());
    await this.store.update(s => { s.settings = settings; s.encryptedKey = encrypted; });
    return this.snapshot();
  }); }
  async recommend(extra = false) { return this.exclusive(async () => {
    const s = this.store.state; const settings = s.settings;
    if (!settings.onboarded) throw new Error('请先选择感兴趣的论文方向。');
    const now = this.clock(), day = localDay(now), profile = profileKey(settings), dailyKey = `${day}:${profile}`;
    if (!extra && s.daily[dailyKey] && s.papers[s.daily[dailyKey]]) return { paper: s.papers[s.daily[dailyKey]], cached: true, offline: false, state: this.snapshot() };
    const seen = new Set(s.history.map(h => h.id));
    const inRange = p => p.categories.some(c => settings.topics.includes(c)) && Date.parse(p.published) >= now.getTime() - settings.days * 86400000 && Date.parse(p.published) <= now.getTime();
    let candidates = (s.cache[profile]?.papers || []).filter(inRange);
    let offline = false;
    const choose = () => candidates.filter(p => !seen.has(p.id)).sort((a,b) => Date.parse(b.published) - Date.parse(a.published))[0];
    let paper;
    const fresh = s.cache[profile] && now.getTime() - Date.parse(s.cache[profile].at) < 3600000;
    if (fresh) paper = choose();
    if (!paper) {
      try {
        for (let start = 0; start < 1000; start += 100) {
          const result = await this.source.search(settings, start, now);
          candidates = [...new Map([...candidates, ...result.papers.filter(inRange)].map(p => [p.id, p])).values()];
          paper = choose();
          if (paper || start + 100 >= result.total || !result.papers.length) break;
        }
        await this.store.update(next => { next.cache[profile] = { at: now.toISOString(), papers: candidates }; });
      } catch (error) { paper = choose(); if (!paper) throw error; offline = true; }
    }
    if (!paper) throw new Error('当前范围内没有找到未推荐的论文（已检查最新 1000 条）。可在设置中扩大时间范围、调整方向或减少关键词。');
    await this.store.update(next => {
      next.papers[paper.id] = paper;
      next.history.unshift({ id: paper.id, at: now.toISOString(), day, profile, kind: extra ? 'extra' : 'daily', favorite: false, read: false });
      // Keep the day's first recommendation stable even after requesting extras.
      if (!next.daily[dailyKey]) next.daily[dailyKey] = paper.id;
    });
    return { paper, offline, cached: false, state: this.snapshot() };
  }); }
  async summarize(rawId) {
    const id = canonicalId(rawId);
    if (this.store.state.summaries[id]) return this.store.state.summaries[id];
    if (this.summarizing.has(id)) return this.summarizing.get(id);
    const paper = this.store.state.papers[id]; if (!paper) throw new Error('请先获取这篇论文。');
    const task = (async () => {
      const s = this.store.state, key = s.encryptedKey ? await this.secrets.decrypt(s.encryptedKey) : '';
      const summary = await this.ai(paper, s.settings, key);
      await this.store.update(next => { next.summaries[id] = summary; }); return summary;
    })();
    this.summarizing.set(id, task);
    try { return await task; } finally { this.summarizing.delete(id); }
  }
  async updatePaper(rawId, patch) {
    const id = canonicalId(rawId);
    await this.store.update(s => {
      const item = s.history.find(h => h.id === id); if (!item) throw new Error('未找到阅读记录。');
      for (const key of ['read', 'favorite']) if (typeof patch[key] === 'boolean') item[key] = patch[key];
    }); return this.snapshot();
  }
}
