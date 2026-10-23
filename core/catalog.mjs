export const fields = [
  { id: 'cs', name: '计算机科学', description: '从智能算法到数字世界', icon: 'cpu', topics: [
    ['cs.AI', '人工智能'], ['cs.LG', '机器学习'], ['cs.CL', '自然语言处理'], ['cs.CV', '计算机视觉'], ['cs.RO', '机器人'], ['cs.CR', '密码与安全'], ['cs.SE', '软件工程'], ['cs.HC', '人机交互'], ['cs.IR', '信息检索'], ['cs.DC', '分布式计算'], ['cs.MA', '多智能体系统'], ['cs.SD', '语音与音频'] ] },
  { id: 'physics', name: '物理学', description: '探索物质与宇宙的规律', icon: 'atom', topics: [ ['quant-ph', '量子物理'], ['astro-ph.GA', '星系天体物理'], ['astro-ph.CO', '宇宙学'], ['cond-mat.mtrl-sci', '材料科学'], ['cond-mat.mes-hall', '介观物理'], ['hep-th', '高能理论'], ['physics.optics', '光学'], ['gr-qc', '广义相对论'] ] },
  { id: 'math', name: '数学', description: '在抽象之中寻找秩序', icon: 'sigma', topics: [ ['math.OC', '优化与控制'], ['math.PR', '概率论'], ['math.NA', '数值分析'], ['math.CO', '组合数学'], ['math.NT', '数论'], ['math.AP', '偏微分方程'], ['math.ST', '统计理论'] ] },
  { id: 'stat', name: '统计与数据科学', description: '让数据成为新的洞察', icon: 'chart', topics: [ ['stat.ML', '统计机器学习'], ['stat.ME', '统计方法'], ['stat.AP', '应用统计'], ['stat.CO', '统计计算'], ['stat.TH', '统计理论'] ] },
  { id: 'bio', name: '生命科学', description: '理解生命的复杂与精妙', icon: 'leaf', topics: [ ['q-bio.NC', '神经与认知'], ['q-bio.GN', '基因组学'], ['q-bio.BM', '生物分子'], ['q-bio.QM', '定量方法'], ['q-bio.CB', '细胞行为'], ['q-bio.PE', '种群与进化'] ] },
  { id: 'econ', name: '经济与金融', description: '理解决策、市场与系统', icon: 'globe', topics: [ ['econ.EM', '计量经济学'], ['econ.TH', '经济理论'], ['econ.GN', '一般经济学'], ['q-fin.ST', '统计金融'], ['q-fin.PM', '投资组合管理'], ['q-fin.RM', '风险管理'] ] }
];
export const topicName = id => fields.flatMap(f => f.topics).find(t => t[0] === id)?.[1] || id;
export const defaultSettings = { field: 'cs', topics: ['cs.AI'], days: 90, keywords: '', baseUrl: '', model: '', onboarded: false };
export function validateSettings(input, previous = defaultSettings) {
  const s = { ...previous };
  for (const key of Object.keys(defaultSettings)) if (Object.hasOwn(input, key)) s[key] = input[key];
  const f = fields.find(f => f.id === s.field);
  if (!f || !Array.isArray(s.topics) || s.topics.length < 1 || s.topics.length > 4 || !s.topics.every(t => f.topics.some(x => x[0] === t))) throw new Error('请选择该方向下的 1–4 个二级方向。');
  s.topics = [...new Set(s.topics)];
  if (![30, 90, 180, 365].includes(s.days)) throw new Error('论文时间范围无效。');
  for (const key of ['keywords', 'baseUrl', 'model']) if (typeof s[key] !== 'string' || s[key].length > 300) throw new Error('设置内容过长或格式不正确。');
  s.keywords = s.keywords.trim(); s.baseUrl = s.baseUrl.trim().replace(/\/+$/, ''); s.model = s.model.trim();
  if (s.baseUrl) {
    let u; try { u = new URL(s.baseUrl); } catch { throw new Error('请输入完整的模型服务地址。'); }
    if (!(u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))) || u.username || u.password || u.search || u.hash) throw new Error('模型地址需要 HTTPS；本机服务可使用 HTTP。请勿在地址中包含密钥。');
  }
  if (typeof s.onboarded !== 'boolean') throw new Error('设置格式无效。');
  return s;
}
export function localDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function profileKey(settings, focus = null) {
  const parts = [settings.field, [...settings.topics].sort(), settings.days, settings.keywords];
  if (focus) parts.push(focus.groups);
  return JSON.stringify(parts);
}
