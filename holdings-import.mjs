const ticker = /^[A-Z][A-Z0-9.-]{0,14}$/;
const amount = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
const aliases = [
 ['ARM', /에이알엠|ARM홀딩/i], ['NBIS', /네비우스/], ['CRM', /세일즈포스/],
 ['SHOP', /쇼피파이/], ['SNOW', /스노우플레이크/], ['TEM', /템퍼스/],
 ['NVDA', /엔비디아/], ['DXYZ', /데스티니테크/], ['VRT', /버티브/],
 ['IONQ', /아이온큐/], ['SPCM', /스페이스[X엑].*(2배|트레이더)/i],
 ['BE', /블룸에너지/], ['SNXX', /TRADR.*(?:샌디스크|SND)/i], ['SNDK', /샌디스크/],
];

function number(text) {
 const normalized = text.trim().replace(/[−–~]/g, '-').replace(/(?:USD|주|\$)$/i, '');
 return amount.test(normalized) ? Number(normalized.replaceAll(',', '')) : null;
}
const byName = text => aliases.find(([, match]) => match.test(text.replace(/\s/g, '')))?.[0] ?? '';
const inColumn = (row, min, max) => row.words.filter(w => w.x >= min && w.x < max);
const readNumber = (row, min, max) => {
 const words = inColumn(row, min, max);
 return number(words.map(w => w.text).join('')) ?? words.map(w => number(w.text)).find(n => n !== null) ?? null;
};

export function purchaseDate(value) {
 const match=String(value??'').trim().match(/^(?:(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}))$/);
 if(!match)return '';
 const [,year,month,day,usMonth,usDay,usYear]=match;
 const date=[year||usYear,(month||usMonth).padStart(2,'0'),(day||usDay).padStart(2,'0')].join('-');
 const parsed=new Date(date+'T00:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:'';
}
export function readHoldingsImage(tsv, width) {
 const words = tsv.split(/\r?\n/).flatMap(line => {
  const [level,,,,,,left,top,w,h,,text] = line.split('\t');
  if (level !== '5' || !text?.trim()) return [];
  return [{text:text.trim(), x:(+left + +w/2)/width, y:+top + +h/2, h:+h}];
 }).sort((a,b) => a.y-b.y);
 const lines = [];
 for (const word of words) {
  const last = lines.at(-1);
  if (last && Math.abs(last.y-word.y) <= Math.max(5,word.h*.53)) last.words.push(word);
  else lines.push({y:word.y,h:word.h,words:[word]});
 }
 for (const row of lines) row.words.sort((a,b) => a.x-b.x);
 const header = lines.find(row => row.words.some(w => /^ticker$/i.test(w.text)) &&
  row.words.some(w => /^(company|transaction|shares|cost)/i.test(w.text)));
 if (header) {
  const x = key => header.words.find(w => w.text.toLowerCase()===key)?.x;
  const shares = x('shares'), cost = x('cost'), company = x('company') || x('ticker')+.1;
  return lines.filter(row => row.y > header.y && row.words.some(w => /^buy$/i.test(w.text))).flatMap(row => {
   const symbol = inColumn(row,0,company-.015).map(w => w.text).findLast(s => ticker.test(s) && s.length > 1);
   if (!symbol) return [];
   if (shares===undefined || cost===undefined) return [{symbol,qty:null,price:null,source:'수량·매입가 확인 필요'}];
   let qty = readNumber(row, shares-.042, (shares+cost)/2);
   const price = readNumber(row,(shares+cost)/2,cost+.025);
   const total = readNumber(row,cost+.025,cost+.091);
   if (qty === null && price>0 && total>0) {
    const estimate = Math.round(total/price);
    if (estimate>0 && Math.abs(total-estimate*price) <= estimate*.005+.01) qty=estimate;
   }
   return [{symbol,qty,price,...(row.words.some(w=>purchaseDate(w.text))&&{buyDate:row.words.map(w=>purchaseDate(w.text)).find(Boolean)}),source:'매입가 열'}];
  });
 }
 const marketRows = lines.filter(row => row.words.some(w => w.x>.57 && /USD$/i.test(w.text) && number(w.text)>0));
 if (marketRows.length >= 2) {
  return marketRows.map(top => {
   const bottom = lines.find(row => row.y>top.y && row.y<top.y+top.h*2.9 && row.words.some(w => w.x>.57 && /%/.test(w.text)));
   const name = inColumn(top,.16,.60).map(w => w.text).join(' ');
   const market = top.words.find(w => /USD$/i.test(w.text));
   const gainText = bottom ? inColumn(bottom,.55,1).map(w => w.text).join('').replace(/,(\d{4})(?=\()/,'.$1') : '';
   const gain = number(gainText.split('(')[0]);
   const qty = bottom ? readNumber(bottom,.16,.40) : null;
   const basis = number(market.text) - (gain ?? 0);
   return {symbol:byName(name),name,qty,
    price:qty>0 && gain!==null && basis>0 && /^[+−–~\-]/.test(gainText) ? Number((basis/qty).toFixed(4)) : null,
    source:'평가금액·평가손익으로 추정'};
  });
 }
 const candidates = lines.filter(row => readNumber(row,.59,.78)>0 && inColumn(row,0,.35).length);
 return candidates.flatMap(top => {
  const bottom = lines.find(row => row.y>top.y+top.h && row.y<top.y+top.h*4 && readNumber(row,.59,.78)>0);
  if (!bottom || inColumn(top,.79,1).some(w=>w.text.includes('%'))) return [];
  const nearby = lines.filter(row => row.y>top.y && row.y<=bottom.y+top.h*.32);
  const name = inColumn(top,0,.31).map(w=>w.text).join(' ');
  const symbol = byName(name) || nearby.flatMap(row => inColumn(row,0,.31))
   .map(w=>w.text.replace(/\.$/,'')).find(s=>ticker.test(s)&&s.length>=2) || '';
  const qty = nearby.map(row => readNumber(row,.33,.545)).find(n=>n>0) ?? null;
  if (!name || (!symbol && !qty)) return [];
  return [{symbol,name,qty,price:readNumber(top,.59,.78),source:'매입가 열'}];
 });
}

export function isSameHolding(existing, candidate) {
 return existing.symbol === candidate.symbol &&
  existing.price === candidate.price && existing.qty === candidate.qty;
}

export const duplicateHoldingMessage = symbol => symbol+' 종목은 매수가와 수량이 같은 항목이 이미 등록되어 있어 중복 저장할 수 없습니다.';

export function reconcileHoldings(current, rows) {
 const existing = new Set(current.map(item => item.symbol));
 const selected = new Map();
 const additions = rows.map(row => {
  const symbol = String(row.symbol).trim().toUpperCase();
  const qty = Number(row.qty), price = Number(row.price);
  if (!ticker.test(symbol) || !Number.isFinite(qty) || qty<=0 || !Number.isFinite(price) || price<=0) {
   throw Error('선택한 행의 티커·수량·매입가를 확인하세요.');
  }
  const candidate = {symbol,qty,price,...(purchaseDate(row.buyDate)&&{buyDate:purchaseDate(row.buyDate)})};
  if (current.some(item => isSameHolding(item,candidate)) ||
      (selected.has(symbol) && isSameHolding(selected.get(symbol),candidate))) {
   throw Error(duplicateHoldingMessage(symbol));
  }
  if (existing.has(symbol) || selected.has(symbol)) throw Error(symbol+' 종목이 중복됩니다. 한 행만 선택하거나 기존 항목을 수기로 수정하세요.');
  selected.set(symbol,candidate);
  return candidate;
 });
 return [...current,...additions];
}
