import {fetchWikipediaIndex} from '../server/wikipedia-index.mjs';
import {writeFile,rename} from 'node:fs/promises';
import {fetchNasdaqDirectory,mergeUniverse} from '../server/universe.mjs';
/** Index URLs must supply authoritative JSON: {asOf:'YYYY-MM-DD',securities:[{symbol,name}]}. */
export async function fetchIndex(url,{fetcher=fetch,today=new Date(),maxAgeDays=14}={}){
 let u;try{u=new URL(url)}catch{throw Error('constituent URL missing or invalid')}
 if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('constituent URL must use HTTPS');
 const response=await fetcher(u,{signal:AbortSignal.timeout(20000),redirect:'error'});if(!response.ok)throw Error('constituent source unavailable');
 const data=await response.json();if(!/^\d{4}-\d{2}-\d{2}$/.test(data.asOf||'')||!Array.isArray(data.securities)||!data.securities.length)throw Error('invalid constituent source');
 const age=(today-Date.parse(data.asOf+'T00:00:00Z'))/86400000;if(age< -1||age>maxAgeDays)throw Error('constituent source is stale');
 const seen=new Set(),items=[];for(const x of data.securities){const symbol=String(x.symbol||'').trim().toUpperCase();if(!/^[A-Z0-9.\-]{1,15}$/.test(symbol)||seen.has(symbol))throw Error('invalid or duplicate constituent');seen.add(symbol);items.push({symbol,name:String(x.name||''),kind:'stock'})}
 return {asOf:data.asOf,securities:items};
}
async function main(){
 const urls={dow:process.env.DOW_CONSTITUENTS_URL,sp500:process.env.SP500_CONSTITUENTS_URL};
 const [nasdaq,...sources]=await Promise.all([fetchNasdaqDirectory(),...Object.entries(urls).map(async ([name,url])=>url?fetchIndex(url):fetchWikipediaIndex(name))]);
 const indexes=Object.fromEntries(Object.keys(urls).map((n,i)=>[n,sources[i].securities]));
 const universe=mergeUniverse({nasdaq,indexes});universe.indexSources=Object.fromEntries(Object.keys(urls).map((n,i)=>[n,{source:sources[i].source||'configured index feed',retrievedAt:sources[i].retrievedAt||new Date().toISOString(),asOf:sources[i].asOf||null,official:false}]));universe.createdAt=new Date().toISOString();
 const output=process.argv[2]||'universe.json',tmp=`${output}.${process.pid}.tmp`;await writeFile(tmp,JSON.stringify(universe));await rename(tmp,output);console.log(`Universe prepared: ${universe.securities.length} symbols`);
}
if(import.meta.url===new URL(process.argv[1], 'file:').href)main().catch(e=>{console.error(e.message);process.exitCode=1});
