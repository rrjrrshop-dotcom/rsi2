/** Verified exception pairs: require both ticker and issuer text to reduce ticker-reuse risk.
 * SEC filings accessed 2026-11-10; unrecognized names remain unresolved.
 */
const VERIFIED_EXCEPTIONS={
 CDZIP:{issuer:'cadiz, inc.',kind:'preferred'}, MNSBP:{issuer:'mainstreet bancshares, inc.',kind:'preferred'},
 WAFDP:{issuer:'wafd, inc.',kind:'preferred'}, MDBH:{issuer:'mdb capital holdings, llc',kind:'stock'},
 ORGO:{issuer:'organogenesis holdings inc.',kind:'stock'}, STHO:{issuer:'star holdings',kind:'stock'}
};
/** Nasdaq official symbol directory format: pipe-separated, timestamp trailer. */
export function parseNasdaqDirectory(text){
 const lines=String(text).replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);if(lines.length<2)throw Error('empty directory');
 const head=lines[0].split('|');const required=['Symbol','Security Name','Test Issue','ETF'];for(const name of required)if(!head.includes(name))throw Error(`missing ${name}`);
 const index=Object.fromEntries(head.map((v,i)=>[v,i]));let out=[];
 for(const line of lines.slice(1)){if(line.startsWith('File Creation Time:'))continue;const fields=line.split('|');if(fields.length!==head.length)throw Error('malformed directory row');if(fields[index['Test Issue']]==='Y')continue;
  const symbol=fields[index.Symbol].trim(),name=fields[index['Security Name']].trim(),etf=fields[index.ETF]==='Y';
  if(!symbol||!name)continue;
  // Directory includes warrants, preferreds and units; classify only clear common-stock labels and ETFs.
  const verified=VERIFIED_EXCEPTIONS[symbol];
  if(verified&&name.toLowerCase().startsWith(verified.issuer)){out.push({symbol,name,kind:verified.kind,source:'nasdaq',classification:'verified_exception_2026-11-10'});continue}
  const common=/\b(common stock|ordinary shares?|common shares?|class [a-z] shares?|american depositary shares?|american depository shares?|american depositary receipts?|adss?|adrs?|new york registry shares?|subordinate voting shares?|class [a-z] capital stock|ord shares?|registered shares?|business development company|real estate investment trust)\b/i.test(name);
  const preferred=/\b(preferred (stock|shares?|class [a-z]|securities)|preference shares?)\b/i.test(name);
  const trustPreferred=/\btrust preferred securities\b/i.test(name);
  // Trust preferreds are hybrid instruments, not shares or ETFs.
  if(trustPreferred)continue;
  const excluded=/\b(warrants?|units?|rights?|notes?|bonds?|debentures?|closed.end fund)\b/i.test(name);
  if(etf||(common||preferred)&&!excluded)out.push({symbol,name,kind:etf?'etf':preferred?'preferred':'stock',source:'nasdaq'});
  else if(!excluded)out.push({symbol,name,kind:'unclassified',source:'nasdaq'});
 }
 return out;
}
/** Explicitly report whether index membership inputs were actually provided. */
export function mergeUniverse({nasdaq=[],indexes={}}){
 const names=['dow','sp500','nasdaq100'];const missing=names.filter(n=>!Array.isArray(indexes[n]));const unclassified=nasdaq.filter(x=>x.kind==='unclassified');const map=new Map();
 for(const item of nasdaq){if(item.symbol&&item.kind!=='unclassified')map.set(item.symbol,{...item,sources:[item.source||'nasdaq']})}
 for(const name of names){for(const item of indexes[name]||[]){const symbol=String(item.symbol||'').trim().toUpperCase().replace(/^([A-Z]+)-([A-Z])$/,'$1.$2');if(!symbol)continue;let r=map.get(symbol);if(r){if(!r.sources.includes(name))r.sources.push(name)}else map.set(symbol,{...item,symbol,sources:[name]})}}
 return {securities:[...map.values()],missingSources:missing,excludedSources:['russell3000'],unclassified,complete:missing.length===0&&unclassified.length===0};
}
/** Download Nasdaq's own current symbol directory. Index constituents are separate. */
export async function fetchNasdaqDirectory(fetcher=fetch){
 const response=await fetcher('https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt',{headers:{Accept:'text/plain'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`Nasdaq directory unavailable (${response.status})`);
 const text=await response.text();return parseNasdaqDirectory(text);
}
