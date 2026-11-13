/** Wikipedia lists are community maintained, not an official index feed. */
const PAGES={dow:'List_of_Dow_Jones_Industrial_Average_companies',sp500:'List_of_S%26P_500_companies'};
function text(html){return html.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi,'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;|&#160;/g,' ').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').trim().replace(/\s+/g,' ')}
export function parseIndexHtml(html,index){
 if(!PAGES[index])throw Error('unsupported index');
 const tables=String(html).match(/<table\b[\s\S]*?<\/table>/gi)||[];let matching=[];
 for(const table of tables){const trs=table.match(/<tr\b[\s\S]*?<\/tr>/gi)||[];if(!trs.length)continue;let headers=(trs[0].match(/<th\b[^>]*>[\s\S]*?<\/th>/gi)||[]).map(text),symbolIndex=headers.findIndex(x=>/^symbol$/i.test(x)),nameIndex=headers.findIndex(x=>/^(company|security)$/i.test(x));if(symbolIndex<0||nameIndex<0)continue;
  let found=[];for(const row of trs.slice(1)){const cells=(row.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi)||[]).map(text);if(cells.length<=Math.max(symbolIndex,nameIndex))continue;const symbol=cells[symbolIndex].replace(/\./g,'.').trim().toUpperCase();if(!/^[A-Z][A-Z0-9.\-]{0,14}$/.test(symbol))throw Error('invalid symbol in index table');found.push({symbol,name:cells[nameIndex],kind:'stock',source:'Wikipedia',index})}
  if(found.length)matching.push(found);
 }
 if(matching.length!==1)throw Error('index table not uniquely identified');const result=matching[0],unique=new Set(result.map(x=>x.symbol));if(unique.size!==result.length||index==='dow'&&result.length!==30||index==='sp500'&&(result.length<450||result.length>550))throw Error('index table incomplete or unexpected');return result;
}
export async function fetchWikipediaIndex(index,{fetcher=fetch,now=()=>new Date()}={}){
 if(!PAGES[index])throw Error('unsupported index');const url=`https://en.wikipedia.org/w/api.php?action=parse&prop=text&page=${PAGES[index]}&format=json&formatversion=2`;const res=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'RSI2-personal-research/1.0'},signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error('index source unavailable');const data=await res.json();if(typeof data?.parse?.text!=='string')throw Error('index source response invalid');return {securities:parseIndexHtml(data.parse.text,index),retrievedAt:now().toISOString(),source:'Wikipedia; community maintained; not official',page:`https://en.wikipedia.org/wiki/${PAGES[index]}`};
}
