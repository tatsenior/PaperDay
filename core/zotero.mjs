import {randomUUID} from 'node:crypto';
import {canonicalId} from './papers.mjs';
const base='http://127.0.0.1:23119/connector/';
const escapeHTML=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function zoteroItem(paper,summary,{pdf=true,notes=true}={}){
 const id=canonicalId(paper.id),url=`https://arxiv.org/abs/${id}`;
 const item={id,itemType:'journalArticle',title:paper.title,abstractNote:paper.abstract||'',date:paper.published?.slice(0,10)||'',publicationTitle:'arXiv',url,extra:`arXiv: ${id}`,libraryCatalog:'arXiv',creators:(paper.authors||[]).map(name=>({creatorType:'author',lastName:name,fieldMode:1})),tags:[{tag:'PaperDay'}],attachments:pdf?[{title:'arXiv PDF',url:`https://arxiv.org/pdf/${id}`,mimeType:'application/pdf'}]:[],notes:[]};
 if(notes&&summary){const sections=[['中文标题',summary.titleZh],['中文概述',summary.overview],['创新点（作者声称）',(summary.innovations||[]).join('\n')],['研究方法',summary.approach],['局限与待核实',summary.limitations]];item.notes=[{note:'<h2>PaperDay 中文解读</h2>'+sections.map(([title,value])=>`<h3>${title}</h3><p>${escapeHTML(value).replace(/\n/g,'<br>')}</p>`).join('')+`<p>AI 解读仅基于标题与摘要，未核验全文。模型：${escapeHTML(summary.model)}</p>`}];}
 return item;
}
export function paperRIS(paper,summary,options={}){
 const item=zoteroItem(paper,summary,options),line=x=>String(x||'').replace(/[\r\n]+/g,' ').trim();
 const fields=[['TY','JOUR'],['TI',item.title],...item.creators.map(a=>['AU',a.lastName]),['PY',item.date],['JO','arXiv'],['AB',item.abstractNote],['UR',item.url],['AN',canonicalId(paper.id)],['KW','PaperDay']];
 if(options.pdf!==false)fields.push(['L1',`https://arxiv.org/pdf/${canonicalId(paper.id)}`]);
 if(options.notes!==false&&summary)fields.push(['N1',`PaperDay AI 解读（仅基于标题与摘要）：${summary.titleZh||''}；概述：${summary.overview||''}；创新点：${(summary.innovations||[]).join('；')}；方法：${summary.approach||''}；局限：${summary.limitations||''}`]);
 return fields.map(([key,value])=>`${key}  - ${line(value)}`).join('\r\n')+'\r\nER  - \r\n';
}
export class ZoteroBridge{
 constructor(store,fetcher=fetch){this.store=store;this.fetcher=fetcher;this.pending=new Set();}
 async request(endpoint,body,writing=false){
  let response;try{response=await this.fetcher(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Zotero-Connector-API-Version':'3'},body:JSON.stringify(body),signal:AbortSignal.timeout(writing?30000:5000),redirect:'error'});}catch{throw new Error(writing?'Zotero 导入请求中断，可能已经保存部分内容。请先在 Zotero 核对，勿直接重复导入。':'未连接到本机 Zotero。请打开 Zotero 桌面端，或使用“导出 RIS”。');}
  if(!response.ok)throw new Error(writing?`Zotero 未确认导入成功（HTTP ${response.status}），请在 Zotero 核对后再试。`:`无法读取 Zotero 保存位置（HTTP ${response.status}）。可尝试导出 RIS。`);
  return response;
 }
 paper(rawId){const id=canonicalId(rawId),paper=this.store.state.papers[id];if(!paper)throw new Error('请先获取这篇论文。');return paper;}
 async target(rawId){const paper=this.paper(rawId);const response=await this.request('getSelectedCollection',{});let t;try{t=await response.json();}catch{throw new Error('Zotero 保存位置响应异常。');}
  if(!Number.isInteger(t.libraryID)||typeof t.libraryName!=='string'||(t.id!==null&&!Number.isInteger(t.id)))throw new Error('Zotero 保存位置格式异常。');
  const current={targetID:t.id===null?`L${t.libraryID}`:`C${t.id}`,libraryID:t.libraryID,collectionID:t.id??null,libraryName:t.libraryName,collectionName:typeof t.name==='string'?t.name:t.libraryName,editable:t.editable===true&&t.libraryEditable!==false,filesEditable:t.filesEditable!==false};
  const targets=[];let library=null,parents=[];
  for(const row of t.targets||[]){
   if(typeof row.id!=='string'||!/^([LC])\d+$/.test(row.id)||typeof row.name!=='string')continue;
   const level=Math.max(0,Math.min(20,Number(row.level)||0));
   if(row.id[0]==='L'){library={id:Number(row.id.slice(1)),name:row.name};parents=[];}
   if(!library)continue;
   if(row.id[0]==='C'){parents=parents.slice(0,Math.max(0,level-1));parents[level-1]=row.name;}
   targets.push({targetID:row.id,libraryID:library.id,collectionID:row.id[0]==='C'?Number(row.id.slice(1)):null,libraryName:library.name,collectionName:row.name,label:[library.name,...(row.id[0]==='C'?parents:[])].join(' / '),level,editable:true,filesEditable:row.filesEditable!==false,imported:this.store.state.zoteroImports?.[`${paper.id}:${library.id}`]||null});
  }
  if(!targets.some(r=>r.targetID===current.targetID))targets.push({...current,label:[current.libraryName,...(current.collectionID!==null?[current.collectionName]:[])].join(' / '),level:current.collectionID===null?0:1,imported:this.store.state.zoteroImports?.[`${paper.id}:${current.libraryID}`]||null});
  return{...current,imported:this.store.state.zoteroImports?.[`${paper.id}:${t.libraryID}`]||null,targets};
 }
 async save(rawId,options,expected){const paper=this.paper(rawId),id=paper.id;if(typeof options?.pdf!=='boolean'||typeof options?.notes!=='boolean')throw new Error('导入选项无效。');
  if(this.pending.has(id))throw new Error('这篇论文正在导入，请稍候。');this.pending.add(id);
  try{const current=await this.target(id);const target=expected?.targetID?current.targets.find(t=>t.targetID===expected.targetID):current;if(!target||!expected||target.libraryID!==expected.libraryID||target.collectionID!==expected.collectionID)throw new Error('Zotero 保存位置已变化或已删除，请刷新位置后再导入。');if(!current.editable)throw new Error('请先在 Zotero 中选中可写文库，再刷新位置。');if(!target.editable)throw new Error('当前 Zotero 保存位置不可写，请切换到可编辑文库。');
   if(target.imported)return{alreadyImported:true,at:target.imported.at};
   if(options.pdf&&!target.filesEditable)throw new Error('当前文库不允许保存附件，请取消 PDF 选项或更换文库。');
   const sessionID=randomUUID(),item=zoteroItem(paper,this.store.state.summaries[id],options);
   const response=await this.request('saveItems',{sessionID,uri:item.url,items:[item]},true);
   if(response.status!==201)throw new Error('Zotero 未返回保存完成确认，请先核对文库，避免重复导入。');
   let destination=target,placementWarning='';
   if(target.targetID!==current.targetID){try{await this.request('updateSession',{sessionID,target:target.targetID},true);}catch{destination=current;placementWarning='条目已创建，但归入所选位置未获确认。请在 Zotero 核对并手动整理，勿重复导入。';}}
   const record={at:new Date().toISOString(),libraryID:destination.libraryID,collectionID:destination.collectionID};let warning=placementWarning;
   try{await this.store.update(s=>{s.zoteroImports||={};s.zoteroImports[`${id}:${destination.libraryID}`]=record;});}catch{warning='条目已保存，但 PaperDay 本地导入记录未能保存，请勿重复导入。';}
   return{...record,warning,pdfRequested:options.pdf};
  }finally{this.pending.delete(id);}
 }
}
