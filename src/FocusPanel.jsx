import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, ChevronDown, LoaderCircle, MessageSquare, X } from 'lucide-react';
import { animateChange } from './transitions.js';

export default function FocusPanel({ focus, disabled, hasModel, onApply, onSettings }) {
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState(focus?.prompt || '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setDescription(focus?.prompt || ''); }, [focus?.prompt]);
  async function apply(value) {
    setPending(true); setError('');
    try { await onApply(value); animateChange(() => setExpanded(false)); }
    catch (e) { setError(e.message); }
    finally { setPending(false); }
  }
  return <section className="focus-panel" aria-label="后续推荐主题" aria-busy={pending}>
    <div className="focus-header"><MessageSquare size={18}/><div><strong>{focus ? focus.label : '用一句话，找到更想读的论文'}</strong><p>{focus ? '当前主题已保存，明天及后续每天默认沿用。' : '描述一个主题，让“再来一篇”和后续每日推荐更贴合兴趣。'}</p></div><button className="secondary" disabled={disabled || pending} aria-expanded={expanded} aria-controls="focus-editor" onClick={() => animateChange(() => setExpanded(!expanded))}>{expanded ? '收起' : focus ? '修改主题' : '描述主题'}<ChevronDown size={16} className={expanded ? 'rotated' : ''}/></button></div>
    {expanded && <div className="focus-editor" id="focus-editor">
      <label htmlFor="focus-description">想关注什么？一句话或一个关键词都可以</label>
      <textarea id="focus-description" maxLength={500} rows={3} value={description} disabled={pending || disabled} onChange={e => setDescription(e.target.value)} placeholder="例如：能在手机上运行的轻量化大语言模型"/>
      <div className="focus-help"><span>使用已配置的模型 API 理解主题；会发送这段描述和所选方向，可能产生调用费用。</span><span>{description.length}/500</span></div>
      {focus && <div className="focus-search-terms"><Check size={14}/><span>检索概念：{focus.groups.map(group => group.join(' / ')).join(' ＋ ')}</span></div>}
      {error && <p className="error-box" role="alert">{error}</p>}
      <div className="focus-actions">{focus && <button className="text-button" disabled={pending || disabled} onClick={() => apply('')}><X size={15}/>清除主题</button>}{!hasModel ? <button className="primary" onClick={onSettings}>先配置模型 API<ArrowRight size={16}/></button> : <button className="primary" disabled={disabled || pending || !description.trim()} onClick={() => apply(description)}>{pending ? <LoaderCircle size={17} className="spin"/> : <ArrowRight size={17}/>} {pending ? '正在更新主题与推荐…' : '保存主题并再来一篇'}</button>}</div>
      <p className="focus-note">与已选研究方向、时间范围及设置中的关键词共同筛选；找不到时可简化主题。清除后恢复按研究偏好推荐。</p>
    </div>}
  </section>;
}
