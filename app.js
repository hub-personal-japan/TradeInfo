/* 共通: ヘルパー / タブ / 時計 / 幅の自動調整 / ★ウォッチ / AIプロンプト(ChatGPT・Claudeを横に開く) / ブラウザ直取得(ライブ) */
const $=s=>document.querySelector(s),pad=n=>String(n).padStart(2,'0');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const yen=n=>(n>0?'+':'')+Math.round(n).toLocaleString('ja-JP')+'円';
const cls=n=>n>0?'up':n<0?'dn':'';
const fx=(n,d=2)=>n==null?'—':Number(n).toLocaleString('ja-JP',{minimumFractionDigits:d,maximumFractionDigits:d});
const pc=n=>n==null?'—':(n>0?'+':'')+n.toFixed(2)+'%';
const lsGet=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
let STARS=lsGet('stars',[]);const saveStars=()=>lsSet('stars',STARS);
const PROMPTS={};let TAB=(location.hash=='#trade')?'trade':'info';
function showTab(t){TAB=t;history.replaceState(null,'','#'+t);['info','trade'].forEach(k=>{$('#v-'+k).classList.toggle('hide',k!=t);$('#t-'+k).classList.toggle('on',k==t)});document.dispatchEvent(new Event('tabshow'))}
let nextM=0,nextN=0,onM=null,onN=null;
function tick(){const j=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Tokyo'})),hm=j.getHours()*60+j.getMinutes(),wd=j.getDay();
 $('#clock').textContent=j.toLocaleTimeString('ja-JP');
 const st=wd==0||wd==6?'休場日':hm>=540&&hm<690?'前場':hm>=690&&hm<750?'昼休み':hm>=750&&hm<930?'後場':'場外';
 $('#mstate').textContent=st;$('#mstate').className='st'+(st=='前場'||st=='後場'?' on':'');
 const iv=+$('#rate').value,n=Date.now();
 if(onM&&iv&&n>=nextM){nextM=n+iv*1000;onM()}if(onN&&n>=nextN){nextN=n+300000;onN()}
 $('#cd').textContent=iv?Math.max(0,Math.ceil((nextM-n)/1000))+'秒':'停止'}
function fitWidth(){const w=document.body.clientWidth;document.body.dataset.w=w>=1600?'l':w>=1000?'m':'s'}
new ResizeObserver(fitWidth).observe(document.body);fitWidth();
/* AIプロンプト(APIは使わず、プロンプトを作ってコピー→ChatGPT/Claudeを画面の右側に開く) */
function setPrompt(k){const f=PROMPTS[k];$('#pk').value=k;$('#ptx').value=f?f():'(この画面のデータがまだありません)';$('#pmsg').textContent='';$('#aidock').scrollIntoView({block:'nearest'})}
async function copyPrompt(){const t=$('#ptx').value;try{await navigator.clipboard.writeText(t);$('#pmsg').textContent='コピーしました。AI側に貼り付けてください(Ctrl+V)'}catch(e){$('#ptx').select();$('#pmsg').textContent='テキストを選択しました。Ctrl+Cでコピーしてください'}}
async function openAI(which){if(!$('#ptx').value)setPrompt($('#pk').value);const t=$('#ptx').value;await copyPrompt();
 const base=which=='gpt'?'https://chatgpt.com/':'https://claude.ai/new',q=(which=='gpt'?'?q=':'?q=')+encodeURIComponent(t),url=q.length<6000?base+q:base;
 $('#splitc').checked=true;document.body.classList.add('split');
 const sw=screen.availWidth,w=Math.round(sw*.42),L=(screen.availLeft||0)+sw-w;
 const win=window.open(url,'aiwin','popup=yes,width='+w+',height='+screen.availHeight+',left='+L+',top='+(screen.availTop||0));
 if(!win){window.open(url,'_blank');$('#pmsg').textContent='ポップアップがブロックされたため新しいタブで開きました。許可すると右側に開きます'}
 else $('#pmsg').textContent=(q.length<6000?'プロンプト入力済みで':'プロンプトをコピー済み。貼り付けてください: ')+'右側に開きました。表示が足りない場合は「分割表示」を外してください'}
