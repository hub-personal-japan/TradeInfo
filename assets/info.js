(()=>{
let D=null,S=[],BY=new Map(),NEWS=[],SEL='',OLD={},IOLD={},MINV=lsGet('minv',1);
const AS=lsGet('as',{q:'',sec:'',mk:'',sort:'val',page:0});
const fp=n=>n==null?'—':fx(n,Number.isInteger(n)?0:1),sg=n=>n>0?'+':'';
const fv=n=>n==null?'—':n>=1e4?(n/1e4).toFixed(n>=1e6?0:1)+'万':String(n);
const BD={'急騰':'<i class="up">↑</i>','急落':'<i class="dn">↓</i>','出来高急増':'<i class="ac">V</i>','GU':'<i class="up">G</i>','GD':'<i class="dn">G</i>'};
const bdg=h=>(h.tags||[]).map(t=>BD[t]).join('');
const fl=h=>{const o=OLD[h.code];return o==null||o===h.price?'':h.price>o?'fu':'fd'};
const nmc=h=>`<td>${bdg(h)}${esc(h.code)} ${esc(h.name)}</td>`;
const tr=(h,c)=>`<tr data-c="${esc(h.code)}"${h.code==SEL?' class="sel"':''}>${nmc(h)}${c}</tr>`;
const px=h=>`<td class="${fl(h)}">${fp(h.price)}</td>`,ch=h=>`<td class="${cls(h.chg)}">${pc(h.chg)}</td>`;
const star=c=>`<button data-star="${esc(c)}" style="padding:0 5px" aria-label="ウォッチ切替">${STARS.includes(c)?'★':'☆'}</button>`;
const srt=(f,d=1)=>A=>A.filter(h=>f(h)!=null).sort((a,b)=>d*(f(b)-f(a)));
const RK=[['値上がり率',srt(h=>h.chg),'前日比',h=>sg(h.chgv)+fp(h.chgv)+'円'],['値下がり率',srt(h=>h.chg,-1),'前日比',h=>sg(h.chgv)+fp(h.chgv)+'円'],
['出来高急増',srt(h=>h.vr),'出来高比',h=>(h.vr||0).toFixed(2)+'倍'],['売買代金',srt(h=>h.val),'売買代金',h=>(h.val||0).toFixed(1)+'億円'],
['ギャップアップ',srt(h=>h.gap),'寄付GAP',h=>pc(h.gap)],['ギャップダウン',srt(h=>h.gap,-1),'寄付GAP',h=>pc(h.gap)],
['VWAP乖離(上)',srt(h=>h.vd),'VWAP乖離',h=>pc(h.vd)],['VWAP乖離(下)',srt(h=>h.vd,-1),'VWAP乖離',h=>pc(h.vd)],['出来高×値動き(熱さ)',srt(h=>h.score),'熱さ',h=>(h.score||0).toFixed(1)]];
const pool=()=>S.filter(h=>(h.val||0)>=MINV);
function tags(h){h.score=Math.round((Math.min(h.vr||0,10)*2+Math.abs(h.chg)*3+Math.abs(h.gap)*1.5+Math.abs(h.vd||0))*10)/10;h.tags=[['急騰',h.chg>=3],['急落',h.chg<=-3],['出来高急増',h.vr>=2],['GU',h.gap>=2],['GD',h.gap<=-2]].filter(x=>x[1]).map(x=>x[0])}
const I=s=>D.index.find(x=>x.sym==s);
function dirItems(){const A=c=>c>0.3?['↑','up']:c<-0.3?['↓','dn']:['→','mu'],o=[];
 [['日経','^N225'],['TOPIX','1306.T'],['グロース','2516.T'],['SOX','^SOX']].forEach(([l,s])=>{const i=I(s);if(i){const a=A(i.chg);o.push([l,a[0]+' '+pc(i.chg),a[1]])}});
 const u=I('USDJPY=X');if(u){o.push(['為替',u.chg>0.3?'円安':u.chg<-0.3?'円高':'中立',u.chg>0.3?'up':u.chg<-0.3?'dn':'mu']);o.push(['USD/JPY',fx(u.price)+' '+pc(u.chg),cls(u.chg)])}
 const us=['^DJI','^IXIC','^GSPC'].map(I).filter(Boolean);if(us.length){const a=us.reduce((x,i)=>x+i.chg,0)/us.length;o.push(['米国市場',a>0.5?'強':a<-0.5?'弱':'中立',a>0.5?'up':a<-0.5?'dn':'mu'])}
 const f=I('NIY=F'),n=I('^N225');if(f&&n){const d=f.price-n.price;o.push(['先物',`現物比 ${sg(d)}${fx(d,0)}円`,cls(d)])}
 const v=I('^VIX');if(v)o.push(['VIX',fx(v.price)+(v.price>25?' 警戒':v.price>18?' やや高':' 低位'),v.price>25?'up':'']);
 const p=pool(),up=p.filter(h=>h.chg>0).length,dn=p.filter(h=>h.chg<0).length,av=p.reduce((x,h)=>x+h.chg,0)/(p.length||1);
 o.push([`対象${p.length}銘柄`,`上昇${up} / 下落${dn} / 平均${pc(av)}`,cls(av)]);return o}
function renderTop(){
 $('#idx').innerHTML=['^N225','1306.T','2516.T','NIY=F','USDJPY=X','^IXIC'].map(I).filter(Boolean).map(i=>{const o=IOLD[i.sym],f=o==null||o===i.price?'':i.price>o?'fu':'fd';return `<span><small>${esc(i.name)}</small> <b class="${f}">${fx(i.price,i.price<20?3:2)}</b> <span class="${cls(i.chg)}">${pc(i.chg)}</span></span>`}).join('');
 $('#idxt').innerHTML='<table><tr><th>指数・市場</th><th>現在値</th><th>前日比</th><th>前日比%</th><th>始値</th><th>高値</th><th>安値</th></tr>'+D.index.map(i=>{const d=i.price<20?3:2;return `<tr><td>${esc(i.name)}</td><td>${fx(i.price,d)}</td><td class="${cls(i.chgv)}">${sg(i.chgv)}${fx(i.chgv,d)}</td><td class="${cls(i.chg)}">${pc(i.chg)}</td><td>${fx(i.open,d)}</td><td>${fx(i.hi,d)}</td><td>${fx(i.lo,d)}</td></tr>`}).join('')+'</table>';
 $('#dir').innerHTML=dirItems().map(([l,v,c])=>`<span class="chip">${l} <b class="${c}">${v}</b></span>`).join('')}
function hotRows(){return pool().sort((a,b)=>b.score-a.score).slice(0,20)}
function renderStocks(){
 const P=pool();$('#poolinfo').textContent=`ランキング対象 ${P.length} / 全${S.length}銘柄`;
 $('#rks').innerHTML=RK.map(([t,f,hd,vf])=>`<section class="p s4"><h3>${t}</h3><table><tr><th>銘柄</th><th>現在値</th><th>前日比%</th><th>${hd}</th></tr>${f(P).slice(0,8).map(h=>tr(h,px(h)+ch(h)+`<td>${vf(h)}</td>`)).join('')}</table></section>`).join('');
 const H=hotRows(),pf=x=>pc(x);
 $('#hotT').innerHTML='<table><tr><th>銘柄</th><th>業種</th><th>現在値</th><th>前日比</th><th>前日比%</th><th>始値</th><th>高値</th><th>安値</th><th>寄付GAP</th><th>寄付比</th><th>出来高</th><th>出来高比</th><th>売買代金</th><th>VWAP</th><th>VWAP乖離</th><th>1分</th><th>5分</th><th>15分</th><th>値幅消化</th></tr>'+H.map(h=>tr(h,`<td class="mu">${esc(h.sector)}</td>${px(h)}<td class="${cls(h.chgv)}">${sg(h.chgv)}${fp(h.chgv)}</td>${ch(h)}<td>${fp(h.open)}</td><td>${fp(h.hi)}</td><td>${fp(h.lo)}</td><td class="${cls(h.gap)}">${pf(h.gap)}</td><td class="${cls(h.fo)}">${pf(h.fo)}</td><td>${fv(h.vol)}</td><td>${(h.vr||0).toFixed(2)}倍</td><td>${(h.val||0).toFixed(1)}億</td><td>${fp(h.vwap)}</td><td class="${cls(h.vd)}">${pf(h.vd)}</td><td class="${cls(h.m1)}">${pf(h.m1)}</td><td class="${cls(h.m5)}">${pf(h.m5)}</td><td class="${cls(h.m15)}">${pf(h.m15)}</td><td>${h.used==null?'—':h.used.toFixed(0)+'%'}</td>`)).join('')+'</table>';
 const c=(l,v,k)=>`<span><small>${l}</small> <b class="${k||''}">${v}</b></span>`;
 $('#hotC').innerHTML=H.map(h=>`<div class="card${h.code==SEL?' sel':''}" data-c="${esc(h.code)}"><div class="h"><span>${bdg(h)}${esc(h.code)} ${esc(h.name)} <span class="mu">${esc(h.sector)}</span></span><span class="${cls(h.chg)}">${fp(h.price)} ${pc(h.chg)}</span></div><div class="c">${c('前日比',sg(h.chgv)+fp(h.chgv),cls(h.chgv))}${c('始値',fp(h.open))}${c('高値',fp(h.hi))}${c('安値',fp(h.lo))}${c('GAP',pf(h.gap),cls(h.gap))}${c('寄付比',pf(h.fo),cls(h.fo))}${c('出来高',fv(h.vol))}${c('出来高比',(h.vr||0).toFixed(2)+'倍')}${c('売買代金',(h.val||0).toFixed(1)+'億')}${c('VWAP',fp(h.vwap))}${c('VWAP乖離',pf(h.vd),cls(h.vd))}${c('1分',pf(h.m1),cls(h.m1))}${c('5分',pf(h.m5),cls(h.m5))}${c('15分',pf(h.m15),cls(h.m15))}${c('値幅消化',h.used==null?'—':h.used.toFixed(0)+'%')}</div></div>`).join('');
 const g={};S.forEach(h=>{if((h.val||0)>=0.1)(g[h.sector]??=[]).push(h)});
 const SC=Object.entries(g).map(([k,a])=>{const w=a.reduce((x,h)=>x+h.val,0),top=a.filter(h=>h.val>=MINV).sort((x,y)=>y.chg-x.chg).slice(0,3);return {k,n:a.length,w:a.reduce((x,h)=>x+h.chg*h.val,0)/(w||1),m:a.reduce((x,h)=>x+h.chg,0)/a.length,val:w,vr:a.reduce((x,h)=>x+(h.vr||0),0)/a.length,top}}).sort((a,b)=>b.w-a.w);
 window.__SC=SC;
 $('#sec').innerHTML='<table><tr><th>業種</th><th>騰落率(代金加重)</th><th>単純平均</th><th>出来高比</th><th>売買代金</th><th>銘柄数</th><th>上位銘柄</th></tr>'+SC.map(s=>`<tr><td>${esc(s.k)}</td><td class="${cls(s.w)}">${pc(s.w)}</td><td class="${cls(s.m)}">${pc(s.m)}</td><td>${s.vr.toFixed(2)}倍</td><td>${s.val.toFixed(0)}億</td><td>${s.n}</td><td style="text-align:left">${s.top.map(t=>`${esc(t.name)} <span class="${cls(t.chg)}">${pc(t.chg)}</span>`).join(' / ')}</td></tr>`).join('')+'</table>';
 const W=STARS.map(c=>BY.get(c)).filter(Boolean);
 $('#wl').innerHTML=W.length?'<table><tr><th>銘柄</th><th>現在値</th><th>前日比%</th><th>出来高比</th><th>VWAP乖離</th><th>寄付GAP</th><th>売買代金</th><th></th></tr>'+W.map(h=>tr(h,px(h)+ch(h)+`<td>${(h.vr||0).toFixed(2)}倍</td><td class="${cls(h.vd)}">${pc(h.vd)}</td><td class="${cls(h.gap)}">${pc(h.gap)}</td><td>${(h.val||0).toFixed(1)}億</td><td>${star(h.code)}</td>`)).join('')+'</table>':'<div class="mu">下の全銘柄一覧の☆を押すとここに登録され、ライブ取得の対象になります</div>';
 renderAS()}
function renderAS(){
 let A=S;const q=AS.q.trim().toLowerCase();
 if(q)A=A.filter(h=>h.code.toLowerCase().includes(q)||h.name.toLowerCase().includes(q));if(AS.sec)A=A.filter(h=>h.sector==AS.sec);if(AS.mk)A=A.filter(h=>h.market==AS.mk);
 const k=AS.sort,f={val:h=>-(h.val||0),up:h=>-h.chg,down:h=>h.chg,vr:h=>-(h.vr||0),gapu:h=>-h.gap,gapd:h=>h.gap,code:h=>h.code}[k];
 A=A.slice().sort((a,b)=>k=='code'?(a.code<b.code?-1:1):f(a)-f(b));
 const pages=Math.max(1,Math.ceil(A.length/50));AS.page=Math.min(AS.page,pages-1);lsSet('as',AS);
 $('#aspg').textContent=`${A.length}銘柄 / ${AS.page+1}/${pages}ページ`;
 $('#ast').innerHTML='<table><tr><th>銘柄</th><th>市場</th><th>業種</th><th>現在値</th><th>前日比%</th><th>出来高</th><th>出来高比</th><th>売買代金</th><th>寄付GAP</th><th>値幅消化</th></tr>'+A.slice(AS.page*50,AS.page*50+50).map(h=>`<tr data-c="${esc(h.code)}"${h.code==SEL?' class="sel"':''}><td>${star(h.code)} ${bdg(h)}${esc(h.code)} ${esc(h.name)}</td><td class="mu">${esc(h.market||'')}</td><td class="mu">${esc(h.sector)}</td>${px(h)}${ch(h)}<td>${fv(h.vol)}</td><td>${(h.vr||0).toFixed(2)}倍</td><td>${(h.val||0).toFixed(1)}億</td><td class="${cls(h.gap)}">${pc(h.gap)}</td><td>${h.used==null?'—':h.used.toFixed(0)+'%'}</td></tr>`).join('')+'</table>'}
function renderDetail(){
 if(!S.length){$('#det').innerHTML='<div class="mu">データなし</div>';return}
 if(!SEL||!BY.has(SEL))SEL=(hotRows()[0]||S[0]).code;const h=BY.get(SEL);
 const kv=a=>'<div class="kg" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">'+a.map(([k,v,c])=>`<div><small>${k}</small><b class="${c||''}">${v}</b></div>`).join('')+'</div>',dist=v=>v==null?'—':pc((v/h.price-1)*100);
 let sp='';if(h.spark&&h.spark.length>1){const lo=Math.min(...h.spark,h.prev,h.vwap??1e18),hi=Math.max(...h.spark,h.prev,h.vwap??-1),Y=v=>66-(v-lo)/((hi-lo)||1)*60,X=i=>i/(h.spark.length-1)*300;
  sp=`<svg viewBox="0 0 300 70" preserveAspectRatio="none" style="width:100%;height:70px;display:block" role="img" aria-label="値動き"><line x1="0" x2="300" y1="${Y(h.prev)}" y2="${Y(h.prev)}" stroke="var(--mu)" stroke-dasharray="3"/>${h.vwap?`<line x1="0" x2="300" y1="${Y(h.vwap)}" y2="${Y(h.vwap)}" stroke="var(--ac)"/>`:''}<polyline fill="none" stroke="${h.chg>=0?'var(--up)':'var(--dn)'}" stroke-width="1.5" vector-effect="non-scaling-stroke" points="${h.spark.map((v,i)=>X(i)+','+Y(v)).join(' ')}"/></svg><div class="mu" style="font-size:11px">灰点線=前日終値 / 黄線=VWAP</div>`}
 $('#dt').textContent=`${h.code} ${h.name} / ${h.sector} / ${h.market||''}`;
 $('#det').innerHTML=`<div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap"><div class="big ${cls(h.chg)}">${fp(h.price)}</div><div class="${cls(h.chg)}" style="font-size:15px">${sg(h.chgv)}${fp(h.chgv)}円 (${pc(h.chg)})</div>${star(h.code)}</div>${sp}`
 +(h.intra?'':'<div class="mu">分足の指標(VWAP・1/5/15分・前日同時刻比)はこの銘柄では未取得です。☆登録または選択するとブラウザのライブ取得で補完されます(取得可能な場合)。</div>')
 +kv([['前日終値',fp(h.prev)],['始値',fp(h.open)],['高値',fp(h.hi)],['安値',fp(h.lo)],['出来高',fv(h.vol)+'株'],['前日同時刻',h.pv?fv(h.pv)+'株':'—'],['出来高比',(h.vr||0).toFixed(2)+'倍'],['平均出来高',fv(h.avgvol)+'株'],['売買代金',(h.val||0).toFixed(1)+'億円'],['寄付GAP',pc(h.gap),cls(h.gap)],['GAP金額',sg(h.gapv)+fp(h.gapv)+'円',cls(h.gapv)],['寄付比',pc(h.fo),cls(h.fo)],['VWAP',fp(h.vwap)],['VWAP乖離',pc(h.vd),cls(h.vd)],['時価総額','未対応'],['直近1分',pc(h.m1),cls(h.m1)],['直近5分',pc(h.m5),cls(h.m5)],['直近15分',pc(h.m15),cls(h.m15)],['当日値幅',fp(h.rng)+'円'],['平均日中値幅',fp(h.atr)+'円'],['値幅消化率',h.used==null?'—':h.used.toFixed(0)+'%']])
 +'<table><tr><th>重要価格</th><th>価格</th><th>現在値から</th></tr>'+[['前日高値',h.pyh],['前日安値',h.pyl],['前日終値',h.prev],['当日始値',h.open],['当日高値',h.hi],['当日安値',h.lo],['VWAP',h.vwap],['52週高値',h.h52],['52週安値',h.l52]].map(([k,v])=>`<tr><td>${k}</td><td>${fp(v)}</td><td class="${cls(v==null?0:v/h.price-1)}">${dist(v)}</td></tr>`).join('')+'</table>';
 const rel=S.filter(x=>x.sector==h.sector).sort((a,b)=>(b.val||0)-(a.val||0)).slice(0,15),avg=rel.reduce((x,y)=>x+y.chg,0)/(rel.length||1);
 $('#relt').textContent=h.sector+' 売買代金上位 平均 '+pc(avg);
 $('#rel').innerHTML='<table><tr><th>銘柄</th><th>現在値</th><th>前日比%</th><th>出来高比</th><th>売買代金</th></tr>'+rel.map(x=>tr(x,px(x)+ch(x)+`<td>${(x.vr||0).toFixed(2)}倍</td><td>${(x.val||0).toFixed(1)}億</td>`)).join('')+'</table>';
 const ns=NEWS.filter(n=>(n.codes||[]).includes(h.code)||n.title.includes(h.name)).slice(0,8);
 $('#snews').innerHTML=ns.length?ns.map(newsRow).join(''):'<div class="mu">該当ニュースなし</div>'}
const tm=n=>n.ts?new Date(n.ts*1000).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'--:--';
const newsRow=n=>`<div class="nw"><b class="ac">${tm(n)}</b> <a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a><br><small>${esc(n.src)} ${(n.tags||[]).length?'<span class="ac">'+esc(n.tags.join(' '))+'</span>':''}</small></div>`;
const renderAll=()=>{if(!D)return;renderTop();renderStocks();renderDetail()};
async function live(){if(LIVE.ok===false||!S.length)return;
 const ci=[...new Set([...STARS,SEL].filter(Boolean))].filter(c=>BY.has(c)).slice(0,30),ni=D.index.length,syms=[...D.index.map(i=>i.sym),...ci.map(c=>c+'.T')];
 const res=await Promise.allSettled(syms.map(liveQ));let ok=0;
 res.forEach((r,i)=>{if(r.status!='fulfilled')return;ok++;if(i<ni)Object.assign(D.index[i],r.value);else{const h=BY.get(ci[i-ni]);Object.assign(h,r.value);h.intra=1;tags(h)}});
 if(LIVE.ok===null)LIVE.ok=ok>0;$('#lv').textContent=ok?`ライブ取得 ${ok}/${syms.length}件`:'ライブ取得不可(ブラウザ制限)。Actionsのデータのみ使用中'}
async function loadMarket(){
 try{const r=await fetch('data/market.json?t='+Date.now());if(!r.ok)throw 0;const d=await r.json();
  OLD={};IOLD={};if(D){S.forEach(h=>OLD[h.code]=h.price);D.index.forEach(i=>IOLD[i.sym]=i.price)}
  D=d;S=d.stocks;BY=new Map(S.map(h=>[h.code,h]));
  const age=Math.round((Date.now()/1000-d.ts)/60);$('#upd').textContent=d.count?`データ ${d.asof.slice(5)} (${age}分前)`:'データ未生成';
  $('#mkt').textContent=d.count?`全${d.count}銘柄 / 分足あり${d.intraday}銘柄 / Yahoo側の遅延あり`:'GitHub ActionsのRun workflowを実行してください';
  const secs=[...new Set(S.map(h=>h.sector))].sort(),mks=[...new Set(S.map(h=>h.market).filter(Boolean))];
  $('#asec').innerHTML='<option value="">全業種</option>'+secs.map(s=>`<option>${esc(s)}</option>`).join('');$('#asec').value=AS.sec;
  $('#amk').innerHTML='<option value="">全市場</option>'+mks.map(s=>`<option>${esc(s)}</option>`).join('');$('#amk').value=AS.mk;
  await live();renderAll()}catch(e){$('#upd').textContent='データ取得失敗'}}
async function loadNews(){
 try{const d=await(await fetch('data/news.json?t='+Date.now())).json();NEWS=d.items||[];$('#nwt').textContent=d.asof;$('#news').innerHTML=NEWS.map(newsRow).join('')||'<div class="mu">ニュースなし</div>';if(D)renderDetail()}catch(e){}
 try{const e=await(await fetch('data/events.json?t='+Date.now())).json(),j=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Tokyo'})),now=pad(j.getHours())+':'+pad(j.getMinutes());let nx=true;
  $('#evd').textContent=e.date||'';$('#ev').innerHTML=(e.today||[]).map(([t,n])=>{const c=t<now?'past':nx?(nx=false,'next'):'';return `<div class="${c}"><b>${t}</b><span>${esc(n)}</span></div>`}).join('')+((e.upcoming||[]).length?'<div class="mu" style="margin-top:4px">今後の予定</div>'+e.upcoming.map(([d,t,n])=>`<div><b class="mu">${d.slice(5)} ${t}</b><span>${esc(n)}</span></div>`).join(''):'')}catch(x){}}
document.addEventListener('click',e=>{if(TAB!='info'||!D)return;const b=e.target.closest('[data-star]');
 if(b){const c=b.dataset.star;STARS=STARS.includes(c)?STARS.filter(x=>x!=c):[...STARS,c];saveStars();renderAll();nextM=0;return}
 const r=e.target.closest('[data-c]');if(r){SEL=r.dataset.c;renderAll();nextM=0}});
$('#mv').value=String(MINV);$('#mv').onchange=()=>{MINV=+$('#mv').value;lsSet('minv',MINV);renderAll()};
$('#aq').value=AS.q;$('#aq').oninput=()=>{AS.q=$('#aq').value;AS.page=0;renderAS()};
$('#asec').onchange=()=>{AS.sec=$('#asec').value;AS.page=0;renderAS()};$('#amk').onchange=()=>{AS.mk=$('#amk').value;AS.page=0;renderAS()};
$('#asort').value=AS.sort;$('#asort').onchange=()=>{AS.sort=$('#asort').value;AS.page=0;renderAS()};
$('#apv').onclick=()=>{AS.page=Math.max(0,AS.page-1);renderAS()};$('#anx').onclick=()=>{AS.page++;renderAS()};
/* AIプロンプト */
const L=h=>`${h.code} ${h.name}[${h.sector}] 現在値${fp(h.price)} 前日比${pc(h.chg)} 出来高比${(h.vr||0).toFixed(2)}倍 売買代金${(h.val||0).toFixed(1)}億円 寄付GAP${pc(h.gap)} 寄付比${pc(h.fo)} VWAP乖離${pc(h.vd)} 5分${pc(h.m5)} 15分${pc(h.m15)} 値幅消化${h.used==null?'-':h.used.toFixed(0)+'%'} ${(h.tags||[]).join('・')}`;
PROMPTS.market=()=>{if(!D||!S.length)return '';const ev=[];
 return `あなたは日本株デイトレード向けの市場整理アシスタントです。以下のデータだけを根拠に、(1)市場全体の状況 (2)本日監視対象になる銘柄(最大5つ。なぜ監視対象かを数値とニュース時刻で説明) (3)注意すべき材料・リスク を簡潔に整理してください。売買の推奨や利益の断定はせず、データにない情報は書かないでください。\n\n【データ時刻】${D.asof} JST(Yahoo!ファイナンス由来・遅延あり)\n\n【市場】\n${D.index.map(i=>`${i.name}: ${fx(i.price,i.price<20?3:2)} (${pc(i.chg)})`).join('\n')}\n\n【地合い判定】\n${dirItems().map(x=>x[0]+': '+x[1]).join(' / ')}\n\n【注目銘柄(熱さ上位20・売買代金${MINV}億円以上)】\n${hotRows().map(L).join('\n')}\n\n【業種(売買代金加重騰落率の上位/下位)】\n${(window.__SC||[]).slice(0,5).concat((window.__SC||[]).slice(-3)).map(s=>`${s.k} ${pc(s.w)}`).join(' / ')}\n\n【ニュース(時刻つき)】\n${NEWS.slice(0,12).map(n=>`${tm(n)} ${n.title}`).join('\n')}`};
PROMPTS.stock=()=>{if(!D||!BY.has(SEL))return '';const h=BY.get(SEL),rel=S.filter(x=>x.sector==h.sector&&x.code!=h.code).sort((a,b)=>(b.val||0)-(a.val||0)).slice(0,8),ns=NEWS.filter(n=>(n.codes||[]).includes(h.code)||n.title.includes(h.name)).slice(0,8);
 return `あなたは日本株デイトレード向けの分析アシスタントです。以下の銘柄データだけを根拠に、(1)現在の値動きと需給の整理 (2)注意すべき価格帯(前日高値・安値、VWAP、当日高安、52週高安)と現在値からの距離 (3)同業の動きとの比較 (4)リスク を事実ベースで整理してください。売買の推奨や利益の断定はしないでください。\n\n【対象】${L(h)}\n始値${fp(h.open)} 高値${fp(h.hi)} 安値${fp(h.lo)} 前日終値${fp(h.prev)} 前日高値${fp(h.pyh)} 前日安値${fp(h.pyl)} VWAP${fp(h.vwap)} 52週高値${fp(h.h52)} 52週安値${fp(h.l52)} 出来高${fv(h.vol)}株 前日同時刻${fv(h.pv)}株 平均出来高${fv(h.avgvol)}株 当日値幅${fp(h.rng)}円 平均日中値幅${fp(h.atr)}円\n\n【同業(売買代金上位)】\n${rel.map(L).join('\n')}\n\n【ニュース】\n${ns.length?ns.map(n=>`${tm(n)} ${n.title}`).join('\n'):'該当なし'}`};
window.NAMEOF=c=>BY.get(c)?.name;onM=loadMarket;onN=loadNews;
})();
