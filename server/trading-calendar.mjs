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
const easternClock = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit',
 day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});

export function easternDate(now = new Date()) {
  const {year, month, day} = Object.fromEntries(easternClock.formatToParts(now).map(({type,value}) => [type,value]));
  return `${year}-${month}-${day}`;
}

export function isMarketDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function dataAgeDays(through, today) {
  if (!isMarketDate(through) || !isMarketDate(today) || through > today) throw Error('invalid data dates');
  return (Date.parse(today) - Date.parse(through)) / 86400000;
}

/** On Stocks Basic the confirmed grouped file is first collected at 20:30 New York time. */
export function collectionTarget(now = new Date()) {
  const parts = Object.fromEntries(easternClock.formatToParts(now).map(({type,value}) => [type,value]));
  const day = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  if (Number(parts.hour) * 60 + Number(parts.minute) < 20 * 60 + 30) day.setUTCDate(day.getUTCDate() - 1);
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

export function tradingWeekdays(after, through) {
  const date = new Date(after + 'T00:00:00Z');
  const days = [];
  for (date.setUTCDate(date.getUTCDate() + 1); date.toISOString().slice(0, 10) <= through; date.setUTCDate(date.getUTCDate() + 1)) {
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

