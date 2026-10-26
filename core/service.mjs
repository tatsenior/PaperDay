import { validateSettings, localDay, profileKey } from './catalog.mjs';
import { canonicalId } from './papers.mjs';
import { generateSummary } from './ai.mjs';
import { interpretFocus, validateFocus } from './focus.mjs';
import { answerPaperQuestion } from './chat.mjs';
import { randomUUID, createHash } from 'node:crypto';
import {screenPapers,validateScreeningResults} from './screening.mjs';
export class PaperService {
  constructor(store, source, secrets, clock = () => new Date(), ai = generateSummary, focusAI = interpretFocus, chatAI = answerPaperQuestion, screeningAI = screenPapers) { this.store = store; this.source = source; this.secrets = secrets; this.clock = clock; this.ai = ai; this.focusAI = focusAI; this.chatAI = chatAI; this.screeningAI=screeningAI; this.asking = new Set(); this.queue = Promise.resolve(); this.summarizing = new Map(); }
  exclusive(fn) { const task = this.queue.then(fn); this.queue = task.catch(() => {}); return task; }
  snapshot() {
    const s = this.store.state;
    return { settings: { ...s.settings, hasKey: !!s.encryptedKey }, focus: s.focus || null, screening:s.screening || {enabled:false,prompt:''}, papers: s.papers, history: s.history, summaries: s.summaries, conversations: s.conversations || {}, daily: s.daily, today: localDay(this.clock()) };
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
  async setFocus(description) { return this.exclusive(async () => {
    if (typeof description !== 'string' || description.length > 500) throw new Error('请用 500 字以内的一句话或关键词描述主题。');
    const prompt = description.trim(), s = this.store.state;
    if (!prompt) { await this.store.update(next => { next.focus = null; }); return this.snapshot(); }
    if (s.focus?.prompt === prompt) return this.snapshot();
    if (!s.settings.baseUrl || !s.settings.model) throw new Error('请先在偏好设置中配置模型 API，再使用自然语言主题。');
    const key = s.encryptedKey ? await this.secrets.decrypt(s.encryptedKey) : '';
    const plan = validateFocus(await this.focusAI(prompt, s.settings, key));
    await this.store.update(next => { next.focus = { ...plan, prompt, model: s.settings.model, updatedAt: this.clock().toISOString() }; });
    return this.snapshot();
  }); }
  async setScreening(input){return this.exclusive(async()=>{
    if(!input || typeof input.enabled!=='boolean' || typeof input.prompt!=='string' || input.prompt.length>1000)throw new Error('请用1000字以内描述筛选要求。');
    const prompt=input.prompt.trim();
    if(input.enabled && !prompt)throw new Error('请先填写筛选要求。');
    if(input.enabled && (!this.store.state.settings.baseUrl||!this.store.state.settings.model))throw new Error('请先配置模型 API。');
    await this.store.update(s=>{s.screening={enabled:input.enabled,prompt};});return this.snapshot();
  });}
  async recommend(extra = false) { return this.exclusive(async () => {
    const s = this.store.state; const settings = { ...s.settings, focusGroups: s.focus?.groups || [] };
    if (!settings.onboarded) throw new Error('请先选择感兴趣的论文方向。');
    const now = this.clock(), day = localDay(now), profile = profileKey(settings, s.focus)+(s.screening?.enabled?':screen:'+createHash('sha256').update(JSON.stringify([s.screening.prompt,settings.baseUrl,settings.model])).digest('hex').slice(0,24):''), dailyKey = `${day}:${profile}`;
    if (!extra && s.daily[dailyKey] && s.papers[s.daily[dailyKey]]) return { paper: s.papers[s.daily[dailyKey]], cached: true, offline: false, state: this.snapshot() };
    const seen = new Set(s.history.map(h => h.id));
    const inRange = p => p.categories.some(c => settings.topics.includes(c)) && Date.parse(p.published) >= now.getTime() - settings.days * 86400000 && Date.parse(p.published) <= now.getTime();
    let candidates = (s.cache[profile]?.papers || []).filter(inRange);
    let offline = false;
    const choose = () => candidates.filter(p => !seen.has(p.id)).sort((a,b) => Date.parse(b.published) - Date.parse(a.published))[0];
    let paper,filterReason='';
    const screening=s.screening?.enabled,checked=new Set(),accepted=new Map();let calls=0;
    const chooseScreened=async()=>{
      if(!screening)return choose();
      if(!settings.baseUrl||!settings.model)throw new Error('模型筛选已开启，请先配置模型 API 或取消勾选。');
      while(calls<3){
        const batch=candidates.filter(p=>!seen.has(p.id)&&!checked.has(p.id)).sort((a,b)=>Date.parse(b.published)-Date.parse(a.published)).slice(0,15);
        if(!batch.length)break;
        const key=s.encryptedKey?await this.secrets.decrypt(s.encryptedKey):'';
        const verdicts=validateScreeningResults(await this.screeningAI(batch,s.screening.prompt,settings,key),batch,s.screening.prompt);calls++;
        batch.forEach(p=>checked.add(p.id));
        verdicts.filter(r=>r.status==='match').forEach(r=>accepted.set(r.id,r.reason));
        const found=batch.find(p=>accepted.has(p.id));if(found){filterReason=accepted.get(found.id);return found;}
      }
    };
    const fresh = s.cache[profile] && now.getTime() - Date.parse(s.cache[profile].at) < 3600000;
    if (fresh) paper = await chooseScreened();
    if (!paper) {
      try {
        for (let start = 0; start < 1000; start += 100) {
          const result = await this.source.search(settings, start, now);
          candidates = [...new Map([...candidates, ...result.papers.filter(inRange)].map(p => [p.id, p])).values()];
          paper = await chooseScreened();
          if (paper || (screening && calls>=3) || start + 100 >= result.total || !result.papers.length) break;
        }
        await this.store.update(next => { next.cache[profile] = { at: now.toISOString(), papers: candidates }; });
      } catch (error) { if(screening)throw error;paper = choose(); if (!paper) throw error; offline = true; }
    }
    if (!paper && screening)throw new Error('本次检查的候选中未找到有充分依据符合全部要求的论文（最多45篇、3批筛选（异常时最多6次调用））。未将候选记为已推荐；可简化要求、扩大时间范围或取消筛选。会议信息缺失时不会猜测录用状态。');
    if (!paper) throw new Error('当前范围内没有找到未推荐的论文（已检查最新 1000 条）。可扩大时间范围、调整方向、减少关键词，或简化推荐主题。');
    await this.store.update(next => {
      next.papers[paper.id] = paper;
      next.history.unshift({ id: paper.id, at: now.toISOString(), day, profile, kind: extra ? 'extra' : 'daily', favorite: false, read: false, ...(screening?{screening:{prompt:s.screening.prompt,reason:filterReason,model:settings.model}}:{}) });
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
  async askPaper(rawId, input) {
    const id=canonicalId(rawId);
    if(typeof input!=='string' || !input.trim() || input.length>2000)throw new Error('请输入 1–2000 字的论文问题。');
    const question=input.trim(), s=this.store.state, paper=s.papers[id];
    if(!paper)throw new Error('请先获取这篇论文。');
    if(!s.settings.baseUrl || !s.settings.model)throw new Error('请先在偏好设置中配置模型 API。');
    if(this.asking.has(id))throw new Error('这篇论文的回答仍在生成，请稍候。');
    this.asking.add(id);
    try {
      const key=s.encryptedKey?await this.secrets.decrypt(s.encryptedKey):'';
      const answer=await this.chatAI(paper,question,s.conversations?.[id] || [],s.settings,key);
      if(typeof answer!=='string' || !answer.trim() || answer.length>12000)throw new Error('模型没有返回有效回答，请重试。');
      const turn={id:randomUUID(),question,answer:answer.trim(),model:s.settings.model,at:this.clock().toISOString(),basis:'abstract'};
      await this.store.update(next=>{next.conversations ||= {};next.conversations[id]=[...(next.conversations[id] || []),turn].slice(-30);});
      return this.store.state.conversations[id];
    } finally {this.asking.delete(id);}
  }
  async updatePaper(rawId, patch) {
    const id = canonicalId(rawId);
    await this.store.update(s => {
      const item = s.history.find(h => h.id === id); if (!item) throw new Error('未找到阅读记录。');
      if(typeof patch.read==='boolean'){
        if(patch.read && !item.read)item.readAt=this.clock().toISOString();
        if(!patch.read)delete item.readAt;
        item.read=patch.read;
      }
      if(typeof patch.favorite==='boolean')item.favorite=patch.favorite;
    }); return this.snapshot();
  }
}
