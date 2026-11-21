import json, datetime
import FinanceDataReader as fdr
today=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date()
listing=fdr.StockListing('KRX')
required={'Code','Name','Marcap','Market'}
if not required.issubset(listing.columns): raise RuntimeError('KRX ranking columns unavailable')
# Ordinary shares only. Exclude preference shares, ETFs and funds from the company ranking.
listing=listing[listing['Market'].isin(['KOSPI','KOSDAQ'])]
listing=listing[~listing['Name'].str.contains(r'우$|우B$|우C$|스팩|리츠',regex=True)]
top=listing.sort_values('Marcap',ascending=False).head(5)
if len(top)!=5: raise RuntimeError('Five ranked Korean common stocks required')
rows=[]
for _,item in top.iterrows():
 bars=fdr.DataReader('NAVER:'+str(item['Code']),str(today-datetime.timedelta(days=800)))
 bars=bars[bars.index.strftime('%Y-%m-%d')<str(today)].tail(350)
 if len(bars)<252: raise RuntimeError('Insufficient completed Korean bars')
 data=[dict(date=str(date.date()),open=float(b.Open),high=float(b.High),low=float(b.Low),close=float(b.Close),volume=float(b.Volume)) for date,b in bars.iterrows()]
 rows.append(dict(symbol=str(item['Code']),name=item['Name'],marketCap=int(item['Marcap']),bars=data))
if len({row['bars'][-1]['date'] for row in rows})!=1: raise RuntimeError('Korean latest sessions do not match')
with open('/tmp/korea-five.json','w') as f: json.dump(dict(rows=rows,rankedAt=str(today)),f)
