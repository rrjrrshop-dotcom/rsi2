// Pivots are confirmed only after a 5% reversal in completed closing prices.
export function waveState(bars, threshold=.05) {
 if(bars.length<30)return {points:[],stage:'',direction:0};
 const pivots=[];
 let high=0,low=0,direction=0,extreme=0;
 for(let i=1;i<bars.length;i++){
  const price=bars[i].close;
  if(!direction){
   if(price>bars[high].close)high=i;
   if(price<bars[low].close)low=i;
   if(price>=bars[low].close*(1+threshold)){direction=1;extreme=i;pivots.push(low)}
   else if(price<=bars[high].close*(1-threshold)){direction=-1;extreme=i;pivots.push(high)}
   continue;
  }
  const ratio=price/bars[extreme].close-1;
  if(ratio*direction>0)extreme=i;
  else if(ratio*direction<=-threshold){pivots.push(extreme);direction=-direction;extreme=i}
 }
 const points=[...pivots,...(direction?[extreme]:[])];
 if(points.length<3)return {points:[],stage:'',direction:0};
 const last=bars.at(-1).close;
 // Examine recent starts and prefer the longest valid count ending in the latest swing.
 for(let n=Math.min(9,points.length);n>=3;n--){
  const chosen=points.slice(-n), prices=chosen.map(i=>bars[i].close);
  const dir=Math.sign(prices[1]-prices[0]);
  const p=prices.map(x=>x*dir), end=last*dir;
  if(p[2]<=p[0]||end<=p[0])continue;
  if(n>=4&&p[3]<=p[1])continue;
  if(n>=5&&p[4]<=p[1])continue;
  if(n>=6&&(p[5]<=p[3]||p[3]-p[2]<Math.min(p[1]-p[0],p[5]-p[4])))continue;
  if(n>=8&&p[7]>=p[5])continue;
  if(n===9&&p[8]>=p[6])continue;
  const stage=['0','1','2','3','4','5','A','B','C'][n-1];
  const levels={2:0,3:2,4:1,5:4,A:5,B:5,C:7};
  const invalid=prices[levels[stage]];
  const side=['A','B','C'].includes(stage)?dir:-dir;
  if((last-invalid)*side>=0)continue;
  return {points:chosen,stage,direction:dir,invalid,side};
 }
 return {points:[],stage:'',direction:0};
}

export function historicalWaveRates(bars,current,{minimum=12}={}) {
 return [5,20].map(horizon=>{
  let n=0, up=0, down=0, flat=0;
  if(current.stage)for(let i=80;i+horizon<bars.length-1;i++){
   const sample=waveState(bars.slice(0,i+1));
   if(sample.stage!==current.stage||sample.direction!==current.direction)continue;
   const difference=bars[i+horizon].close-bars[i].close;
   if(difference>0)up++;else if(difference<0)down++;else flat++;
   n++;
   i+=horizon-1;
  }
  return {horizon,n,up,down,flat,available:n>=minimum};
 });
}
