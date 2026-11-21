import {readFile} from 'node:fs/promises';
import {redisRest,redisSettings} from '../server/redis-rest.mjs';
import {scoreStrategy} from '../scores.mjs';
const input=JSON.parse(await readFile('/tmp/korea-five.json','utf8'));
const ids=['1000','trend','box','rsi2','breakout'];
for(const row of input.rows){
 row.scores=Object.fromEntries(ids.map(id=>[id,scoreStrategy(id,row.bars,row.symbol)]));
 row.date=row.bars.at(-1).date;
}
input.source='KRX listing / NAVER daily via FinanceDataReader';
input.through=input.rows[0].date;
await redisRest(redisSettings()).command(['SET','rsi2:korea-five',JSON.stringify(input)]);
console.log('Published Korean top five '+input.through+' with five strategy scores each');
