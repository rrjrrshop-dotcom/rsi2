/** Trading dates from a broad-market reference ETF's confirmed daily bars.
 * If the reference does not trade on an open session that date can be missed;
 * monitor the upstream freshness and provider data before relying on results.
 */
export function tradingDatesFromBars(bars,{minimum=200,asOf}={}){
 if(!Array.isArray(bars)||!/^\d{4}-\d{2}-\d{2}$/.test(asOf||''))throw Error('reference bars and asOf required');
 const dates=bars.map(b=>b.date);
 if(dates.some((d,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||(i&&dates[i-1]>=d)||d>asOf))throw Error('invalid or unordered reference dates');
 if(dates.length<minimum)throw Error(`insufficient reference trading days: ${dates.length}/${minimum}`);
 const last=dates.at(-1),age=(Date.parse(asOf+'T00:00:00Z')-Date.parse(last+'T00:00:00Z'))/86400000;
 if(age>7)throw Error(`reference bars are stale: ${last}`);
 return dates;
}
