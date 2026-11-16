import {csvInputs,csvScores} from './csv-scores.mjs';
import {renderScoreCard,renderScoreGraphic} from './score-card.mjs';

function node(tag,text) {
 const element=document.createElement(tag);
 if(text)element.textContent=text;
 return element;
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
 panel.append(heading,guide,node('p','파일은 이 기기에서 분석합니다.'),actions,status,list);
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
