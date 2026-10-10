/* 共通: ヘルパー / タブ / 時計 / 幅の自動調整 / 大きさの保持 / AIプロンプト / ライブ取得(直接→Worker→公開プロキシ) */
const $=s=>document.querySelector(s),pad=n=>String(n).padStart(2,'0');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const yen=n=>(n>0?'+':'')+Math.round(n).toLocaleString('ja-JP')+'円';
const cls=n=>n>0?'up':n<0?'dn':'';
const fx=(n,d=2)=>n==null?'—':Number(n).toLocaleString('ja-JP',{minimumFractionDigits:d,maximumFractionDigits:d});
const pc=n=>n==null?'—':(n>0?'+':'')+n.toFixed(2)+'%';
const r2=x=>x==null||!isFinite(x)?null:Math.round(x*100)/100;
const lsGet=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const idb=(()=>{let p;const open=()=>p??=new Promise((res,rej)=>{const r=indexedDB.open('dt',1);r.onupgradeneeded=()=>r.result.createObjectStore('k');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
 return {get:async k=>{try{const db=await open();return await new Promise(res=>{const q=db.transaction('k').objectStore('k').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(null)})}catch(e){return null}},
  set:async(k,v)=>{try{const db=await open();db.transaction('k','readwrite').objectStore('k').put(v,k)}catch(e){}}}})();
let STARS=lsGet('stars',[]);const saveStars=()=>lsSet('stars',STARS);
const PROMPTS={};let TAB=(location.hash=='#trade')?'trade':'info';
const AIKEYS={info:[['market','市場分析'],['stock','銘柄分析'],['total','総合分析']],trade:[['t_sum','今日の総括'],['t_loss','負けパターン'],['t_time','時間帯'],['t_sym','銘柄別'],['t_fix','改善ポイント']]};
function showTab(t){TAB=t;history.replaceState(null,'','#'+t);['info','trade'].forEach(k=>{$('#v-'+k).classList.toggle('hide',k!=t);$('#t-'+k).classList.toggle('on',k==t)});
 $('#ticker').classList.toggle('hide',t!='info');
 $('#aibtns').innerHTML=AIKEYS[t].map(([k,l])=>`<button data-pk="${k}">${l}</button>`).join('');document.dispatchEvent(new Event('tabshow'))}
let nextM=0,nextN=0,onM=null,onN=null,onSec=null;
function tick(){const j=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Tokyo'})),hm=j.getHours()*60+j.getMinutes(),wd=j.getDay();
 $('#clock').textContent=j.toLocaleTimeString('ja-JP');
 const st=wd==0||wd==6?'休場日':hm>=540&&hm<690?'前場':hm>=690&&hm<750?'昼休み':hm>=750&&hm<930?'後場':'場外';
 $('#mstate').textContent=st;$('#mstate').className='st'+(st=='前場'||st=='後場'?' on':'');
 const iv=+$('#rate').value,n=Date.now();
 if(onM&&iv&&n>=nextM){nextM=n+iv*1000;onM()}if(onN&&n>=nextN){nextN=n+300000;onN()}if(onSec)onSec(j);
 $('#cd').textContent=iv?Math.max(0,Math.ceil((nextM-n)/1000))+'秒':'停止'}
function fitWidth(){const w=document.body.clientWidth;document.body.dataset.w=w>=1500?'l':w>=1000?'m':'s'}
new ResizeObserver(fitWidth).observe(document.body);fitWidth();
const cwOf=()=>{const c=$('#center');if(c)document.body.dataset.cw=c.clientWidth>=1000?'t':'c'};
new ResizeObserver(cwOf).observe($('#center'));cwOf();
/* ---- 各項目の大きさ(縦)と列の幅(横)を変更・保持 ---- */
function initPanels(){const Z=lsGet('sz',{}),ps=document.querySelectorAll('.p');
 ps.forEach(p=>{const h=p.querySelector('h3'),id=p.id||(h&&h.childNodes[0]?h.childNodes[0].textContent.trim():'');if(!id)return;p.dataset.pid=id;if(Z[id]&&p.id!='aipane')p.style.height=Z[id]+'px'});
 const ro=new ResizeObserver(es=>es.forEach(en=>{const p=en.target;if(!p.style.height||!p.offsetParent)return;const h=parseInt(p.style.height);if(!(h>=40))return;clearTimeout(p._t);p._t=setTimeout(()=>{const Z=lsGet('sz',{});Z[p.dataset.pid]=h;lsSet('sz',Z)},300)}));
 ps.forEach(p=>{if(p.dataset.pid)ro.observe(p)})}
const WD=lsGet('wd',{});for(const k in WD)document.body.style.setProperty('--'+k,WD[k]+'px');
const SPL={lw:{el:'#left',min:160,max:520,d:1},rw:{el:'#right',min:200,max:560,d:-1},dw:{el:'#drawer',min:320,max:1000,d:-1}};
document.addEventListener('pointerdown',e=>{const s=e.target.closest&&e.target.closest('.spl');if(!s)return;const k=s.dataset.sp,c=SPL[k],el=$(c.el);if(!el)return;e.preventDefault();s.classList.add('drag');
 const x0=e.clientX,w0=el.getBoundingClientRect().width;
 const mv=ev=>{const w=Math.max(c.min,Math.min(c.max,w0+c.d*(ev.clientX-x0)));document.body.style.setProperty('--'+k,w+'px');WD[k]=Math.round(w)};
 const up=()=>{s.classList.remove('drag');document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);lsSet('wd',WD)};
 document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up)});
