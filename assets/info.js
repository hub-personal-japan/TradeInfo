(()=>{
let D=null,S=[],BY=new Map(),NEWS=[],NC={},SEL='',OLD={},IOLD={},SECW={},EV=null,OPEN=false,LASTMIN=-1;
const ST=Object.assign({mode:'hot',q:'',page:0,minv:1},lsGet('st',{}));
const fp=n=>n==null?'—':fx(n,Number.isInteger(n)?0:1),sg=n=>n>0?'+':'';
const fv=n=>n==null?'—':n>=1e4?(n/1e4).toFixed(n>=1e6?0:1)+'万':String(n);
const clamp=(x,m)=>Math.min(Math.max(x,0),m),I=s=>D&&D.index.find(x=>x.sym==s);
const fl=h=>{const o=OLD[h.code];return o==null||o===h.price?'':h.price>o?'fu':'fd'};
const star=c=>`<button data-star="${esc(c)}" style="padding:0 5px" aria-label="ウォッチ切替">${STARS.includes(c)?'★':'☆'}</button>`;
const arrow=v=>v>=1.5?'↑↑':v>=0.3?'↑':v<=-1.5?'↓↓':v<=-0.3?'↓':'→';
/* 熱さスコア(0-100): 内訳を必ず表示する */
function heat(h){const nc=NC[h.code]||0,vd=h.vd==null?0:h.vd;
 const b=[['値動き(騰落率)',clamp(Math.abs(h.chg)/10,1)*25,25],['出来高倍率',clamp((h.vr||0)/5,1)*25,25],['寄付GAP',clamp(Math.abs(h.gap)/5,1)*15,15],['売買代金',clamp(Math.log10((h.val||0)+1)/Math.log10(501),1)*15,15],['VWAP乖離',clamp(Math.abs(vd)/3,1)*10,10],['ニュース件数',clamp(nc/3,1)*10,10]];
 h.hb=b.map(x=>[x[0],Math.round(x[1]*10)/10,x[2]]);h.hs=Math.round(b.reduce((a,x)=>a+x[1],0))}
const anom=h=>(Math.abs(h.chg)>=5&&(h.vr||0)>=2)||(h.vr||0)>=4||Math.abs(h.gap)>=5||(h.m5!=null&&Math.abs(h.m5)>=2);
const why=h=>{const o=[];if(h.chg>=3)o.push('急騰');if(h.chg<=-3)o.push('急落');if((h.vr||0)>=2)o.push('出来高'+h.vr.toFixed(1)+'倍');if(Math.abs(h.gap)>=2)o.push('GAP'+pc(h.gap));if((h.val||0)>=100)o.push('大商い');if(h.vd!=null&&Math.abs(h.vd)>=1.5)o.push(h.vd>0?'VWAPより上':'VWAPより下');if(NC[h.code])o.push('ニュース'+NC[h.code]+'件');if(anom(h))o.push('異常値');return o};
function prep(){NC={};NEWS.forEach(n=>(n.codes||[]).forEach(c=>NC[c]=(NC[c]||0)+1));
 const g={};S.forEach(h=>{if((h.val||0)>=0.1)(g[h.sector]??=[]).push(h)});SECW={};
 Object.entries(g).forEach(([k,a])=>{const w=a.reduce((x,h)=>x+h.val,0)||1;SECW[k]={k,w:a.reduce((x,h)=>x+h.chg*h.val,0)/w,m:a.reduce((x,h)=>x+h.chg,0)/a.length,val:w,n:a.length,vr:a.reduce((x,h)=>x+(h.vr||0),0)/a.length,list:a}});
 const n=I('^N225'),nc=n?n.chg:0;S.forEach(h=>{heat(h);h.rs=r2(h.chg-nc);h.rss=SECW[h.sector]?r2(h.chg-SECW[h.sector].w):null})}
/* 市場状態 */
function regime(){const t=I('^N225'),x=I('1306.T'),us=['^IXIC','^SOX','^GSPC'].map(I).filter(Boolean),v=I('^VIX'),u=I('USDJPY=X');
 const P=S.filter(h=>(h.val||0)>=0.1),up=P.filter(h=>h.chg>0).length,dn=P.filter(h=>h.chg<0).length,flat=P.length-up-dn;
 const trend=Math.round(clamp(50+((t?t.chg:0)+(x?x.chg:0))/2*20,100)),ext=Math.round(clamp(50+(us.reduce((a,i)=>a+i.chg,0)/(us.length||1))*15,100)),br=P.length?Math.round(up/(up+dn||1)*100):50,vol=v?Math.round(clamp((v.price-12)/18*100,100)):null;
 const tot=Math.round((trend+ext+br)/3),label=tot>=60?'↑ 上昇':tot<=40?'↓ 下降':'→ レンジ';
 const sc=Object.values(SECW).filter(s=>s.val>=20).sort((a,b)=>b.w-a.w);return {trend,ext,br,vol,tot,label,up,dn,flat,n:P.length,theme:sc[0],warn:sc.slice(-2).reverse(),u,sc}}
function renderLeft(){const R=regime(),m=(l,v,note)=>`<div class="meter"><span style="width:84px">${l}</span><span class="tr"><i style="width:${v==null?0:v}%"></i></span><b>${v==null?'—':v}</b><span class="mu">${note||''}</span></div>`;
 $('#regime').innerHTML=`<div style="font-size:18px;font-weight:600" class="${R.tot>=60?'up':R.tot<=40?'dn':''}">${R.label}<span class="mu" style="font-size:12px"> 総合 ${R.tot}/100</span></div>`
 +m('日本株指数',R.trend,'日経・TOPIX')+m('外部環境',R.ext,'米株・SOX')+m('値上がり比率',R.br,`${R.up.toLocaleString()}上昇/${R.dn.toLocaleString()}下落`)+m('VIX(恐怖指数)',R.vol,R.vol==null?'':R.vol>66?'高':R.vol>33?'中':'低')
 +`<div class="mu" style="margin-top:3px">値上がり ${R.up.toLocaleString()} / 値下がり ${R.dn.toLocaleString()} / 変わらず ${R.flat.toLocaleString()}(売買代金0.1億円以上 ${R.n.toLocaleString()}銘柄)</div>`
 +(R.theme?`<div>主戦場: <b class="ac">${esc(R.theme.k)}</b> ${pc(R.theme.w)}</div><div>注意: ${R.warn.map(s=>`<b>${esc(s.k)}</b> <span class="${cls(s.w)}">${pc(s.w)}</span>`).join(' / ')}</div>`:'');
 window.__R=R;
 $('#idxl').innerHTML='<table>'+D.index.map(i=>{const d=i.price<20?3:2;return `<tr><td>${esc(i.name)}</td><td>${fx(i.price,d)}</td><td class="${cls(i.chg)}">${pc(i.chg)}</td></tr>`}).join('')+'</table>';
 const sc=Object.values(SECW).filter(s=>s.val>=20).sort((a,b)=>b.w-a.w),top=sc.slice(0,6),bot=sc.slice(-6).reverse(),row=s=>`<tr><td>${esc(s.k)}</td><td>${arrow(s.w)}</td><td class="${cls(s.w)}">${pc(s.w)}</td></tr>`;
 $('#secl').innerHTML=`<table>${top.map(row).join('')}<tr><td colspan="3" class="mu">…</td></tr>${bot.map(row).join('')}</table>`;
 const W=STARS.map(c=>BY.get(c)).filter(Boolean);
 $('#wl').innerHTML=W.length?'<table>'+W.map(h=>`<tr data-c="${esc(h.code)}"><td>${esc(h.code)} ${esc(h.name)}</td><td class="${fl(h)}">${fp(h.price)}</td><td class="${cls(h.chg)}">${pc(h.chg)}</td><td>${star(h.code)}</td></tr>`).join('')+'</table>':'<div class="mu">スキャナーの☆を押すと、ここに登録されます</div>'}
function renderTicker(){const R=window.__R||regime(),c=(l,v,k)=>`<span><small>${l}</small> <b class="${k||''}">${v}</b></span>`,x=s=>{const i=I(s);return i?c(i.name.replace(/\(.*\)/,''),fx(i.price,i.price<20?3:2)+' '+pc(i.chg),cls(i.chg)):''};
 const f=I('NIY=F'),n=I('^N225'),o=[x('^N225'),x('1306.T'),x('2516.T'),x('USDJPY=X'),x('^SOX'),x('^VIX')];if(f&&n)o.splice(4,0,c('先物',`現物比 ${sg(f.price-n.price)}${fx(f.price-n.price,0)}円`,cls(f.price-n.price)));
 o.push(c('判定',R.label,R.tot>=60?'up':R.tot<=40?'dn':''));if(R.theme)o.push(c('主戦場',R.theme.k,'ac'));$('#ticker').innerHTML=o.join('')}
/* スキャナー */
const MODES=[['hot','熱さ',h=>h.hs],['up','急騰',h=>h.chg],['down','急落',h=>-h.chg],['vol','出来高',h=>h.vr],['gu','GAP上',h=>h.gap],['gd','GAP下',h=>-h.gap],['vp','VWAP上',h=>h.vd],['vm','VWAP下',h=>h.vd==null?null:-h.vd],['rs','相対強度',h=>h.rs],['an','異常検知',h=>anom(h)?h.hs:null],['val','売買代金',h=>h.val]];
function scanList(){const q=ST.q.trim().toLowerCase(),A=q?S.filter(h=>h.code.toLowerCase().includes(q)||h.name.toLowerCase().includes(q)||h.sector.includes(q)):S.filter(h=>(h.val||0)>=ST.minv),m=MODES.find(x=>x[0]==ST.mode)||MODES[0];
 return A.map(h=>[m[2](h),h]).filter(x=>x[0]!=null).sort((a,b)=>b[0]-a[0]).map(x=>x[1])}
const hcell=h=>`<td class="heat" style="background:rgba(230,180,34,${(h.hs/220).toFixed(2)})"><b>${h.hs}</b></td>`;
function renderScanner(){
 $('#modes').innerHTML='<b>表示:</b>'+MODES.map(m=>`<button data-mode="${m[0]}" class="${ST.mode==m[0]?'tab on':'tab'}" style="padding:0 10px">${m[1]}</button>`).join('');
 const A=scanList(),pages=Math.max(1,Math.ceil(A.length/50));ST.page=Math.min(ST.page,pages-1);lsSet('st',ST);const R=A.slice(ST.page*50,ST.page*50+50),b=ST.page*50;
 $('#scinfo').textContent=`${A.length.toLocaleString()}銘柄(全${S.length.toLocaleString()}銘柄中) ${ST.page+1}/${pages}ページ${ST.q?' / 検索中は売買代金の下限なし':''}`;
 $('#scT').innerHTML='<table><tr><th>順位</th><th></th><th>銘柄</th><th>業種</th><th>株価</th><th>前日比</th><th>出来高倍率</th><th>寄付GAP</th><th>VWAP乖離</th><th>日経との差</th><th>売買代金</th><th>熱さ(0-100)</th><th>材料</th><th>ニュース</th></tr>'+R.map((h,i)=>`<tr data-c="${esc(h.code)}"${h.code==SEL?' class="sel"':''}><td>${b+i+1}</td><td>${star(h.code)}</td><td>${esc(h.code)} ${esc(h.name)}</td><td class="mu">${esc(h.sector)}</td><td class="${fl(h)}">${fp(h.price)}</td><td class="${cls(h.chg)}">${pc(h.chg)}</td><td>${(h.vr||0).toFixed(1)}倍</td><td class="${cls(h.gap)}">${pc(h.gap)}</td><td class="${cls(h.vd)}">${pc(h.vd)}</td><td class="${cls(h.rs)}">${pc(h.rs)}</td><td>${(h.val||0).toFixed(1)}億</td>${hcell(h)}<td style="text-align:left">${why(h).map(t=>`<span class="tg">${esc(t)}</span>`).join('')}</td><td>${NC[h.code]||''}</td></tr>`).join('')+'</table>';
 const c=(l,v,k)=>`<span><small>${l}</small> <b class="${k||''}">${v}</b></span>`;
 $('#scC').innerHTML=R.map((h,i)=>`<div class="card" data-c="${esc(h.code)}"><div class="h"><span>${b+i+1}. ${esc(h.code)} ${esc(h.name)}</span><span><span class="${cls(h.chg)}">${fp(h.price)} ${pc(h.chg)}</span> 熱さ<b class="ac">${h.hs}</b> ${star(h.code)}</span></div><div class="c"><span class="mu">${esc(h.sector)}</span>${c('出来高',(h.vr||0).toFixed(1)+'倍')}${c('GAP',pc(h.gap),cls(h.gap))}${c('VWAP乖離',pc(h.vd),cls(h.vd))}${c('日経との差',pc(h.rs),cls(h.rs))}${c('売買代金',(h.val||0).toFixed(1)+'億')}${NC[h.code]?c('ニュース',NC[h.code]+'件'):''}</div><div>${why(h).map(t=>`<span class="tg">${esc(t)}</span>`).join('')}</div></div>`).join('')}
/* ドロワー(銘柄詳細) */
function renderDrawer(){const dr=$('#drawer');if(!OPEN||!BY.has(SEL)){dr.classList.add('hide');return}dr.classList.remove('hide');const h=BY.get(SEL);
 const kv=a=>'<div class="kg" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">'+a.map(([k,v,c])=>`<div><small>${k}</small><b class="${c||''}">${v}</b></div>`).join('')+'</div>';
 const L=[['当日高値',h.hi],['当日安値',h.lo],['始値',h.open],['VWAP',h.vwap],['前日高値',h.pyh],['前日安値',h.pyl],['前日終値',h.prev],['オープニングレンジ高値(最初の15分)',h.orf?h.orh:null],['オープニングレンジ安値(最初の15分)',h.orf?h.orl:null]].filter(x=>x[1]!=null);
 L.push(['● 現在値',h.price,1]);L.sort((a,b)=>b[1]-a[1]);
 let sp='';if(h.spark&&h.spark.length>1){const lo=Math.min(...h.spark,h.prev,h.vwap??1e18),hi=Math.max(...h.spark,h.prev,h.vwap??-1),Y=v=>76-(v-lo)/((hi-lo)||1)*70,X=i=>i/(h.spark.length-1)*400;
  sp=`<svg viewBox="0 0 400 80" style="width:100%;height:90px;display:block" role="img" aria-label="当日の値動き"><line x1="0" x2="400" y1="${Y(h.prev)}" y2="${Y(h.prev)}" stroke="var(--mu)" stroke-dasharray="3"/><text x="2" y="${Y(h.prev)-2}" font-size="9" fill="var(--mu)">前日終値 ${fp(h.prev)}</text>${h.vwap?`<line x1="0" x2="400" y1="${Y(h.vwap)}" y2="${Y(h.vwap)}" stroke="var(--ac)"/><text x="398" y="${Y(h.vwap)-2}" font-size="9" text-anchor="end" fill="var(--ac)">VWAP ${fp(h.vwap)}</text>`:''}<polyline fill="none" stroke="${h.chg>=0?'var(--up)':'var(--dn)'}" stroke-width="1.5" points="${h.spark.map((v,i)=>X(i)+','+Y(v)).join(' ')}"/></svg>`}
 const rel=(SECW[h.sector]?SECW[h.sector].list:[]).slice().sort((a,b)=>(b.val||0)-(a.val||0)).slice(0,10),ns=NEWS.filter(n=>(n.codes||[]).includes(h.code)||n.title.includes(h.name)).slice(0,10);
 dr.innerHTML=`<div class="dh"><span>${esc(h.code)} ${esc(h.name)} <span class="mu">${esc(h.sector)} ${esc(h.market||'')}</span> ${star(h.code)}</span><button id="dx" aria-label="閉じる">×</button></div>
 <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap"><div class="big ${cls(h.chg)}">${fp(h.price)}</div><div class="${cls(h.chg)}" style="font-size:15px">${sg(h.chgv)}${fp(h.chgv)}円 (${pc(h.chg)})</div><div>熱さ <b class="ac" style="font-size:18px">${h.hs}</b>/100</div></div>
 <div class="mu" style="margin-top:2px">熱さの内訳(合計${h.hs}点)</div><table>${h.hb.map(([l,v,m])=>`<tr><td>${l}</td><td>${v.toFixed(1)} / ${m}点</td><td style="width:40%"><div class="meter"><span class="tr"><i style="width:${v/m*100}%"></i></span></div></td></tr>`).join('')}</table>
 ${h.intra?'':'<div class="mu">この銘柄の分足指標(VWAP・1/5/15分・OR)は未取得です。☆登録または選択すると、ブラウザのライブ取得で補完されます(取得可能な場合)。</div>'}
 <h3 class="ac" style="margin:6px 0 2px;font-size:12.5px">価格の位置関係(高い順)</h3><div class="ladder">${L.map(([k,v,c])=>`<div class="${c?'cur':''}"><span>${k}</span><span>${fp(v)}</span><span class="${cls(v-h.price)}">${c?'':pc((v/h.price-1)*100)}</span></div>`).join('')}</div>
 ${sp}${h.orf?`<div>オープニングレンジ: ${h.price>h.orh?'<b class="up">上抜け</b>':h.price<h.orl?'<b class="dn">下抜け</b>':'<b>レンジ内</b>'}(高値${fp(h.orh)} / 安値${fp(h.orl)})</div>`:''}
 ${kv([['出来高',fv(h.vol)+'株'],['前日同時刻',h.pv?fv(h.pv)+'株':'—'],['出来高倍率',(h.vr||0).toFixed(2)+'倍'],['平均出来高',fv(h.avgvol)+'株'],['売買代金',(h.val||0).toFixed(1)+'億円'],['寄付GAP',pc(h.gap),cls(h.gap)],['GAP金額',sg(h.gapv)+fp(h.gapv)+'円',cls(h.gapv)],['寄付からの騰落',pc(h.fo),cls(h.fo)],['VWAP乖離',pc(h.vd),cls(h.vd)],['直近1分',pc(h.m1),cls(h.m1)],['直近5分',pc(h.m5),cls(h.m5)],['直近15分',pc(h.m15),cls(h.m15)],['当日値幅',fp(h.rng)+'円'],['平均日中値幅',fp(h.atr)+'円'],['値幅消化率',h.used==null?'—':h.used.toFixed(0)+'%'],['日経との差',pc(h.rs),cls(h.rs)],['業種平均との差',pc(h.rss),cls(h.rss)],['52週高値',fp(h.h52)],['52週安値',fp(h.l52)]])}
 <h3 class="ac" style="margin:6px 0 2px;font-size:12.5px">この銘柄のニュース(時刻つき)</h3>${ns.length?ns.map(newsRow).join(''):'<div class="mu">該当ニュースなし</div>'}
 <h3 class="ac" style="margin:6px 0 2px;font-size:12.5px">同業・関連銘柄(${esc(h.sector)}・売買代金上位)</h3><table><tr><th>銘柄</th><th>株価</th><th>前日比</th><th>出来高倍率</th></tr>${rel.map(x=>`<tr data-c="${esc(x.code)}"><td>${esc(x.code)} ${esc(x.name)}</td><td>${fp(x.price)}</td><td class="${cls(x.chg)}">${pc(x.chg)}</td><td>${(x.vr||0).toFixed(1)}倍</td></tr>`).join('')}</table>`}
const tm=n=>n.ts?new Date(n.ts*1000).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'--:--';
const newsRow=n=>`<div class="nw"><b class="ac">${tm(n)}</b> <a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a><br><small>${esc(n.src)} ${(n.tags||[]).map(t=>`<span class="tg">${esc(t)}</span>`).join('')} ${(n.codes||[]).map(c=>BY.get(c)?`<a href="#" data-c="${esc(c)}" class="ac">${esc(BY.get(c).name)}</a>`:'').join(' ')}</small></div>`;
function renderEv(j){if(!EV)return;const now=j||new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Tokyo'})),m=now.getHours()*60+now.getMinutes();if(m==LASTMIN)return;LASTMIN=m;
 const hm=pad(now.getHours())+':'+pad(now.getMinutes());let nx=true;
 $('#ev').innerHTML=(EV.today||[]).map(([t,n])=>{const [a,b]=t.split(':').map(Number),d=a*60+b-m,c=d<0?'past':nx?(nx=false,'next'):'';return `<div class="${c}"><b>${t}</b><span>${esc(n)}</span>${c=='next'?`<b>あと ${d>=60?Math.floor(d/60)+'時間':''}${d%60}分</b>`:''}</div>`}).join('')+((EV.upcoming||[]).length?'<div class="mu" style="margin-top:3px">今後の予定</div>'+EV.upcoming.map(([d,t,n])=>`<div><b class="mu">${d.slice(5)} ${t}</b><span>${esc(n)}</span></div>`).join(''):'')}
const renderAll=()=>{if(!D)return;prep();renderTicker();renderLeft();renderScanner();renderDrawer()};
async function live(){if(LIVE.ok===false||!S.length)return;
 const ci=[...new Set([...STARS,SEL].filter(Boolean))].filter(c=>BY.has(c)).slice(0,30),ni=D.index.length,syms=[...D.index.map(i=>i.sym),...ci.map(c=>c+'.T')];
 const res=await Promise.allSettled(syms.map(liveQ));let ok=0;
 res.forEach((r,i)=>{if(r.status!='fulfilled')return;ok++;if(i<ni)Object.assign(D.index[i],r.value);else{const h=BY.get(ci[i-ni]);Object.assign(h,r.value);h.intra=1}});
 if(LIVE.ok===null)LIVE.ok=ok>0;$('#lv').textContent=ok?`ライブ ${ok}/${syms.length}`:'ライブ取得不可(ブラウザ制限)'}
async function loadMarket(){
 try{const r=await fetch('data/market.json?t='+Date.now());if(!r.ok)throw 0;const d=await r.json();
  OLD={};IOLD={};if(D){S.forEach(h=>OLD[h.code]=h.price);D.index.forEach(i=>IOLD[i.sym]=i.price)}
  D=d;S=d.stocks;BY=new Map(S.map(h=>[h.code,h]));if(!SEL&&S.length)SEL=S[0].code;
  const age=Math.round((Date.now()/1000-d.ts)/60);$('#upd').textContent=d.count?`データ ${d.asof.slice(5,16)} (${age}分前・全${d.count.toLocaleString()}銘柄)`:'データ未生成';
  $('#warn').innerHTML=!d.count?'<div class="warn">データがまだありません。GitHub の Actions で update-site を実行してください。</div>':d.universe<1000?`<div class="warn">全銘柄の一覧を取得できていません(現在${d.universe}銘柄)。README の「全銘柄が出ないとき」を確認してください。</div>`:'';
  await live();renderAll()}catch(e){$('#upd').textContent='データ取得失敗'}}
async function loadNews(){
 try{const d=await(await fetch('data/news.json?t='+Date.now())).json();NEWS=d.items||[];$('#nwt').textContent=d.asof;$('#news').innerHTML=NEWS.map(newsRow).join('')||'<div class="mu">ニュースなし</div>';if(D)renderAll()}catch(e){}
 try{EV=await(await fetch('data/events.json?t='+Date.now())).json();LASTMIN=-1;renderEv()}catch(x){}}
document.addEventListener('click',e=>{if(TAB!='info'||!D)return;
 const st=e.target.closest('[data-star]');if(st){e.stopPropagation();const c=st.dataset.star;STARS=STARS.includes(c)?STARS.filter(x=>x!=c):[...STARS,c];saveStars();renderAll();nextM=0;return}
 const md=e.target.closest('[data-mode]');if(md){ST.mode=md.dataset.mode;ST.page=0;renderScanner();return}
 if(e.target.closest('#dx')){OPEN=false;renderDrawer();return}
 const r=e.target.closest('[data-c]');if(r){e.preventDefault();SEL=r.dataset.c;OPEN=true;renderDrawer();if(BY.get(SEL)&&!BY.get(SEL).intra)live().then(renderDrawer);return}
});
document.addEventListener('esc',()=>{if(OPEN){OPEN=false;renderDrawer()}});
document.addEventListener('tabshow',()=>{if(TAB!='info')$('#drawer').classList.add('hide');else renderDrawer()});
$('#mv').value=String(ST.minv);$('#mv').onchange=()=>{ST.minv=+$('#mv').value;ST.page=0;renderScanner()};
$('#aq').value=ST.q;$('#aq').oninput=()=>{ST.q=$('#aq').value;ST.page=0;renderScanner()};
$('#apv').onclick=()=>{ST.page=Math.max(0,ST.page-1);renderScanner()};$('#anx').onclick=()=>{ST.page++;renderScanner()};
/* AIプロンプト: 市場分析 / 銘柄分析 / 総合分析 */
const LN=h=>`${h.code} ${h.name}[${h.sector}] 現在値${fp(h.price)} 前日比${pc(h.chg)} 出来高${(h.vr||0).toFixed(1)}倍 売買代金${(h.val||0).toFixed(1)}億円 GAP${pc(h.gap)} VWAP乖離${pc(h.vd)} 5分${pc(h.m5)} 日経との差${pc(h.rs)} 熱さ${h.hs}(${h.hb.map(x=>x[0]+x[1]).join(',')}) ${why(h).join('・')}`;
const mkt=()=>{const R=window.__R||regime();return `【データ時刻】${D.asof} JST(Yahoo!ファイナンス由来・遅延あり)\n【市場】\n${D.index.map(i=>`${i.name}: ${fx(i.price,i.price<20?3:2)} (${pc(i.chg)})`).join('\n')}\n【市場状態(機械集計)】${R.label} 総合${R.tot} / 日本株指数${R.trend} 外部環境${R.ext} 値上がり比率${R.br}(上昇${R.up}・下落${R.dn}) VIX指標${R.vol==null?'-':R.vol}\n【主戦場】${R.theme?R.theme.k+' '+pc(R.theme.w):'-'} 【弱い業種】${R.warn.map(s=>s.k+' '+pc(s.w)).join(' / ')}`};
const INTRO='あなたは日本株デイトレード向けの市場整理アシスタントです。以下のデータだけを根拠に事実ベースで整理してください。売買の推奨や利益の断定はせず、データにない情報は書かないでください。\n';
PROMPTS.market=()=>D&&S.length?`${INTRO}依頼: 市場全体の状況を、日経・TOPIX・為替・米国市場・先物・ニュースの範囲で整理し、注意すべき材料とリスクを示してください。\n\n${mkt()}\n\n【ニュース(時刻つき)】\n${NEWS.slice(0,10).map(n=>`${tm(n)} ${n.title}`).join('\n')}`:'';
PROMPTS.stock=()=>{if(!D||!BY.has(SEL))return '';const h=BY.get(SEL),rel=(SECW[h.sector]?SECW[h.sector].list:[]).filter(x=>x.code!=h.code).sort((a,b)=>(b.val||0)-(a.val||0)).slice(0,8),ns=NEWS.filter(n=>(n.codes||[]).includes(h.code)||n.title.includes(h.name)).slice(0,8);
 return `${INTRO}依頼: 次の銘柄について、(1)値動きと需給の整理 (2)注意すべき価格帯と現在値からの距離 (3)同業の動きとの比較 (4)リスク を示してください。\n\n【対象】${LN(h)}\n始値${fp(h.open)} 高値${fp(h.hi)} 安値${fp(h.lo)} 前日終値${fp(h.prev)} 前日高値${fp(h.pyh)} 前日安値${fp(h.pyl)} VWAP${fp(h.vwap)} OR高値${fp(h.orh)} OR安値${fp(h.orl)} 52週高値${fp(h.h52)} 52週安値${fp(h.l52)} 出来高${fv(h.vol)}株(前日同時刻${fv(h.pv)}株) 当日値幅${fp(h.rng)}円(平均${fp(h.atr)}円)\n\n【同業(売買代金上位)】\n${rel.map(LN).join('\n')}\n\n【ニュース】\n${ns.length?ns.map(n=>`${tm(n)} ${n.title}`).join('\n'):'該当なし'}`};
PROMPTS.total=()=>{if(!D||!S.length)return '';const P=S.filter(h=>(h.val||0)>=ST.minv),top=P.slice().sort((a,b)=>b.hs-a.hs).slice(0,15),an=P.filter(anom).sort((a,b)=>b.hs-a.hs).slice(0,6),sc=Object.values(SECW).filter(s=>s.val>=20).sort((a,b)=>b.w-a.w),W=STARS.map(c=>BY.get(c)).filter(Boolean);
 return `${INTRO}依頼: 市場→セクター→ランキング→ニュース→注目銘柄の順に、今日のデイトレ環境を整理し、なぜ各銘柄が監視対象になっているかを数値で説明してください。\n\n${mkt()}\n\n【業種(売買代金加重騰落率)】${sc.slice(0,6).concat(sc.slice(-4)).map(s=>s.k+' '+pc(s.w)).join(' / ')}\n\n【注目銘柄(熱さ上位15・売買代金${ST.minv}億円以上)】\n${top.map(LN).join('\n')}\n\n【異常検知】\n${an.map(LN).join('\n')||'なし'}\n\n【ウォッチ(★)】\n${W.map(LN).join('\n')||'なし'}\n\n【ニュース(時刻つき)】\n${NEWS.slice(0,12).map(n=>`${tm(n)} ${n.title}`).join('\n')}`};
window.NAMEOF=c=>BY.get(c)?.name;onM=loadMarket;onN=loadNews;onSec=renderEv;
})();