/* ブラウザ直取得(試験的): Yahoo!ファイナンスをブラウザから直接取得して★銘柄・選択銘柄・指数をリアルタイムに近づける。ブラウザ制限で失敗した場合は自動で停止し、Actionsのデータだけを使う */
const LIVE={ok:null};const r2=x=>x==null||!isFinite(x)?null:Math.round(x*100)/100;
function buildQ(price,prev,o,hi,lo,vol,pv,avgvol,vwap,m,atr,pyh,pyl,h52,l52,spark){const ref=pv||avgvol;
 return {price:r2(price),prev:r2(prev),open:r2(o),hi:r2(hi),lo:r2(lo),vol:Math.round(vol),pv:Math.round(pv||0),avgvol:Math.round(avgvol||0),vr:ref?r2(vol/ref):0,val:r2(price*vol/1e8),chg:r2((price/prev-1)*100),chgv:r2(price-prev),gap:r2((o/prev-1)*100),gapv:r2(o-prev),fo:r2((price/o-1)*100),vwap:r2(vwap),vd:vwap?r2((price/vwap-1)*100):null,m1:r2(m[0]),m5:r2(m[1]),m15:r2(m[2]),rng:r2(hi-lo),atr:r2(atr),used:atr?r2((hi-lo)/atr*100):null,pyh:r2(pyh),pyl:r2(pyl),h52:r2(h52),l52:r2(l52),spark:spark.map(r2)}}
async function liveQ(sym){const r=await fetch('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+'?range=5d&interval=1m');if(!r.ok)throw 0;
 const d=(await r.json()).chart.result[0],m=d.meta,off=m.gmtoffset||0,q=d.indicators.quote[0],B=[];
 d.timestamp.forEach((t,i)=>{if(q.close[i]!=null&&q.high[i]!=null&&q.low[i]!=null)B.push([t,q.open[i],q.high[i],q.low[i],q.close[i],q.volume[i]||0])});
 const day=t=>Math.floor((t+off)/86400),tod=t=>(t+off)%86400,td=day(B[B.length-1][0]),T=B.filter(b=>day(b[0])==td),Y=B.filter(b=>day(b[0])<td),pd=day(Y[Y.length-1][0]),P=Y.filter(b=>day(b[0])==pd),days={};
 Y.forEach(b=>(days[day(b[0])]??=[]).push(b));const vs=Object.values(days).map(v=>v.reduce((a,x)=>a+x[5],0)),rs=Object.values(days).map(v=>Math.max(...v.map(x=>x[2]))-Math.min(...v.map(x=>x[3])));
 const vol=T.reduce((a,b)=>a+b[5],0),cut=tod(T[T.length-1][0]),pv=P.filter(b=>tod(b[0])<=cut).reduce((a,b)=>a+b[5],0),vwap=vol?T.reduce((a,b)=>a+(b[2]+b[3]+b[4])/3*b[5],0)/vol:null;
 const ch=n=>T.length>n?(T[T.length-1][4]/T[T.length-1-n][4]-1)*100:null,st=Math.max(1,Math.floor(T.length/60)),av=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
 return buildQ(m.regularMarketPrice||T[T.length-1][4],P[P.length-1][4],T[0][1]||T[0][4],Math.max(...T.map(b=>b[2])),Math.min(...T.map(b=>b[3])),vol,pv,av(vs),vwap,[ch(1),ch(5),ch(15)],av(rs)||null,Math.max(...P.map(b=>b[2])),Math.min(...P.map(b=>b[3])),m.fiftyTwoWeekHigh,m.fiftyTwoWeekLow,T.filter((_,i)=>i%st==0).map(b=>b[4]))}
/* 画面の初期化 */
$('#t-info').onclick=()=>showTab('info');$('#t-trade').onclick=()=>showTab('trade');
$('#rate').onchange=()=>{nextM=0};
$('#splitc').onchange=e=>document.body.classList.toggle('split',e.target.checked);
$('#pk').onchange=()=>setPrompt($('#pk').value);$('#pmk').onclick=()=>setPrompt($('#pk').value);$('#pcp').onclick=copyPrompt;
$('#pgpt').onclick=()=>openAI('gpt');$('#pcl').onclick=()=>openAI('claude');
$('#aibtn').onclick=()=>setPrompt(TAB=='trade'?'trade':'market');
setInterval(tick,1000);
