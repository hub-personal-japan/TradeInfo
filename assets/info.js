(()=>{
let D=null,S=[],BY=new Map(),NEWS=[],NC={},SEL='',OLD={},IOLD={},SECW={},EV=null,OPEN=false,LASTMIN=-1;
const ST=Object.assign({mode:'hot',q:'',page:0,minv:1},lsGet('st',{}));ST.f=Object.assign({sec:'',mk:'',pmin:'',pmax:'',cmin:'',cmax:'',vr:'',gap:'',hs:'',star:false,news:false},ST.f||{});
const UI=lsGet('ui',{});SEL=UI.sel||'';OPEN=!!UI.open;let ALERTS=lsGet('alerts',[]),LASTFETCH=0,LASTFULL=0,META=0,LOADING=false,LVBUSY=false;
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
 o.push(c('判定',R.label,R.tot>=60?'up':R.tot<=40?'dn':''));const E=window.EDGE?window.EDGE():null;if(E&&E.n){const j=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Tokyo'})),bk=pad(j.getHours())+':'+(j.getMinutes()<30?'00':'30'),a=E.band.get(bk),nn=I('^N225'),rg=nn&&window.REGLABEL?E.regime.get(window.REGLABEL(nn.chg)):null;if(a)o.push(c('今の時間帯の自分',bk+'台 '+edgeTxt(a),cls(a.p)));if(rg)o.push(c('今日の相場での自分',edgeTxt(rg),cls(rg.p)))}if(R.theme)o.push(c('主戦場',R.theme.k,'ac'));$('#ticker').innerHTML=o.join('')}
/* スキャナー */
const MODES=[['hot','熱さ',h=>h.hs],['up','急騰',h=>h.chg],['down','急落',h=>-h.chg],['vol','出来高',h=>h.vr],['gu','GAP上',h=>h.gap],['gd','GAP下',h=>-h.gap],['vp','VWAP上',h=>h.vd],['vm','VWAP下',h=>h.vd==null?null:-h.vd],['rs','相対強度',h=>h.rs],['an','異常検知',h=>anom(h)?h.hs:null],['val','売買代金',h=>h.val]];
const FLT=h=>{const F=ST.f,n=v=>v===''||v==null||isNaN(+v)?null:+v;let a;if(F.sec&&h.sector!=F.sec)return false;if(F.mk&&h.market!=F.mk)return false;
 if((a=n(F.pmin))!=null&&h.price<a)return false;if((a=n(F.pmax))!=null&&h.price>a)return false;if((a=n(F.cmin))!=null&&h.chg<a)return false;if((a=n(F.cmax))!=null&&h.chg>a)return false;
 if((a=n(F.vr))!=null&&(h.vr||0)<a)return false;if((a=n(F.gap))!=null&&Math.abs(h.gap)<a)return false;if((a=n(F.hs))!=null&&h.hs<a)return false;
 if(F.star&&!STARS.includes(h.code))return false;if(F.news&&!NC[h.code])return false;return true};
const fsum=()=>{const F=ST.f,o=[];if(F.sec)o.push('業種='+F.sec);if(F.mk)o.push('市場='+F.mk);if(F.pmin!==''||F.pmax!=='')o.push('株価'+(F.pmin||'')+'〜'+(F.pmax||''));if(F.cmin!==''||F.cmax!=='')o.push('前日比'+(F.cmin||'')+'〜'+(F.cmax||'')+'%');if(F.vr!=='')o.push('出来高'+F.vr+'倍以上');if(F.gap!=='')o.push('GAP'+F.gap+'%以上');if(F.hs!=='')o.push('熱さ'+F.hs+'以上');if(F.star)o.push('★のみ');if(F.news)o.push('ニュースあり');return o.join(' / ')};
function scanList(){const q=ST.q.trim().toLowerCase(),A=(q?S.filter(h=>h.code.toLowerCase().includes(q)||h.name.toLowerCase().includes(q)||h.sector.includes(q)):S.filter(h=>(h.val||0)>=ST.minv)).filter(FLT),m=MODES.find(x=>x[0]==ST.mode)||MODES[0];
 return A.map(h=>[m[2](h),h]).filter(x=>x[0]!=null).sort((a,b)=>b[0]-a[0]).map(x=>x[1])}
const hcell=h=>`<td class="heat" style="background:rgba(230,180,34,${(h.hs/220).toFixed(2)})"><b>${h.hs}</b></td>`;
function renderScanner(){
 $('#modes').innerHTML='<b>表示:</b>'+MODES.map(m=>`<button data-mode="${m[0]}" class="${ST.mode==m[0]?'tab on':'tab'}" style="padding:0 10px">${m[1]}</button>`).join('');
 const E=window.EDGE?window.EDGE():null,A=scanList(),pages=Math.max(1,Math.ceil(A.length/50));ST.page=Math.min(ST.page,pages-1);lsSet('st',ST);const R=A.slice(ST.page*50,ST.page*50+50),b=ST.page*50;
 $('#scinfo').textContent=`${(MODES.find(x=>x[0]==ST.mode)||MODES[0])[1]}順 ${A.length.toLocaleString()}銘柄 / 全${S.length.toLocaleString()}銘柄 ${ST.page+1}/${pages}ページ${fsum()?' 【絞込: '+fsum()+'】':''}${ST.q?' 【検索中は売買代金の下限なし】':''}`;
 $('#scT').innerHTML='<table><tr><th>順位</th><th></th><th>銘柄</th><th>業種</th><th>株価</th><th>前日比</th><th>出来高倍率</th><th>寄付GAP</th><th>VWAP乖離</th><th>日経との差</th><th>売買代金</th><th>熱さ(0-100)</th><th>あなたの実績</th><th>材料</th><th>ニュース</th></tr>'+R.map((h,i)=>`<tr data-c="${esc(h.code)}"${h.code==SEL?' class="sel"':''}><td>${b+i+1}</td><td>${star(h.code)}</td><td>${esc(h.code)} ${esc(h.name)}</td><td class="mu">${esc(h.sector)}</td><td class="${fl(h)}">${fp(h.price)}</td><td class="${cls(h.chg)}">${pc(h.chg)}</td><td>${(h.vr||0).toFixed(1)}倍</td><td class="${cls(h.gap)}">${pc(h.gap)}</td><td class="${cls(h.vd)}">${pc(h.vd)}</td><td class="${cls(h.rs)}">${pc(h.rs)}</td><td>${(h.val||0).toFixed(1)}億</td>${hcell(h)}<td style="text-align:left">${myEdge(h,E)}</td><td style="text-align:left">${why(h).map(t=>`<span class="tg">${esc(t)}</span>`).join('')}</td><td>${NC[h.code]||''}</td></tr>`).join('')+'</table>';
 const c=(l,v,k)=>`<span><small>${l}</small> <b class="${k||''}">${v}</b></span>`;
 $('#scC').innerHTML=R.map((h,i)=>`<div class="card" data-c="${esc(h.code)}"><div class="h"><span>${b+i+1}. ${esc(h.code)} ${esc(h.name)}</span><span><span class="${cls(h.chg)}">${fp(h.price)} ${pc(h.chg)}</span> 熱さ<b class="ac">${h.hs}</b> ${star(h.code)}</span></div><div class="c"><span class="mu">${esc(h.sector)}</span>${c('出来高',(h.vr||0).toFixed(1)+'倍')}${c('GAP',pc(h.gap),cls(h.gap))}${c('VWAP乖離',pc(h.vd),cls(h.vd))}${c('日経との差',pc(h.rs),cls(h.rs))}${c('売買代金',(h.val||0).toFixed(1)+'億')}${NC[h.code]?c('ニュース',NC[h.code]+'件'):''}</div><div>${myEdge(h,E)} ${why(h).map(t=>`<span class="tg">${esc(t)}</span>`).join('')}</div></div>`).join('')}
/* ドロワー(銘柄詳細) */
function renderDrawer(){lsSet('ui',{sel:SEL,open:OPEN});const dr=$('#drawer');if(!OPEN||!BY.has(SEL)){dr.classList.add('hide');return}dr.classList.remove('hide');const h=BY.get(SEL);
 const kv=a=>'<div class="kg" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">'+a.map(([k,v,c])=>`<div><small>${k}</small><b class="${c||''}">${v}</b></div>`).join('')+'</div>';
 const L=[['当日高値',h.hi],['当日安値',h.lo],['始値',h.open],['VWAP',h.vwap],['前日高値',h.pyh],['前日安値',h.pyl],['前日終値',h.prev],['オープニングレンジ高値(最初の15分)',h.orf?h.orh:null],['オープニングレンジ安値(最初の15分)',h.orf?h.orl:null]].filter(x=>x[1]!=null);
 L.push(['● 現在値',h.price,1]);L.sort((a,b)=>b[1]-a[1]);
 let sp='';if(h.spark&&h.spark.length>1){const lo=Math.min(...h.spark,h.prev,h.vwap??1e18),hi=Math.max(...h.spark,h.prev,h.vwap??-1),Y=v=>76-(v-lo)/((hi-lo)||1)*70,X=i=>i/(h.spark.length-1)*400;
  sp=`<svg viewBox="0 0 400 80" style="width:100%;height:90px;display:block" role="img" aria-label="当日の値動き"><line x1="0" x2="400" y1="${Y(h.prev)}" y2="${Y(h.prev)}" stroke="var(--mu)" stroke-dasharray="3"/><text x="2" y="${Y(h.prev)-2}" font-size="9" fill="var(--mu)">前日終値 ${fp(h.prev)}</text>${h.vwap?`<line x1="0" x2="400" y1="${Y(h.vwap)}" y2="${Y(h.vwap)}" stroke="var(--ac)"/><text x="398" y="${Y(h.vwap)-2}" font-size="9" text-anchor="end" fill="var(--ac)">VWAP ${fp(h.vwap)}</text>`:''}<polyline fill="none" stroke="${h.chg>=0?'var(--up)':'var(--dn)'}" stroke-width="1.5" points="${h.spark.map((v,i)=>X(i)+','+Y(v)).join(' ')}"/></svg>`}
 const rel=(SECW[h.sector]?SECW[h.sector].list:[]).slice().sort((a,b)=>(b.val||0)-(a.val||0)).slice(0,10),ns=NEWS.filter(n=>(n.codes||[]).includes(h.code)||n.title.includes(h.name)).slice(0,10);
 $('#dbody').innerHTML=`<div class="dh"><span>${esc(h.code)} ${esc(h.name)} <span class="mu">${esc(h.sector)} ${esc(h.market||'')}</span> ${star(h.code)}</span><button id="dx" aria-label="閉じる">×</button></div>
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
const LKEEP=['price','prev','open','hi','lo','vol','vr','val','chg','chgv','gap','gapv','fo','vwap','vd','m1','m5','m15','rng','used','orh','orl','orf','spark','lt','intra'];
const hhmm=t=>new Date(t*1000).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'});
function updInfo(){if(!D)return;const now=Date.now()/1000,age=Math.round((now-D.ts)/60),fa=Math.round((now-(D.full_ts||D.ts))/60);let t=`GitHub更新: 注目銘柄${age}分前・全銘柄${fa}分前`;if(LV.ok&&LV.lt)t=`株価時刻 ${hhmm(LV.lt)}(${Math.max(0,Math.round((now-LV.lt)/60))}分遅れ) / `+t;$('#upd').textContent=t}
function beep(){try{const a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=880;g.gain.value=.08;o.start();o.stop(a.currentTime+.15)}catch(e){}}
function renderAlerts(){$('#alerts').innerHTML=ALERTS.length?ALERTS.slice(0,15).map(a=>`<div><span class="mu">${esc(a.t)}</span> <a href="#" data-c="${esc(a.c)}" class="ac">${esc(a.c)} ${esc(a.n)}</a> ${esc(a.m)}</div>`).join(''):'<div class="mu">★登録した銘柄・選択中の銘柄で、VWAP抜け・OR抜け・高値更新・5分急変・出来高急増があると表示します(ライブ取得が必要)</div>'}
function alertCheck(h,p){if(!STARS.includes(h.code)&&h.code!=SEL)return;const t=new Date().toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo'}),a=[];
 if(p.vd!=null&&h.vd!=null&&Math.sign(p.vd)!=Math.sign(h.vd)&&Math.abs(h.vd)>0.05)a.push(h.vd>0?'VWAPを上抜け':'VWAPを下抜け');
 if(p.hi!=null&&h.hi>p.hi&&h.price>=h.hi)a.push('当日高値を更新');
 if(h.orf&&p.orh!=null&&p.price!=null){if(p.price<=h.orh&&h.price>h.orh)a.push('ORを上抜け');if(p.price>=h.orl&&h.price<h.orl)a.push('ORを下抜け')}
 if(p.m5!=null&&h.m5!=null&&Math.abs(h.m5)>=1.5&&Math.abs(p.m5)<1.5)a.push('5分で'+pc(h.m5));
 if((h.vr||0)>=3&&(p.vr||0)<3)a.push('出来高が想定の3倍超');
 let add=0;a.forEach(m=>{if(ALERTS.slice(0,8).some(x=>x.c==h.code&&x.m==m))return;ALERTS.unshift({t,c:h.code,n:h.name,m});add++});
 if(add){ALERTS.length=Math.min(ALERTS.length,40);lsSet('alerts',ALERTS);renderAlerts();if($('#snd').checked)beep()}}
async function live(){if(!D||!S.length||LVBUSY)return;if(LV.route&&LV.route.startsWith('公開')&&Date.now()-LV.t<15000)return;if(LV.ok===false&&Date.now()-LV.t<30000)return;LVBUSY=true;const t0=Date.now();
 try{const idx=['^N225','1306.T','2516.T','NIY=F','USDJPY=X','^SOX','^VIX','^IXIC'].filter(x=>I(x));
  const codes=[...new Set([SEL,...STARS,...S.filter(h=>(h.val||0)>=ST.minv).sort((a,b)=>b.hs-a.hs).slice(0,25).map(h=>h.code)])].filter(c=>BY.has(c)),syms=[...idx,...codes.map(c=>c+'.T')];
  const data=await liveBatch(syms);let ok=0,lt=0;
  syms.forEach(x=>{const j=data[x];if(!j||!j.chart||!j.chart.result)return;const isIdx=idx.includes(x),base=isIdx?I(x):BY.get(x.replace('.T',''));try{const r=liveFrom(j,base);if(!r)return;ok++;lt=Math.max(lt,r.lt||0);
   if(isIdx)Object.assign(base,r);else{const pv={vd:base.vd,hi:base.hi,orh:base.orh,orl:base.orl,vr:base.vr,m5:base.m5,price:base.price};Object.assign(base,r);base.intra=1;alertCheck(base,pv)}}catch(e){}});
  LV.ok=ok>0;LV.n=ok;LV.tot=syms.length;LV.t=Date.now();if(lt)LV.lt=lt;if(ok)renderAll()}
 catch(e){LV.ok=false;LV.n=0;LV.t=Date.now()}finally{LVBUSY=false;lvBadge();updInfo()}}
function applyMarket(d){OLD={};IOLD={};const keep=new Map(),ki=new Map();
 if(D){S.forEach(h=>{OLD[h.code]=h.price;if(h.lt)keep.set(h.code,h)});D.index.forEach(i=>{IOLD[i.sym]=i.price;if(i.lt)ki.set(i.sym,i)})}
 D=d;S=d.stocks;BY=new Map(S.map(h=>[h.code,h]));
 keep.forEach((o,c)=>{const h=BY.get(c);if(h)LKEEP.forEach(k=>{if(o[k]!==undefined)h[k]=o[k]})});D.index.forEach(i=>{const o=ki.get(i.sym);if(o)Object.assign(i,o)});
 if(!SEL||!BY.has(SEL))SEL=S[0]?S[0].code:'';prep();fillFilters();
 $('#warn').innerHTML=!d.count?'<div class="warn">データがまだありません。GitHub の Actions で update-site を実行してください。</div>':d.universe<1000?`<div class="warn">全銘柄の一覧を取得できていません(現在${d.universe}銘柄)。README の「全銘柄が出ないとき」を確認してください。</div>`:'';updInfo()}
async function loadMarket(){if(LOADING)return;LOADING=true;
 try{const r=await fetch('data/market.json?t='+Date.now());if(!r.ok)throw 0;const d=await r.json();META=d.ts;LASTFULL=Date.now();applyMarket(d);renderAll();idb.set('market',d)}catch(e){if(!D)$('#upd').textContent='データ取得失敗'}finally{LOADING=false}}
async function refresh(){if(D)live();const now=Date.now();if(now-LASTFETCH<15000)return;LASTFETCH=now;
 try{const m=await(await fetch('data/meta.json?t='+now)).json();if(m.ts!==META)await loadMarket()}catch(e){if(now-LASTFULL>60000)await loadMarket()}}
function fillFilters(){const secs=[...new Set(S.map(h=>h.sector))].sort(),mks=[...new Set(S.map(h=>h.market).filter(Boolean))];
 const sel=(k,arr,all)=>{const e=document.querySelector('#fbar [data-f="'+k+'"]');if(!e)return;e.innerHTML='<option value="">'+all+'</option>'+arr.map(x=>`<option>${esc(x)}</option>`).join('');e.value=ST.f[k]};
 sel('sec',secs,'全業種');sel('mk',mks,'全市場');
 document.querySelectorAll('#fbar [data-f]').forEach(e=>{if(e.tagName=='SELECT')return;if(e.type=='checkbox')e.checked=!!ST.f[e.dataset.f];else e.value=ST.f[e.dataset.f]})}
const onF=e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.f)return;ST.f[t.dataset.f]=t.type=='checkbox'?t.checked:t.value;ST.page=0;renderScanner()};
document.addEventListener('input',onF);document.addEventListener('change',onF);
$('#frs').onclick=()=>{Object.keys(ST.f).forEach(k=>ST.f[k]=(k=='star'||k=='news')?false:'');ST.q='';$('#aq').value='';ST.page=0;fillFilters();renderScanner()};
/* あなたの実績(収支タブの取引データから) */
const edgeTxt=a=>`勝率${Math.round(a.w/a.n*100)}% 平均${yen(a.p/a.n)}(${a.n}回)`;
function myEdge(h,E){if(!E||!E.n)return '<span class="mu">取引データなし</span>';const c=E.code.get(h.code);if(c)return `<span class="edge">この銘柄 ${edgeTxt(c)}</span>`;const x=E.sector.get(h.sector);return x?`<span class="mu">業種 ${edgeTxt(x)}</span>`:'<span class="mu">未経験</span>'}
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
window.NAMEOF=c=>BY.get(c)?.name;onM=refresh;onN=loadNews;onSec=j=>{renderEv(j);updInfo()};renderAlerts();
(async()=>{const c=await idb.get('market');if(c&&c.stocks&&c.stocks.length&&!D){applyMarket(c);renderAll();$('#upd').textContent='前回のデータを表示中(最新を取得しています…)'}await loadMarket()})();
})();
