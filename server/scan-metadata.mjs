/** Preserve source classifications in the displayed scan results. */
export function attachSecurityMetadata(result,securities){
 const map=new Map(securities.map(s=>[s.symbol,s]));const next={...result};
 for(const key of ['buy','waiting','insufficient','stale'])next[key]=(result[key]||[]).map(item=>{const meta=map.get(item.symbol);if(!meta)throw Error('scan symbol missing metadata');return {...item,securityType:meta.kind||'unknown',securityNote:meta.note||null}});
 return next;
}
