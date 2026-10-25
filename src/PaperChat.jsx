import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bot, ChevronDown, LoaderCircle, MessageSquare, Send } from 'lucide-react';
import api from './api.js';
import { animateChange } from './transitions.js';

export default function PaperChat({paper,turns=[],hasModel,disabled,onSaved,onSettings}) {
  const [open,setOpen]=useState(true),[question,setQuestion]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState('');
  const log=useRef(null),inFlight=useRef(false);
  useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;},[turns.length,pending]);
  async function send(event){
    event?.preventDefault();if(inFlight.current || disabled || !question.trim())return;
    const value=question.trim();inFlight.current=true;setPending(true);setError('');
    try {const result=await api.askPaper(paper.id,value);onSaved(paper.id,result);setQuestion('');}
    catch(e){setError(e.message);}finally{inFlight.current=false;setPending(false);}
  }
  return <section className="paper-chat" aria-label="当前论文问答" aria-busy={pending}>
    <div className="chat-heading"><MessageSquare size={20}/><div><h3>问问这篇论文</h3><p>{paper.title}</p></div><button className="icon-button" aria-label={open?'收起论文问答':'展开论文问答'} aria-expanded={open} onClick={()=>animateChange(()=>setOpen(!open))}><ChevronDown size={18} className={open?'rotated':''}/></button></div>
    {open&&<div className="chat-content"><p className="chat-basis"><Bot size={16}/>回答依据标题与摘要，未读取 PDF 全文。可追问背景和方法；摘要未提供的信息会提示核对原文。</p>
      {turns.length>0&&<div className="chat-log" ref={log} role="log" aria-label="本篇论文的对话记录" aria-live="polite">{turns.map(turn=><div className="chat-turn" key={turn.id}><div className="chat-question"><span>你</span><p>{turn.question}</p></div><div className="chat-answer"><span><Bot size={15}/>阅读助手 · {turn.model}</span><p>{turn.answer}</p></div></div>)}</div>}
      {!turns.length&&<div className="chat-suggestions">{['这篇论文解决什么问题？','创新点和已有方法有什么不同？','哪些结论需要读全文确认？'].map(text=><button key={text} disabled={pending || disabled} onClick={()=>setQuestion(text)}>{text}</button>)}</div>}
      {pending&&<p className="chat-pending" role="status"><LoaderCircle size={17} className="spin"/>正在根据当前论文摘要回答…</p>}
      {error&&<p className="error-box" role="alert">{error}</p>}
      {!hasModel?<button className="primary" onClick={onSettings}>先配置模型 API<ArrowRight size={16}/></button>:<form onSubmit={send}><label htmlFor={`paper-question-${paper.id}`}>关于这篇论文，你想了解什么？</label><textarea id={`paper-question-${paper.id}`} value={question} maxLength={2000} rows={3} disabled={pending || disabled} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();send();}}} placeholder="例如：这种方法适用于什么场景？摘要中有没有支持它的实验依据？"/><div className="chat-send"><span>{question.length}/2000 · Ctrl+Enter 发送</span><button className="primary" type="submit" disabled={pending || disabled || !question.trim()}>{pending?<LoaderCircle size={17} className="spin"/>:<Send size={17}/>}发送问题</button></div></form>}
      <p className="chat-privacy">问题、近期对话和本篇标题/摘要会发送到已配置的模型 API，可能产生费用。每篇论文独立保存最近 30 轮对话，回答仍需核对原文。</p>
    </div>}
  </section>;
}
