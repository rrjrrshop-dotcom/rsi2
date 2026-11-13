import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';import {join} from 'node:path';
/** Caches successful market-wide snapshots locally; never caches failed/empty responses. */
export function snapshotStore(directory){
 function path(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('invalid date');return join(directory,`${date}.json`)}
 return {
  async read(date){try{const raw=JSON.parse(await readFile(path(date),'utf8'));if(raw.date!==date||!Array.isArray(raw.rows)||!raw.rows.length)throw Error('invalid cached snapshot');return raw.rows}catch(e){if(e.code==='ENOENT')return null;throw e}},
  async write(date,rows){if(!Array.isArray(rows)||!rows.length)throw Error('refusing empty market snapshot');await mkdir(directory,{recursive:true});const dest=path(date),tmp=`${dest}.${process.pid}.tmp`;await writeFile(tmp,JSON.stringify({date,rows}),'utf8');await rename(tmp,dest)}
 };
}
export function withSnapshotCache(store,fetchDaily){return async date=>{const cached=await store.read(date);if(cached)return cached;const rows=await fetchDaily(date);await store.write(date,rows);return rows}}
