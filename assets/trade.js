/* 収支タブ: 約定履歴CSV/手入力 → FIFOでトレード単位に集計 → 成績・日誌。データはこのブラウザ内にのみ保存 */
let EX=[];try{EX=JSON.parse(localStorage.getItem('ex')||'[]')}catch(e){}
const save=()=>{try{localStorage.setItem('ex',JSON.stringify(EX))}catch(e){}};
const num=s=>parseFloat(String(s).replace(/[,円株\s]/g,''))||0;
function decode(buf){try{return new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(e){return new TextDecoder('shift_jis').decode(buf)}}
function parseCSV(t){const rows=[];let r=[],c='',q=false;for(let i=0;i<t.length;i++){const ch=t[i];
 if(q){if(ch=='"'){if(t[i+1]=='"'){c+='"';i++}else q=false}else c+=ch}
 else if(ch=='"')q=true;else if(ch==','){r.push(c);c=''}
 else if(ch=='\n'||ch=='\r'){if(ch=='\r'&&t[i+1]=='\n')i++;r.push(c);c='';rows.push(r);r=[]}else c+=ch}
 if(c||r.length){r.push(c);rows.push(r)}return rows}

const AL={date:['約定日時','約定日','約定日付','日付'],time:['約定時間','時刻','時間'],code:['銘柄コード','コード'],name:['銘柄名','銘柄'],side:['取引','売買区分','売買','取引区分'],qty:['約定数量','数量','株数'],price:['約定単価','約定価格','単価','価格'],fee:['手数料']};
function findCol(h,keys,ex){for(const k of keys){const i=h.findIndex((x,j)=>x.trim()===k&&!ex.includes(j));if(i>=0)return i}
 for(const k of keys){const i=h.findIndex((x,j)=>x.includes(k)&&!ex.includes(j));if(i>=0)return i}return -1}

function importText(t){
 const rows=parseCSV(t);const hi=rows.findIndex(r=>r.some(x=>x.includes('約定'))&&r.some(x=>x.includes('単価')||x.includes('価格')));
 if(hi<0)return {err:'ヘッダー行(約定日・約定単価など)が見つかりません'};
 const h=rows[hi].map(x=>x.trim()),used=[],C={};
 for(const k of ['code','date','time','side','qty','price','fee','name']){C[k]=findCol(h,AL[k],used);if(C[k]>=0)used.push(C[k])}
 const miss=['date','side','qty','price'].filter(k=>C[k]<0);
 if(miss.length)return {err:'必要な列が見つかりません: '+miss.join(', ')+' / 検出した列: '+h.join(' | ')};
 const seen=new Set(EX.map(e=>e.id)),cnt={};let add=0,dup=0;
 for(const r of rows.slice(hi+1)){
  const ds=(r[C.date]||'')+' '+(C.time>=0?r[C.time]||'':'');
  const dm=ds.match(/(\d{4})[\/\-年.](\d{1,2})[\/\-月.](\d{1,2})/),tm=ds.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const side=/買/.test(r[C.side]||'')?1:/売/.test(r[C.side]||'')?-1:0,qty=num(r[C.qty]),price=num(r[C.price]);
  if(!dm||!side||!qty||!price)continue;
  const date=`${dm[1]}/${pad(dm[2])}/${pad(dm[3])}`,time=tm?`${pad(tm[1])}:${tm[2]}:${pad(tm[3]||0)}`:'00:00:00';
  const sym=(C.code>=0&&r[C.code]||r[C.name]||'').trim(),name=(C.name>=0?r[C.name]:'').trim();
  const base=[date,time,sym,side,qty,price].join('|');cnt[base]=(cnt[base]||0)+1;const id=base+'#'+cnt[base];
  if(seen.has(id)){dup++;continue}
  EX.push({id,date,time,sym,name,side,qty,price,fee:C.fee>=0?num(r[C.fee]):0});add++}
 return {add,dup}}

const sec=t=>{const a=t.split(':').map(Number);return a[0]*3600+a[1]*60+(a[2]||0)};
function build(){const g={};EX.forEach(e=>(g[e.date+'|'+e.sym]??=[]).push(e));const T=[];
 for(const k in g){const L=g[k].slice().sort((a,b)=>a.time<b.time?-1:a.time>b.time?1:0);let lots=[],cur=null;
  for(const e of L){if(!cur)cur={sym:e.sym,name:e.name,date:e.date,ex:[],gross:0,fee:0,start:e.time};
   cur.ex.push(e);cur.fee+=e.fee;let q=e.qty;
   while(q>0&&lots.length&&lots[0].s!==e.side){const l=lots[0],m=Math.min(q,l.q);cur.gross+=(e.side===-1?e.price-l.p:l.p-e.price)*m;l.q-=m;q-=m;if(!l.q)lots.shift()}
   if(q>0)lots.push({s:e.side,q,p:e.price});cur.end=e.time;
   if(!lots.length){cur.open=false;T.push(cur);cur=null}}
  if(cur){cur.open=true;T.push(cur)}}
 T.forEach(t=>{t.net=t.gross-t.fee;t.hold=sec(t.end)-sec(t.start);t.qty=t.ex.filter(e=>e.side===t.ex[0].side).reduce((a,e)=>a+e.qty,0)});
 return T}

function stats(L){const w=L.filter(t=>t.net>0),l=L.filter(t=>t.net<0),sw=w.reduce((a,t)=>a+t.net,0),sl=l.reduce((a,t)=>a+t.net,0);
 let cum=0,pk=0,dd=0,run=0,mc=0;L.forEach(t=>{cum+=t.net;pk=Math.max(pk,cum);dd=Math.min(dd,cum-pk);if(t.net<0){run++;mc=Math.max(mc,run)}else run=0});
 return{n:L.length,w:w.length,l:l.length,net:cum,gross:L.reduce((a,t)=>a+t.gross,0),fee:L.reduce((a,t)=>a+t.fee,0),
  wr:L.length?w.length/L.length*100:0,aw:w.length?sw/w.length:0,al:l.length?sl/l.length:0,pf:sl?sw/-sl:(sw?Infinity:0),
  mw:Math.max(0,...L.map(t=>t.net)),ml:Math.min(0,...L.map(t=>t.net)),mc,dd}}

function grp(L,kf,sf){const m={};L.forEach(t=>(m[kf(t)]??=[]).push(t));return Object.keys(m).map(k=>({k,s:sf?sf(m[k][0]):'',n:m[k].length,w:m[k].filter(t=>t.net>0).length,p:m[k].reduce((a,t)=>a+t.net,0)}))}
function tbl(rows,head){
 return `<table><tr><th>${head}</th><th>回数</th><th>勝率</th><th>損益(円)</th><th>1回あたり(円)</th></tr>`+rows.map(r=>`<tr${r.s?` data-s="${esc(r.s)}"`:''}><td>${esc(r.k)}</td><td>${r.n}</td><td>${(r.w/r.n*100).toFixed(0)}%</td><td class="${cls(r.p)}">${Math.round(r.p).toLocaleString('ja-JP')}</td><td class="${cls(r.p)}">${Math.round(r.p/r.n).toLocaleString('ja-JP')}</td></tr>`).join('')+'</table>'}
function curve(L){if(!L.length)return'';let c=0;const p=[0,...L.map(t=>c+=t.net)],mn=Math.min(...p),mx=Math.max(...p),r=mx-mn||1;
 const X=i=>i/(p.length-1||1)*300,Y=v=>56-(v-mn)/r*50;
 return `<svg viewBox="0 0 300 60" preserveAspectRatio="none" style="width:100%;height:46px;display:block" role="img" aria-label="累計損益"><line x1="0" x2="300" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--bd)" stroke-dasharray="3"/><polyline fill="none" stroke="${c>=0?'var(--up)':'var(--dn)'}" stroke-width="1.5" vector-effect="non-scaling-stroke" points="${p.map((v,i)=>X(i)+','+Y(v)).join(' ')}"/></svg>`}
const HB=['1分未満','1〜3分','3〜10分','10分以上'],hb=s=>s<60?HB[0]:s<180?HB[1]:s<600?HB[2]:HB[3];
let VIEW=[];
let CMP={a:'',b:''};
const band=t=>{const a=t.start.split(':').map(Number),b=Math.floor((a[0]*60+a[1])/30)*30;return pad(b/60|0)+':'+pad(b%60)};
const keep=(sel,v)=>{sel.value=[...sel.options].some(o=>o.value==v)?v:'ALL'};
const mmss=s=>Math.floor(s/60)+'分'+pad(Math.round(s%60))+'秒';
const chart=(rows,lf)=>{if(!rows.length)return'<div class="mu">データなし</div>';const n=rows.length,W=420,H=96,z=H/2,mx=Math.max(1,...rows.map(r=>Math.abs(r.p))),bw=W/n,sk=n>14?Math.ceil(n/14):1;
 return `<svg viewBox="0 0 ${W} ${H+24}" style="width:100%;height:auto;display:block" role="img"><line x1="0" x2="${W}" y1="${z}" y2="${z}" stroke="var(--bd)"/>`+rows.map((r,i)=>{const x=i*bw+bw*.15,c=x+bw*.35,h=Math.abs(r.p)/mx*(z-10),col=r.p>=0?'var(--up)':'var(--dn)',lab=i%sk?'':`<text x="${c}" y="${H+10}" font-size="9" text-anchor="middle" fill="var(--mu)">${esc(lf?lf(r.k):r.k)}</text>`;
  return `<rect x="${x}" y="${r.p>=0?z-h:z}" width="${bw*.7}" height="${Math.max(1,h)}" fill="${col}"/>${n<=16?`<text x="${c}" y="${r.p>=0?z-h-2:z+h+8}" font-size="8" text-anchor="middle" fill="var(--tx)">${(r.p/1000).toFixed(1)}</text><text x="${c}" y="${H+20}" font-size="8" text-anchor="middle" fill="var(--mu)">${r.n}</text>`:''}${lab}`})+'</svg>'+'<div class="mu" style="font-size:11px">棒の上の数字=損益(千円)、下の数字=トレード回数。赤=利益、青=損失</div>'};
function render(){
 const T=build().sort((a,b)=>a.date+a.start<b.date+b.start?-1:1),C=T.filter(t=>!t.open);
 const months=[...new Set(C.map(t=>t.date.slice(0,7)))].sort().reverse(),days=[...new Set(C.map(t=>t.date))].sort().reverse();
 const dsel=$('#dsel'),ssel=$('#ssel'),sy={};let pd=dsel.value;const ps=ssel.value;C.forEach(t=>sy[t.sym]=t.name);
 if(!dsel.dataset.set&&days.length){pd=days[0];dsel.dataset.set=1}
 dsel.innerHTML='<option value="ALL">全期間</option><optgroup label="月">'+months.map(m=>`<option>${m}</option>`).join('')+'</optgroup><optgroup label="日">'+days.map(d=>`<option>${d}</option>`).join('')+'</optgroup>';
 ssel.innerHTML='<option value="ALL">全銘柄</option>'+Object.keys(sy).sort().map(s=>`<option value="${esc(s)}">${esc(s+' '+sy[s])}</option>`).join('');
 keep(dsel,pd);keep(ssel,ps);$('#sample').classList.toggle('hide',EX.length>0);
 const ids=['sum','tband','daily','monthly','cmp','sym','hold','dow','trades','mktpnl','secpnl','setuppnl','status'];
 if(!C.length){ids.forEach(i=>$('#'+i).innerHTML='');$('#sum').innerHTML='<div class="mu" style="padding:8px">約定履歴CSVを読み込むと、ここに成績が表示されます(画面にドロップしてもOK)。</div>';VIEW=[];return}
 const P=dsel.value,S=ssel.value,inP=t=>t.date.startsWith(P=='ALL'?'':P),inS=t=>S=='ALL'||t.sym==S;
 const L=C.filter(t=>inP(t)&&inS(t)),open=T.filter(t=>t.open&&inP(t)&&inS(t)).length;VIEW=L;const s=stats(L),CS=C.filter(inS);
 const bands=grp(L,band).sort((a,b)=>a.k<b.k?-1:1),syms=grp(L,t=>t.sym+' '+t.name,t=>t.sym).sort((a,b)=>b.p-a.p);
 const dly=grp(CS,t=>t.date).sort((a,b)=>a.k<b.k?-1:1),mo=grp(CS,t=>t.date.slice(0,7)).sort((a,b)=>a.k<b.k?-1:1),dl=grp(L,t=>t.date),bb=[...bands].sort((a,b)=>b.p-a.p),ins=[];
 const avg=a=>a.length?a.reduce((x,t)=>x+t.hold,0)/a.length:0,wh=avg(L.filter(t=>t.net>0)),lh=avg(L.filter(t=>t.net<0));
 if(L.length){ins.push(`期待値 <b class="${cls(s.net)}">${yen(s.net/s.n)}</b>/回(勝率${s.wr.toFixed(1)}%)`);
  if(bands.length>1)ins.push(`得意 ${bb[0].k}台 ${yen(bb[0].p)} / 苦手 ${bb.at(-1).k}台 ${yen(bb.at(-1).p)}`);
  if(syms.length>1)ins.push(`最高 ${esc(syms[0].k)} ${yen(syms[0].p)} / 最低 ${esc(syms.at(-1).k)} ${yen(syms.at(-1).p)}`);
  if(wh&&lh&&lh>wh*1.5)ins.push(`負けトレードの保有が勝ちの${(lh/wh).toFixed(1)}倍長い(損切りが遅い傾向)`);
  if(s.mc>=3)ins.push(`最大${s.mc}連敗`)}
 const k=(a,b,c)=>`<div><small>${a}</small><b class="${c||''}">${b}</b></div>`;
 $('#sumt').textContent=(P=='ALL'?'全期間':P)+(S=='ALL'?'':' / '+S);
 $('#sum').innerHTML=`<div style="display:flex;gap:8px;align-items:flex-end"><div class="big ${cls(s.net)}">${yen(s.net)}</div><div style="flex:1;min-width:0">${curve(L)}</div></div>
 <div class="kg">${k('トレード数',s.n)}${k('勝/負',s.w+'/'+s.l)}${k('勝率',s.wr.toFixed(1)+'%')}${k('PF',isFinite(s.pf)?s.pf.toFixed(2):'—')}${k('損益比',s.al?(s.aw/-s.al).toFixed(2):'—')}${k('期待値',yen(s.n?s.net/s.n:0),cls(s.net))}${k('平均利益',yen(s.aw),'up')}${k('平均損失',yen(s.al),'dn')}${k('最大連敗',s.mc)}${k('最大利益',yen(s.mw),'up')}${k('最大損失',yen(s.ml),'dn')}${k('最大DD',yen(s.dd),'dn')}${k('手数料',yen(-s.fee))}${k('手数料前',yen(s.gross),cls(s.gross))}${k('勝ち日/負け日',dl.filter(d=>d.p>0).length+'/'+dl.filter(d=>d.p<0).length)}${k('勝ち保有',wh?mmss(wh):'—')}${k('負け保有',lh?mmss(lh):'—')}${k('税引後(概算)',yen(L.reduce((a,t)=>a+(t.net>0?t.net*.79685:t.net),0)))}${k('資産額',$('#start').value?Math.round((+$('#start').value)+C.reduce((a,t)=>a+(t.net>0?t.net*.79685:t.net),0)).toLocaleString('ja-JP')+'円':'開始資産を入力')}${k('未決済',open+'件')}</div>
 <ul class="ins">${ins.map(i=>`<li>${i}</li>`).join('')}</ul>`;
 $('#tband').innerHTML=chart(bands);$('#daily').innerHTML=chart(dly.slice(-20),x=>x.slice(5));
 $('#monthly').innerHTML=tbl(mo.slice().reverse(),'月');
 const opts=[...months,...days];
 if(opts.length>=2){if(!opts.includes(CMP.a)||!opts.includes(CMP.b)){CMP.a=months[1]||days[1];CMP.b=months[0]||days[0]}
  const cs=p=>stats(C.filter(t=>t.date.startsWith(p)&&inS(t))),A=cs(CMP.a),B=cs(CMP.b),sh=(id,cur)=>`<select onchange="CMP.${id}=this.value;render()" aria-label="比較${id}"><optgroup label="月">${months.map(m=>`<option${m==cur?' selected':''}>${m}</option>`).join('')}</optgroup><optgroup label="日">${days.map(d=>`<option${d==cur?' selected':''}>${d}</option>`).join('')}</optgroup></select>`;
  const R=[['損益',x=>x.net,yen],['回数',x=>x.n,v=>v],['勝率',x=>x.wr,v=>v.toFixed(1)+'%'],['平均利益',x=>x.aw,yen],['平均損失',x=>x.al,yen],['PF',x=>isFinite(x.pf)?x.pf:0,v=>v.toFixed(2)],['期待値',x=>x.n?x.net/x.n:0,yen],['最大DD',x=>x.dd,yen]];
  $('#cmp').innerHTML=`<div style="display:flex;gap:4px;margin-bottom:2px">${sh('a',CMP.a)}<span>vs</span>${sh('b',CMP.b)}</div><table><tr><th>項目</th><th>A</th><th>B</th><th>差</th></tr>${R.map(([n,g,f])=>{const a=g(A),b=g(B),d=b-a;return `<tr><td>${n}</td><td>${f(a)}</td><td>${f(b)}</td><td class="${cls(d)}">${f===yen?f(d):(d>0?'+':'')+f(d)}</td></tr>`}).join('')}</table>`}
 else $('#cmp').innerHTML='<div class="mu">2期間以上のデータで比較できます</div>';
 $('#sym').innerHTML=tbl(syms,'銘柄');
 $('#hold').innerHTML=tbl(grp(L,t=>hb(t.hold)).sort((a,b)=>HB.indexOf(a.k)-HB.indexOf(b.k)),'保有時間');
 const DW='日月火水木金土',dw=grp(L,t=>DW[new Date(t.date.replace(/\//g,'-')).getDay()]).sort((a,b)=>DW.indexOf(a.k)-DW.indexOf(b.k));
 $('#dow').innerHTML=tbl(dw,'曜日');
 const ld=C.at(-1).date,sm=f=>C.filter(f).reduce((a,t)=>a+t.net,0),v1=sm(t=>t.date==ld),v2=sm(t=>t.date.slice(0,7)==ld.slice(0,7)),v3=sm(t=>t.date.slice(0,4)==ld.slice(0,4));
 $('#strip').innerHTML=`最新日 ${ld} <b class="${cls(v1)}">${yen(v1)}</b>　今月 <b class="${cls(v2)}">${yen(v2)}</b>　今年 <b class="${cls(v3)}">${yen(v3)}</b>`;
 $('#trt').textContent=L.length+'件';extra(L,C,S,P);
 $('#trades').innerHTML=L.slice().reverse().map(t=>`<details><summary><span class="mu">${P.length==10?'':t.date.slice(5)+' '}${P.length==10?t.start:t.start.slice(0,5)}</span><span class="${t.ex[0].side>0?'up':'dn'}">${t.ex[0].side>0?'買':'売'}</span><span>${esc(t.sym)} ${esc(t.name)}</span><span class="mu">${Math.floor(t.hold/60)}:${pad(t.hold%60)}</span><b class="${cls(t.net)}">${Math.round(t.net).toLocaleString('ja-JP')}</b></summary><table>${t.ex.map(e=>`<tr><td>${e.time}</td><td>${e.side>0?'買':'売'}</td><td>${e.qty}株</td><td>@${e.price.toLocaleString('ja-JP')}</td></tr>`).join('')}</table>${jh(t)}</details>`).join('')}
function summary(){const s=stats(VIEW);if(!VIEW.length)return'データがありません';
 const g=(L,t)=>grp(VIEW,L).sort((a,b)=>a.k<b.k?-1:1).map(r=>`${r.k}: ${r.n}回 勝率${(r.w/r.n*100).toFixed(0)}% ${yen(r.p)}`).join('\n');
 return `【デイトレ成績サマリー】対象: ${$('#dsel').value=='ALL'?'全期間':$('#dsel').value}
トレード数${s.n} / 勝率${s.wr.toFixed(1)}% / 損益${yen(s.net)} / 手数料${yen(-s.fee)}
平均利益${yen(s.aw)} / 平均損失${yen(s.al)} / PF ${isFinite(s.pf)?s.pf.toFixed(2):'-'} / 最大連敗${s.mc} / 最大DD${yen(s.dd)}
■時間帯別
${g(t=>{const a=t.start.split(':').map(Number),b=Math.floor((a[0]*60+a[1])/30)*30;return pad(b/60|0)+':'+pad(b%60)})}
■保有時間別
${g(t=>hb(t.hold))}
■銘柄別
${g(t=>t.sym+' '+t.name)}
上記はデータの集計です。負けトレードに共通する傾向と、改善できそうなルールを、根拠となる数字を挙げて整理してください。`}

async function readFiles(fs){let add=0,dup=0,errs=[];
 for(const f of fs){const r=importText(decode(await f.arrayBuffer()));if(r.err)errs.push(f.name+': '+r.err);else{add+=r.add;dup+=r.dup}}
 save();render();$('#msg').textContent=(add||!dup?`${add}件の約定を新規に取り込みました`:'新しい約定はありません(すべて取込済み)')+(add&&dup?`(重複${dup}件はスキップ)`:'')+(errs.length?' / '+errs.join(' / '):'')}
const drop=$('#drop'),fi=$('#file');
drop.onclick=()=>fi.click();drop.onkeydown=e=>{if(e.key=='Enter'||e.key==' '){e.preventDefault();fi.click()}};
fi.onchange=()=>{readFiles([...fi.files]);fi.value=''};
drop.ondragover=e=>{e.preventDefault();drop.classList.add('on')};drop.ondragleave=()=>drop.classList.remove('on');
drop.ondrop=()=>drop.classList.remove('on');
$('#dsel').onchange=render;$('#ssel').onchange=render;$('#sym').onclick=e=>{const r=e.target.closest('tr[data-s]');if(r){$('#ssel').value=r.dataset.s;render()}};['dragover','drop'].forEach(n=>document.addEventListener(n,e=>{e.preventDefault();if(n=='drop'&&e.dataTransfer.files.length)readFiles([...e.dataTransfer.files])}));
$('#clear').onclick=()=>{if($('#clear').dataset.arm){EX=[];save();render();$('#clear').textContent='全データ削除';delete $('#clear').dataset.arm;$('#msg').textContent='削除しました'}else{$('#clear').dataset.arm=1;$('#clear').textContent='もう一度押すと削除';setTimeout(()=>{delete $('#clear').dataset.arm;$('#clear').textContent='全データ削除'},3000)}};

$('#sample').onclick=()=>{const S=[['7203','トヨタ',3100],['8306','三菱UFJ',1900],['9984','ソフトバンクG',8400],['9101','日本郵船',4200]];let id=0;
 ['2026/09/28','2026/09/29','2026/09/30'].forEach(d=>{let m=541;const T=x=>pad(x/60|0)+':'+pad(x%60)+':'+pad(Math.random()*60|0);
  for(let i=0;i<40&&m<880;i++){const [c,n,p]=S[Math.random()*4|0],q=100*(1+(Math.random()*3|0)),dir=Math.random()<.5?1:-1,mv=Math.round(p*(Math.random()-.46)*.006);
   EX.push({id:'s'+id++,date:d,time:T(m),sym:c,name:n,side:dir,qty:q,price:p,fee:0},{id:'s'+id++,date:d,time:T(m+1+(Math.random()*8|0)),sym:c,name:n,side:-dir,qty:q,price:p+dir*mv,fee:0});m+=3+(Math.random()*9|0)}});
 render();$('#msg').textContent='サンプルを表示中です。実データを読み込む前に「全データ削除」を押してください'};

const JF=[['setup','セットアップ(例:GU後の押し)'],['stop','損切りライン'],['why_in','買い(エントリー)の理由'],['why_out','売り(決済)の理由'],['memo','備考・そのときの気持ち']];
const jh=t=>{const k=t.date+'|'+t.sym+'|'+t.start,j=lsGet('jn',{})[k]||{};return `<div class="jn">${JF.map(([f,l])=>`<label>${l}<input data-jk="${esc(k)}" data-jf="${f}" value="${esc(j[f]||'')}"></label>`).join('')}</div>`};
document.addEventListener('change',e=>{const i=e.target.closest('input[data-jk]');if(!i)return;const J=lsGet('jn',{});(J[i.dataset.jk]??={})[i.dataset.jf]=i.value;lsSet('jn',J)});
$('#start').value=lsGet('start','');$('#start').onchange=()=>{lsSet('start',$('#start').value);render()};
$('#mc').oninput=()=>{const n=window.NAMEOF&&NAMEOF($('#mc').value.trim().toUpperCase());if(n)$('#mn').value=n};
$('#madd').onclick=()=>{const g=i=>$('#m'+i).value,sym=g('c').trim().toUpperCase(),qty=+g('q'),price=+g('p'),tt=g('t')||'09:00';
 if(!g('d')||!sym||!qty||!price){$('#msg').textContent='日付・コード・株数・価格を入力してください';return}
 EX.push({id:'m'+Date.now()+Math.random(),date:g('d').replace(/-/g,'/'),time:tt.length==5?tt+':00':tt,sym,name:$('#mn').value.trim()||sym,side:g('s')=='b'?1:-1,qty,price,fee:+g('f')||0});save();render();$('#msg').textContent='約定を追加しました(売買が対になるとトレードとして集計されます)'};

/* 市場環境 / セクター / セットアップ × 成績、セッション状況、AI用プロンプト */
let HIST={},SECMAP={};
(async()=>{try{HIST=(await(await fetch('data/hist.json')).json()).n225||{}}catch(e){}try{(await(await fetch('data/universe.json')).json()).forEach(u=>SECMAP[u.code]=u.sector)}catch(e){}if(EX.length)render()})();
const REG=d=>{const c=HIST[d.replace(/\//g,'-')];return c==null?'不明(日経データなし)':c>0.5?'上昇相場(日経 +0.5%超)':c<-0.5?'下降相場(日経 -0.5%未満)':'レンジ(日経 ±0.5%以内)'};
const JN=t=>(lsGet('jn',{})[t.date+'|'+t.sym+'|'+t.start])||{};
function streakInfo(C){const days={};C.forEach(t=>(days[t.date]??=[]).push(t));const rows=Object.entries(days).sort((a,b)=>a[0]<b[0]?-1:1).map(([d,a])=>{a.sort((x,y)=>x.start<y.start?-1:1);let run=0,mx=0;a.forEach(t=>{if(t.net<0){run++;mx=Math.max(mx,run)}else run=0});return {d,net:a.reduce((x,t)=>x+t.net,0),n:a.length,mx,end:run}});return rows}
function extra(L,C,S,P){
 const sortK=(a,b)=>a.k<b.k?-1:1;
 $('#mktpnl').innerHTML=tbl(grp(L,t=>REG(t.date)).sort(sortK),'市場環境')+'<div class="mu">日経平均の前日比で分類(過去1年分のデータがある日のみ)。期間・銘柄の絞込を反映します。</div>';
 $('#secpnl').innerHTML=tbl(grp(L,t=>SECMAP[t.sym]||'不明').sort((a,b)=>b.p-a.p),'業種')+'<div class="mu">東証33業種(銘柄一覧から取得)で分類します。</div>';
 $('#setuppnl').innerHTML=tbl(grp(L,t=>JN(t).setup||'未設定').sort((a,b)=>b.p-a.p),'セットアップ')+'<div class="mu">下のトレード一覧を開き、日誌の「セットアップ」欄に名前を入れると、ここで勝率・損益を比較できます。</div>';
 const R=streakInfo(C),last=R[R.length-1];if(!last){$('#status').innerHTML='<div class="mu">データなし</div>';return}
 const hist=R.slice(0,-1),bad=hist.filter(x=>x.mx>=Math.max(2,last.end)),avgAll=hist.length?hist.reduce((a,x)=>a+x.net,0)/hist.length:0,avgBad=bad.length?bad.reduce((a,x)=>a+x.net,0)/bad.length:0;
 $('#status').innerHTML=`<div class="kg" style="grid-template-columns:repeat(2,1fr)"><div><small>最新日</small><b>${last.d}</b></div><div><small>損益</small><b class="${cls(last.net)}">${yen(last.net)}</b></div><div><small>トレード数</small><b>${last.n}</b></div><div><small>現在の連敗</small><b class="${last.end>=3?'dn':''}">${last.end}回</b></div></div>`
 +(hist.length?`<div>過去${hist.length}日のうち、${Math.max(2,last.end)}連敗以上になった日は ${bad.length}日。その日の平均損益 <b class="${cls(avgBad)}">${bad.length?yen(avgBad):'—'}</b>(全日平均 ${yen(avgAll)})</div>`:'<div class="mu">過去日のデータがまだありません</div>')
 +'<div class="mu" style="margin-top:3px">過去の自分のデータを表示するだけで、取引の可否を示すものではありません。</div>'}
document.addEventListener('click',e=>{const b=e.target.closest('#subtabs button');if(!b)return;document.querySelectorAll('#subtabs button').forEach(x=>x.classList.toggle('on',x==b));document.querySelectorAll('.subg').forEach(g=>g.classList.toggle('hide',g.dataset.sub!=b.dataset.sub))});
const lines=(rows,u)=>rows.map(r=>`${r.k}: ${r.n}回 勝率${(r.w/r.n*100).toFixed(0)}% 損益${Math.round(r.p).toLocaleString()}円 1回あたり${Math.round(r.p/r.n)}円`).join('\n');
function tradeText(){const L=VIEW,s=stats(L);if(!L.length)return '';const DW='日月火水木金土',avg=a=>a.length?a.reduce((x,t)=>x+t.hold,0)/a.length:0;
 const loss=L.filter(t=>t.net<0).sort((a,b)=>a.net-b.net).slice(0,10).map(t=>{const j=JN(t);return `${t.date} ${t.start} ${t.sym} ${t.name} ${Math.round(t.net)}円 保有${mmss(t.hold)} ${j.setup?'['+j.setup+']':''} 損切りライン:${j.stop||'-'} 買い理由:${j.why_in||'-'} 売り理由:${j.why_out||'-'} 気持ち:${j.memo||'-'}`}).join('\n');
 return `【対象】${$('#dsel').value=='ALL'?'全期間':$('#dsel').value}${$('#ssel').value=='ALL'?'':' / '+$('#ssel').value}
【全体】トレード${s.n}回 勝率${s.wr.toFixed(1)}% 損益${Math.round(s.net)}円 平均利益${Math.round(s.aw)}円 平均損失${Math.round(s.al)}円 PF${isFinite(s.pf)?s.pf.toFixed(2):'-'} 最大連敗${s.mc} 最大DD${Math.round(s.dd)}円 手数料${Math.round(s.fee)}円
【保有時間】勝ち平均${mmss(avg(L.filter(t=>t.net>0)))} 負け平均${mmss(avg(L.filter(t=>t.net<0)))}
【時間帯別(30分)】\n${lines(grp(L,band).sort((a,b)=>a.k<b.k?-1:1))}
【保有時間別】\n${lines(grp(L,t=>hb(t.hold)).sort((a,b)=>HB.indexOf(a.k)-HB.indexOf(b.k)))}
【銘柄別】\n${lines(grp(L,t=>t.sym+' '+t.name).sort((a,b)=>b.p-a.p).slice(0,15))}
【曜日別】\n${lines(grp(L,t=>DW[new Date(t.date.replace(/\//g,'-')).getDay()]))}
【市場環境別】\n${lines(grp(L,t=>REG(t.date)))}
【業種別】\n${lines(grp(L,t=>SECMAP[t.sym]||'不明').sort((a,b)=>b.p-a.p).slice(0,10))}
【セットアップ別】\n${lines(grp(L,t=>JN(t).setup||'未設定'))}
【損失の大きいトレード(日誌つき)】\n${loss||'なし'}`}
const TI='あなたは日本株デイトレードの振り返りアシスタントです。以下の集計データだけを根拠に、事実ベースで整理してください。売買の推奨はせず、データにないことは推測と明示してください。\n依頼: ';
const TK={t_sum:'今日(または対象期間)の総括。良かった点・悪かった点を数字で挙げてください。',t_loss:'負けトレードに共通するパターン(時間帯・保有時間・銘柄・市場環境・日誌の記述)を探してください。',t_time:'時間帯ごとの成績から、自分が強い時間帯と弱い時間帯を整理してください。',t_sym:'銘柄・業種ごとの成績から、得意な銘柄と苦手な銘柄の傾向を整理してください。',t_fix:'次回に向けた改善ポイントを、数字の根拠つきで3つまで挙げてください(ルールとして守れる形で)。'};
Object.keys(TK).forEach(k=>PROMPTS[k]=()=>VIEW.length?TI+TK[k]+'\n\n'+tradeText():'(収支タブにデータがありません。CSVを読み込むか手入力してください)');
render();
