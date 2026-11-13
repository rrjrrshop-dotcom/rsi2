/** Build notification intentions without sending; persist state only after successful delivery. */
export function notificationPlan({date,scan,holdings=[],previous={}}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('invalid scan date');
 if(!scan||scan.expectedDate!==date||!Array.isArray(scan.buy)||!Array.isArray(scan.waiting)||!Array.isArray(scan.insufficient)||!Array.isArray(scan.stale))throw Error('invalid scan result');
 if(previous.lastScanDate&&date<previous.lastScanDate)throw Error('out-of-order scan');
 const statuses=new Map();for(const row of [...scan.buy,...scan.waiting])statuses.set(row.symbol,row);
 const old=previous.exits||{},next={...old},exit=[];
 for(const symbol of [...new Set(holdings.map(x=>String(x).trim().toUpperCase()))]){
  if(!/^[A-Z0-9.\-]{1,15}$/.test(symbol))throw Error('invalid holding symbol');
  const record=statuses.get(symbol);if(!record||typeof record.exit!=='boolean')continue;
  if(record.exit&&old[symbol]!==true)exit.push(symbol);
  next[symbol]=record.exit;
 }
 const buy=previous.buySentDate===date?[]:scan.buy.map(x=>x.symbol);
 return {date,buy,exit,nextState:{...previous,lastScanDate:date,exits:next,...(buy.length?{buySentDate:date}:{})}};
}
