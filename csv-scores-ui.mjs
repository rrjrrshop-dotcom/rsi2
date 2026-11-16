import {csvInputs,csvScores} from './csv-scores.mjs';
import {renderScoreCard,renderScoreGraphic} from './score-card.mjs';

function node(tag,text) {
 const element=document.createElement(tag);
 if(text)element.textContent=text;
 return element;
}

function csvDownload(label, filename, rows) {
 const link=node('a',label);
 const csv=rows.map(row=>row.join(',')).join('\r\n')+'\r\n';
 link.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
 link.download=filename;
 return link;
}

function exampleBars(closeOnly) {
 const rows=[];
 const date=new Date(Date.UTC(2025,0,2));
 while (rows.length<260) {
  const weekday=date.getUTCDay();
  if (weekday!==0&&weekday!==6) {
   const day=date.toISOString().slice(0,10);
   const close=100+rows.length+(rows.length%5);
   rows.push(closeOnly
    ? [day,'DEMO',close]
    : [day,'DEMO',close-1,close+2,close-3,close,100000+rows.length*100]);
  }
  date.setUTCDate(date.getUTCDate()+1);
 }
 return rows;
}

function templateControls(strategy) {
 const group=node('div');
 const closeOnly=strategy==='rsi2';
 const columns=closeOnly?['Date','Symbol','Close']:['Date','Symbol','Open','High','Low','Close','Volume'];
 const template=csvDownload('CSV 양식 다운로드','stocking-'+strategy+'-template.csv',[columns]);
 const example=csvDownload('예제 CSV 다운로드','stocking-'+strategy+'-example.csv',[columns,...exampleBars(closeOnly)]);
 const exampleNote=node('p','예제에는 가상 종목 DEMO의 일봉 260개가 있습니다. 내려받은 예제를 아래에서 선택하면 스코어 계산을 연습할 수 있습니다.');
 exampleNote.className='note';
 const help=node('p',strategy==='rsi2'
  ? 'Date는 거래일(YYYY-MM-DD), Symbol은 티커, Close는 종가입니다.'
  : 'Date는 거래일(YYYY-MM-DD), Symbol은 티커입니다. Open·High·Low·Close는 시가·고가·저가·종가, Volume은 거래량입니다.');
 help.className='note';
 const rows=node('p','거래일마다 한 줄을 입력하세요. 여러 종목을 넣을 때는 각 행에 티커를 입력하세요.'+
  (strategy==='box'?' 거래량이 빠진 행이 있으면 거래량 관련 조건이 미확인으로 표시될 수 있습니다.':''));
 rows.className='note';
 const links=node('div');
 links.className='row';
 links.append(template,example);
 group.append(links,exampleNote,help,rows);
 return group;
}

function render(strategy, rows, list) {
 list.replaceChildren();
 for (const row of csvScores(strategy,rows)) {
  const item=node('details');
  item.className='panel extra';
  const heading=node('summary');
  heading.append(node('strong',row.symbol),node('small',' · '+row.date+' · '));
  if(row.score)heading.append(renderScoreGraphic(row.score,{compact:true}));
  else heading.append(node('span','스코어 확인 불가'));
  item.append(heading,row.score?renderScoreCard(row.score,{listsOnly:true}):node('p',row.error));
  list.append(item);
 }
}

window.stockingCsvScores=rows=> {
 const list=document.getElementById('rsi2CsvScores');
 if (!rows) {list.replaceChildren();return}
 render('rsi2',rows,list);
};

const rsiCsv=document.getElementById('csv');
rsiCsv.closest('.row').before(templateControls('rsi2'));

for (const strategy of ['1000','trend','box','breakout']) {
 const panel=node('details'), heading=node('summary'), actions=node('div'), input=node('input');
 panel.className='panel extra';panel.dataset.csvStrategy=strategy;
 heading.append(node('h2','내 시세 파일로 분석하기(선택)'));
 actions.className='row';
 input.type='file';input.accept='.csv,text/csv';input.setAttribute('aria-label',strategy+' 시세 CSV 파일');
 const button=node('button','파일로 스코어 계산');button.type='button';
 const guide=node('p',csvInputs[strategy]+' · Symbol 열은 여러 종목을 구분할 때 사용합니다.');
 const status=node('p');status.className='note';status.setAttribute('role','status');
 const list=node('div');
 actions.append(input,button);
 panel.append(heading,guide,node('p','파일은 이 기기에서 분석합니다.'),templateControls(strategy),actions,status,list);
 if(strategy==='breakout')panel.append(node('p','돌파 스코어는 파일에 담긴 가격을 사용합니다. 배당 조정 여부는 파일에서 확인하세요.'));
 button.onclick=async()=>{
  list.replaceChildren();status.textContent='';button.disabled=true;
  try {
   const file=input.files[0];
   if(!file)throw Error('CSV 파일을 선택해 주세요.');
   render(strategy,window.parseCSV(await file.text()),list);
   status.textContent=list.childElementCount+'개 종목을 분석했습니다.';
  }catch(error){status.textContent=error.message}
  finally{button.disabled=false}
 };
 const section=document.getElementById('strategy-'+strategy);
 section.querySelector('[data-chart-guide]').after(panel);
}
