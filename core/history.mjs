export function filterHistory(history, papers, summaries, {days=0,status='all',search='',favorites=false}={}, now=new Date()) {
  const end=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  const start=days ? new Date(now.getFullYear(),now.getMonth(),now.getDate()-days+1) : null;
  const query=search.trim().toLowerCase();
  return history.filter(entry=>{
    const paper=papers[entry.id]; if(!paper || (favorites&&!entry.favorite))return false;
    if(status==='read'&&!entry.read || status==='unread'&&entry.read)return false;
    const at=status==='read' ? entry.readAt || entry.at || entry.day : entry.at || entry.day;
    const date=typeof at==='string' && /^\d{4}-\d{2}-\d{2}$/.test(at) ? new Date(...at.split('-').map((v,i)=>Number(v)-(i===1?1:0))) : new Date(at);
    if(start && (!Number.isFinite(date.getTime()) || date<start || date>=end))return false;
    return !query || `${paper.title} ${summaries[entry.id]?.titleZh||''} ${(paper.authors||[]).join(' ')}`.toLowerCase().includes(query);
  }).sort((a,b)=>status==='read' ? String(b.readAt||b.at||b.day).localeCompare(String(a.readAt||a.at||a.day)) : String(b.at||b.day).localeCompare(String(a.at||a.day)));
}