/* ---- AI: プロンプトを作ってコピー → ChatGPT/Claudeを画面の右側に開く。閉じたら表示を元に戻す ---- */
function setPrompt(k){const f=PROMPTS[k];$('#ptx').value=f?f():'(このデータがまだありません)';$('#ptx').dataset.k=k;$('#pmsg').textContent='';document.querySelectorAll('#aibtns button').forEach(b=>b.classList.toggle('on',b.dataset.pk==k))}
async function copyPrompt(){const t=$('#ptx').value;try{await navigator.clipboard.writeText(t);$('#pmsg').textContent='コピーしました。AI側に貼り付けてください(Ctrl+V)'}catch(e){$('#ptx').select();$('#pmsg').textContent='テキストを選択しました。Ctrl+Cでコピーしてください'}}
let AIWIN=null,AIT=null;
function endSplit(){document.body.classList.remove('split');$('#splitc').checked=false;if(AIT){clearInterval(AIT);AIT=null}AIWIN=null;fitWidth();cwOf()}
async function openAI(which){if(!$('#ptx').value)setPrompt(AIKEYS[TAB][0][0]);const t=$('#ptx').value;await copyPrompt();
 const base=which=='gpt'?'https://chatgpt.com/':'https://claude.ai/new',q='?q='+encodeURIComponent(t),url=q.length<6000?base+q:base;
 const sw=screen.availWidth,w=Math.round(sw*.42),L=(screen.availLeft||0)+sw-w;
 const win=window.open(url,'aiwin','popup=yes,width='+w+',height='+screen.availHeight+',left='+L+',top='+(screen.availTop||0));
 if(!win){window.open(url,'_blank');$('#pmsg').textContent='ポップアップがブロックされたため新しいタブで開きました(この画面は分割しません)';return}
 AIWIN=win;$('#splitc').checked=true;document.body.classList.add('split');if(AIT)clearInterval(AIT);AIT=setInterval(()=>{if(!AIWIN||AIWIN.closed)endSplit()},500);
 $('#pmsg').textContent=(q.length<6000?'プロンプト入力済みで':'プロンプトをコピー済み。貼り付けてください: ')+'右側に開きました。AIの画面を閉じると、この画面は自動で元の大きさに戻ります'}
window.addEventListener('focus',()=>{if(AIWIN&&AIWIN.closed)endSplit()});
/* ---- ライブ取得: 直接 → Cloudflare Worker → 公開プロキシ の順に試し、成功した経路を記憶 ---- */
const DEFAULT_WORKER='https://tradeinfo.yusuke1028-jpn.workers.dev';
const LV={best:'',route:'',ok:null,worker:lsGet('worker',DEFAULT_WORKER),pub:lsGet('pub',true),t:0,n:0,tot:0,msg:'',lt:0,tests:null,snapOK:null,sw:0};
const PUB=[['公開プロキシ1',u=>'https://corsproxy.io/?url='+encodeURIComponent(u)],['公開プロキシ2',u=>'https://api.allorigins.win/raw?url='+encodeURIComponent(u)],['公開プロキシ3',u=>'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(u)]];
const chartUrl=s=>'https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(s)+'?range=1d&interval=1m';
async function getJ(url,ms=8000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{signal:c.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}
const WK=()=>LV.worker.replace(/\/+$/,'');
function rowFromChart(sym,j){try{const r=j.chart.result[0],m=r.meta,q=r.indicators.quote[0];return [sym,m.regularMarketPrice,m.chartPreviousClose,(q.open&&q.open[0])||m.regularMarketPrice,m.regularMarketDayHigh,m.regularMarketDayLow,m.regularMarketVolume||0,m.regularMarketTime,m.shortName||m.longName||'']}catch(e){return null}}
async function workerSnap(batch){if(LV.snapOK!==false){try{const j=await getJ(WK()+'/snap?s='+encodeURIComponent(batch.join(',')),20000);if(j&&j.rows){LV.snapOK=true;return j.rows}}catch(e){if(/HTTP 4\d\d/.test(e.message))LV.snapOK=false;else throw e}}
 const j=await getJ(WK()+'/multi?s='+encodeURIComponent(batch.join(','))+'&r=1d&i=1d',25000);return batch.map(x=>j[x]?rowFromChart(x,j[x]):null).filter(Boolean)}
function routes(){const R=[];if(LV.worker)R.push({name:'Cloudflare Worker',cap:45,gap:3000,run:async s=>getJ(LV.worker.replace(/\/+$/,'')+'/multi?s='+encodeURIComponent(s.join(','))+'&r=1d&i=1m',15000)});
 R.push({name:'直接',cap:24,gap:3000,run:async s=>{const o={};await Promise.all(s.map(async x=>{o[x]=await getJ(chartUrl(x))}));return o}});
 if(LV.pub)PUB.forEach(([n,f])=>R.push({name:n,cap:8,gap:15000,run:async s=>{const o={};await Promise.all(s.map(async x=>{o[x]=await getJ(f(chartUrl(x)),10000)}));return o}}));
 return R.sort((a,b)=>(b.name==LV.best)-(a.name==LV.best))}
async function liveBatch(syms){const errs=[];for(const r of routes()){try{const data=await r.run(syms.slice(0,r.cap));if(data&&Object.keys(data).length){LV.best=r.name;LV.route=r.name;LV.gap=r.gap;return data}}catch(e){errs.push(r.name+': '+(e.name=='AbortError'?'時間切れ':e.message))}}LV.route='';LV.msg=errs.join(' / ');throw new Error('全経路で失敗')}
const CUM=[[0,0],[30,.22],[90,.38],[150,.5],[210,.62],[270,.74],[330,1]];
const cumFrac=tm=>{tm=Math.max(0,Math.min(330,tm));for(let i=1;i<CUM.length;i++)if(tm<=CUM[i][0]){const a=CUM[i-1],b=CUM[i];return a[1]+(b[1]-a[1])*(tm-a[0])/(b[0]-a[0])}return 1};
/* 1日分の1分足(Yahoo chart)から、画面で使う指標を計算。前日分の指標(平均出来高・平均値幅・52週など)は全銘柄スナップショット(base)から借りる */
function liveFrom(j,base){const d=j.chart.result[0],m=d.meta,off=m.gmtoffset||0,q=d.indicators.quote[0],B=[];
 d.timestamp.forEach((t,i)=>{if(q.close[i]!=null&&q.high[i]!=null&&q.low[i]!=null)B.push([t,q.open[i],q.high[i],q.low[i],q.close[i],q.volume[i]||0])});if(!B.length)return null;
 const L=B[B.length-1],price=L[4],prev=m.chartPreviousClose??m.previousClose??(base&&base.prev);if(!prev)return null;
 const vol=B.reduce((a,b)=>a+b[5],0),hi=Math.max(...B.map(b=>b[2])),lo=Math.min(...B.map(b=>b[3])),o=B[0][1]||B[0][4],vwap=vol?B.reduce((a,b)=>a+(b[2]+b[3]+b[4])/3*b[5],0)/vol:null;
 const ch=n=>B.length>n?(L[4]/B[B.length-1-n][4]-1)*100:null,st=Math.max(1,Math.floor(B.length/60)),o15=B.slice(0,15),b=base||{};
 const tod=((L[0]+off)%86400)/60,tm=tod<=690?tod-540:tod<750?150:tod-750+150,exp=b.avgvol?b.avgvol*cumFrac(tm):0;
 return {price:r2(price),prev:r2(prev),open:r2(o),hi:r2(hi),lo:r2(lo),vol:Math.round(vol),vr:exp>0?r2(vol/exp):(b.vr||0),val:r2(price*vol/1e8),chg:r2((price/prev-1)*100),chgv:r2(price-prev),gap:r2((o/prev-1)*100),gapv:r2(o-prev),fo:r2((price/o-1)*100),vwap:r2(vwap),vd:vwap?r2((price/vwap-1)*100):null,m1:r2(ch(1)),m5:r2(ch(5)),m15:r2(ch(15)),rng:r2(hi-lo),used:b.atr?r2((hi-lo)/b.atr*100):null,orh:r2(Math.max(...o15.map(x=>x[2]))),orl:r2(Math.min(...o15.map(x=>x[3]))),orf:B.length>=15?1:0,spark:B.filter((_,i)=>i%st==0).map(x=>r2(x[4])),lt:L[0],vrl:1}}
async function testRoutes(){const out=[];const sym='^N225';
 const T=[['直接',()=>getJ(chartUrl(sym),6000)],...(LV.worker?[['Cloudflare Worker(/ping)',()=>getJ(WK()+'/ping',8000)],['Cloudflare Worker(株価取得)',()=>getJ(WK()+'/multi?s='+sym+'&r=1d&i=1m',12000)]]:[]),...PUB.map(([n,f])=>[n,()=>getJ(f(chartUrl(sym)),9000)])];
 for(const [n,f] of T){const t0=Date.now();try{await f();out.push([n,true,Date.now()-t0+'ms'])}catch(e){out.push([n,false,e.name=='AbortError'?'時間切れ':e.message==='Failed to fetch'||e.name=='TypeError'?'ブロックされました(CORS等)':e.message])}}LV.tests=out;return out}
function lvBadge(){const b=$('#lv');if(!b)return;const sw=window.SWP&&window.SWP.tot?` 全銘柄${window.SWP.n.toLocaleString()}/${window.SWP.tot.toLocaleString()}`:'';
 if(LV.ok===null&&!sw){b.textContent='ライブ: 接続中…';b.className='lvb'}else if(LV.ok||sw){b.textContent=`ライブ: ${LV.route||'Worker'} ${LV.ok?LV.n+'/'+LV.tot+'件':''}${sw} ${LV.t?new Date(LV.t).toLocaleTimeString('ja-JP'):''}`;b.className='lvb ok'}else{b.textContent='ライブ: 未接続(クリックで接続設定)';b.className='lvb bad'}}
function openLV(){const m=$('#lvm');m.classList.remove('hide');const T=LV.tests,sg=lsGet('swgap',60);
 m.innerHTML=`<div class="modal"><h3 style="position:static">ライブ取得の接続設定<button id="lvx">閉じる</button></h3>
 <p>株価はYahoo!ファイナンスのデータです。<b>データ元自体が約20分遅れ</b>(東証の無料配信ルール)ですが、ライブ取得を使うと、当サイト側の遅れを数秒〜1分にできます。ブラウザは通常Yahooに直接つなげないため、<b>あなたのCloudflare Worker</b>を経由します。</p>
 <table><tr><th>経路</th><th>結果</th></tr>${T?T.map(([n,ok,mm])=>`<tr><td>${esc(n)}</td><td class="${ok?'ok':'dn'}">${ok?'✓ 接続できました ':'✗ '}${esc(mm)}</td></tr>`).join(''):'<tr><td colspan="2" class="mu">「接続テスト」を押してください</td></tr>'}</table>
 <p class="mu">現在の経路: ${LV.ok?esc(LV.route):'未接続'} ${LV.msg?'/ '+esc(LV.msg):''}${LV.snapOK===false?' / ※Workerが旧版です(v2に更新すると通信量が約1/30になります)':''}</p>
 <h3 style="position:static">Worker のURL</h3>
 <div class="row"><input id="lvw" placeholder="https://xxxx.workers.dev" value="${esc(LV.worker)}" aria-label="Worker URL"><button id="lvs">保存</button></div>
 <h3 style="position:static">全銘柄スキャン(Worker経由)</h3>
 <div class="row"><label>間隔 <select id="lvg"><option value="30">30秒</option><option value="60">60秒</option><option value="120">2分</option><option value="0">手動のみ</option></select></label><button id="lvn">今すぐ全銘柄を更新</button></div>
 <p class="mu">全銘柄の1回のスキャン=約87リクエスト。60秒間隔で場中(6.5時間)に動かすと1日約3.4万リクエスト(無料枠は1日10万)。場外は15分に1回だけ更新します。</p>
 <label><input type="checkbox" id="lvp" ${LV.pub?'checked':''}> Workerが使えないときは公開プロキシも試す(不安定。少数の銘柄のみ)</label>
 <div class="row"><button id="lvt">接続テスト</button><span id="lvr" class="mu"></span></div></div>`;
 $('#lvg').value=String(sg);$('#lvg').onchange=e=>lsSet('swgap',+e.target.value);
 $('#lvx').onclick=()=>m.classList.add('hide');$('#lvs').onclick=()=>{LV.worker=$('#lvw').value.trim();lsSet('worker',LV.worker);LV.best='';LV.ok=null;LV.snapOK=null;$('#lvr').textContent='保存しました';nextM=0};
 $('#lvp').onchange=e=>{LV.pub=e.target.checked;lsSet('pub',LV.pub)};$('#lvn').onclick=()=>{if(window.SWEEP){window.SWEEP(true);$('#lvr').textContent='全銘柄の更新を開始しました(画面上部の進捗を見てください)'}};
 $('#lvt').onclick=async()=>{$('#lvr').textContent='テスト中…';await testRoutes();openLV()}}
/* ---- 初期化 ---- */
$('#t-info').onclick=()=>showTab('info');$('#t-trade').onclick=()=>showTab('trade');
$('#rate').value=String(lsGet('rate',5));$('#rate').onchange=()=>{lsSet('rate',+$('#rate').value);nextM=0};
$('#splitc').onchange=e=>{if(e.target.checked)document.body.classList.add('split');else endSplit()};
$('#aibtns').onclick=e=>{const b=e.target.closest('button[data-pk]');if(b)setPrompt(b.dataset.pk)};
$('#pcp').onclick=copyPrompt;$('#pgpt').onclick=()=>openAI('gpt');$('#pcl').onclick=()=>openAI('claude');
$('#lv').onclick=openLV;$('#rst').onclick=()=>{try{['sz','wd'].forEach(k=>localStorage.removeItem(k))}catch(e){}location.reload()};
document.addEventListener('keydown',e=>{if(e.key=='Escape')document.dispatchEvent(new Event('esc'))});
new ResizeObserver(()=>{const h=$('#hd');if(h)document.body.style.setProperty('--hh',h.offsetHeight+'px')}).observe($('#hd'));
initPanels();setInterval(tick,1000);
