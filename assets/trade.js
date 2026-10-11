/* 収支タブ: 約定履歴CSV/手入力 → FIFOでトレード単位に集計 → 成績・日誌。データはこのブラウザ内にのみ保存 */
let EX=[];try{EX=JSON.parse(localStorage.getItem('ex')||'[]')}catch(e){}
const save=()=>{try{localStorage.setItem('ex',JSON.stringify(EX))}catch(e){}};
let TUI=Object.assign({sub:'d'},lsGet('tui',{}));TUI.p='';TUI.s='ALL';const saveTUI=()=>lsSet('tui',{sub:TUI.sub});
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
 const dsel=$('#dsel'),ssel=$('#ssel'),sy={};let pd=TUI.p;const ps=TUI.s;C.forEach(t=>sy[t.sym]=t.name);
 if(!pd||(pd!='ALL'&&!months.includes(pd)&&!days.includes(pd)))pd=days[0]||'ALL';
 dsel.innerHTML='<option value="ALL">全期間</option><optgroup label="月">'+months.map(m=>`<option>${m}</option>`).join('')+'</optgroup><optgroup label="日">'+days.map(d=>`<option>${d}</option>`).join('')+'</optgroup>';
 ssel.innerHTML='<option value="ALL">全銘柄</option>'+Object.keys(sy).sort().map(s=>`<option value="${esc(s)}">${esc(s+' '+sy[s])}</option>`).join('');
 keep(dsel,pd);keep(ssel,ps);TUI.p=dsel.value;TUI.s=ssel.value;$('#sample').classList.toggle('hide',EX.length>0);
 const ids=['sum','tband','daily','monthly','cmp','sym','hold','dow','trades','mktpnl','secpnl','setuppnl','status'];
 if(!C.length){ids.forEach(i=>$('#'+i).innerHTML='');$('#sum').innerHTML='<div class="mu" style="padding:8px">約定履歴CSVを読み込むと、ここに成績が表示されます(画面にドロップしてもOK)。</div>';VIEW=[];try{extra2([],[],'ALL','ALL')}catch(e){console.error(e)}return}
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

async function readFiles(fs){let add=0,dup=0,errs=[],again=[];if(EX.length)await bkMake('CSV取込の直前');
 for(const f of fs){const ab=await f.arrayBuffer(),hs=await fileHash(ab),H=lsGet('imphash',[]),seen=H.find(x=>x.h==hs),r=importText(decode(ab));if(r.err)errs.push(f.name+': '+r.err);else{add+=r.add;dup+=r.dup;if(seen)again.push(f.name+'('+new Date(seen.t).toLocaleDateString('ja-JP')+'に取込済み)');H.unshift({h:hs,name:f.name,t:Date.now(),add:r.add,dup:r.dup});lsSet('imphash',H.slice(0,50))}}
 save();TUI.p='';TUI.s='ALL';render();$('#msg').textContent=(add||!dup?`${add}件の約定を新規に取り込みました`:'新しい約定はありません(すべて取込済み)')+(add&&dup?`(重複${dup}件はスキップ)`:'')+(again.length?' / 同じファイルを以前取り込んでいます: '+again.join(', ')+'(二重登録はされません)':'')+(errs.length?' / '+errs.join(' / '):'');renderBackup()}
const drop=$('#drop'),fi=$('#file');
drop.onclick=()=>fi.click();drop.onkeydown=e=>{if(e.key=='Enter'||e.key==' '){e.preventDefault();fi.click()}};
fi.onchange=()=>{readFiles([...fi.files]);fi.value=''};
drop.ondragover=e=>{e.preventDefault();drop.classList.add('on')};drop.ondragleave=()=>drop.classList.remove('on');
drop.ondrop=()=>drop.classList.remove('on');
$('#dsel').onchange=()=>{TUI.p=$('#dsel').value;render()};$('#ssel').onchange=()=>{TUI.s=$('#ssel').value;render()};$('#sym').onclick=e=>{const r=e.target.closest('tr[data-s]');if(r){TUI.s=TUI.s==r.dataset.s?'ALL':r.dataset.s;render()}};['dragover','drop'].forEach(n=>document.addEventListener(n,e=>{e.preventDefault();if(n=='drop'&&e.dataTransfer.files.length)readFiles([...e.dataTransfer.files])}));
$('#clear').onclick=()=>{if($('#clear').dataset.arm){bkMake('全データ削除の直前').then(()=>{EX=[];save();render();$('#clear').textContent='全データ削除';delete $('#clear').dataset.arm;$('#msg').textContent='削除しました。「バックアップ・復元」タブの復元ポイントから戻せます';renderBackup()})}else{$('#clear').dataset.arm=1;$('#clear').textContent='もう一度押すと削除';setTimeout(()=>{delete $('#clear').dataset.arm;$('#clear').textContent='全データ削除'},3000)}};

$('#sample').onclick=()=>{const S=[['7203','トヨタ',3100],['8306','三菱UFJ',1900],['9984','ソフトバンクG',8400],['9101','日本郵船',4200]];let id=0;
 ['2026/09/28','2026/09/29','2026/09/30'].forEach(d=>{let m=541;const T=x=>pad(x/60|0)+':'+pad(x%60)+':'+pad(Math.random()*60|0);
  for(let i=0;i<40&&m<880;i++){const [c,n,p]=S[Math.random()*4|0],q=100*(1+(Math.random()*3|0)),dir=Math.random()<.5?1:-1,mv=Math.round(p*(Math.random()-.46)*.006);
   EX.push({id:'s'+id++,date:d,time:T(m),sym:c,name:n,side:dir,qty:q,price:p,fee:0},{id:'s'+id++,date:d,time:T(m+1+(Math.random()*8|0)),sym:c,name:n,side:-dir,qty:q,price:p+dir*mv,fee:0});m+=3+(Math.random()*9|0)}});
 TUI.p='';TUI.s='ALL';render();$('#msg').textContent='サンプルを表示中です。実データを読み込む前に「全データ削除」を押してください'};

const JF=[['setup','セットアップ(例:GU後の押し)'],['stop','損切りライン'],['why_in','買い(エントリー)の理由'],['why_out','売り(決済)の理由'],['memo','備考・そのときの気持ち']];
$('#start').value=lsGet('start','');$('#start').onchange=()=>{lsSet('start',$('#start').value);render()};
$('#mc').oninput=()=>{const n=window.NAMEOF&&NAMEOF($('#mc').value.trim().toUpperCase());if(n)$('#mn').value=n};
$('#madd').onclick=()=>{const g=i=>$('#m'+i).value,sym=g('c').trim().toUpperCase(),qty=+g('q'),price=+g('p'),tt=g('t')||'09:00';
 if(!g('d')||!sym||!qty||!price){$('#msg').textContent='日付・コード・株数・価格を入力してください';return}
 {const dd=g('d').replace(/-/g,'/'),tt2=(g('t')||'09:00').length==5?(g('t')||'09:00')+':00':(g('t')||'09:00'),sd=g('s')=='b'?1:-1;if(EX.some(e=>e.date==dd&&e.time==tt2&&e.sym==sym&&e.side==sd&&e.qty==qty&&e.price==price)&&!confirm('同じ日付・時刻・銘柄・売買・株数・価格の約定が既にあります。それでも追加しますか?')){$('#msg').textContent='重複のため追加しませんでした';return}}
 EX.push({id:'m'+Date.now()+Math.random(),date:g('d').replace(/-/g,'/'),time:tt.length==5?tt+':00':tt,sym,name:$('#mn').value.trim()||sym,side:g('s')=='b'?1:-1,qty,price,fee:+g('f')||0});save();render();$('#msg').textContent='約定を追加しました(売買が対になるとトレードとして集計されます)'};

/* 市場環境 / セクター / セットアップ × 成績、セッション状況、AI用プロンプト */
let HIST={},SECMAP={};
(async()=>{try{HIST=(await(await fetch('data/hist.json')).json()).n225||{}}catch(e){}try{(await(await fetch('data/universe.json')).json()).forEach(u=>SECMAP[u.code]=u.sector)}catch(e){}if(EX.length)render()})();
const regLabel=c=>c>0.5?'上昇相場(日経 +0.5%超)':c<-0.5?'下降相場(日経 -0.5%未満)':'レンジ(日経 ±0.5%以内)';window.REGLABEL=regLabel;
const REG=d=>{const c=HIST[d.replace(/\//g,'-')];return c==null?'不明(日経データなし)':regLabel(c)};
const JN=t=>(lsGet('jn',{})[t.date+'|'+t.sym+'|'+t.start])||{};
function streakInfo(C){const days={};C.forEach(t=>(days[t.date]??=[]).push(t));const rows=Object.entries(days).sort((a,b)=>a[0]<b[0]?-1:1).map(([d,a])=>{a.sort((x,y)=>x.start<y.start?-1:1);let run=0,mx=0;a.forEach(t=>{if(t.net<0){run++;mx=Math.max(mx,run)}else run=0});return {d,net:a.reduce((x,t)=>x+t.net,0),n:a.length,mx,end:run}});return rows}
function extra(L,C,S,P){try{extra2(L,C,S,P)}catch(e){console.error(e)}
 $('#fchip').innerHTML=S=='ALL'?'':`<button id="fclr" class="on">銘柄「${esc(S)}」で絞込中 ×解除</button>`;
 const sortK=(a,b)=>a.k<b.k?-1:1;
 $('#mktpnl').innerHTML=tbl(grp(L,t=>REG(t.date)).sort(sortK),'市場環境')+'<div class="mu">日経平均の前日比で分類(過去1年分のデータがある日のみ)。期間・銘柄の絞込を反映します。</div>';
 $('#secpnl').innerHTML=tbl(grp(L,t=>SECMAP[t.sym]||'不明').sort((a,b)=>b.p-a.p),'業種')+'<div class="mu">東証33業種(銘柄一覧から取得)で分類します。</div>';
 $('#setuppnl').innerHTML=tbl(grp(L,t=>JN(t).setup||'未設定').sort((a,b)=>b.p-a.p),'セットアップ')+'<div class="mu">下のトレード一覧を開き、日誌の「セットアップ」欄に名前を入れると、ここで勝率・損益を比較できます。</div>';
 const R=streakInfo(C),last=R[R.length-1];if(!last){$('#status').innerHTML='<div class="mu">データなし</div>';return}
 const hist=R.slice(0,-1),bad=hist.filter(x=>x.mx>=Math.max(2,last.end)),avgAll=hist.length?hist.reduce((a,x)=>a+x.net,0)/hist.length:0,avgBad=bad.length?bad.reduce((a,x)=>a+x.net,0)/bad.length:0;
 $('#status').innerHTML=`<div class="kg" style="grid-template-columns:repeat(2,1fr)"><div><small>最新日</small><b>${last.d}</b></div><div><small>損益</small><b class="${cls(last.net)}">${yen(last.net)}</b></div><div><small>トレード数</small><b>${last.n}</b></div><div><small>現在の連敗</small><b class="${last.end>=3?'dn':''}">${last.end}回</b></div></div>`
 +(hist.length?`<div>過去${hist.length}日のうち、${Math.max(2,last.end)}連敗以上になった日は ${bad.length}日。その日の平均損益 <b class="${cls(avgBad)}">${bad.length?yen(avgBad):'—'}</b>(全日平均 ${yen(avgAll)})</div>`:'<div class="mu">過去日のデータがまだありません</div>')
 +'<div class="mu" style="margin-top:3px">過去の自分のデータを表示するだけで、取引の可否を示すものではありません。</div>'}
function applySub(){document.querySelectorAll('#subtabs button').forEach(x=>x.classList.toggle('on',x.dataset.sub==TUI.sub));document.querySelectorAll('.subg').forEach(g=>g.classList.toggle('hide',g.dataset.sub!=TUI.sub))}
document.addEventListener('click',e=>{const b=e.target.closest('#subtabs button');if(!b)return;TUI.sub=b.dataset.sub;saveTUI();applySub()});
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
document.addEventListener('click',e=>{const l=e.target.closest('#latest'),c=e.target.closest('#fclr');if(!l&&!c)return;if(l)TUI.p='';TUI.s='ALL';render()});
window.EDGE=()=>{const C=build().filter(t=>!t.open),by=kf=>{const m=new Map();C.forEach(t=>{const k=kf(t),a=m.get(k)||{n:0,w:0,p:0};a.n++;if(t.net>0)a.w++;a.p+=t.net;m.set(k,a)});return m};return {n:C.length,code:by(t=>t.sym),sector:by(t=>SECMAP[t.sym]||'不明'),band:by(band),regime:by(t=>REG(t.date))}};
/* ===== 資金管理・取引計画・検証・日誌・バックアップ(項目1〜6) ===== */
const J0=()=>lsGet('jn',{}),KOF=t=>t.date+'|'+t.sym+'|'+t.start,comma=n=>Math.round(n).toLocaleString('ja-JP'),num0=v=>v===''||v==null||isNaN(+v)?null:+v;
const todayJ=()=>{const d=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Tokyo'}));return d.getFullYear()+'/'+pad(d.getMonth()+1)+'/'+pad(d.getDate())};
const closedAll=()=>build().filter(t=>!t.open);
const RS0={cap:500000,dayLoss:10000,tradeLoss:500,fee:0,unit:1,lev:1,maxTrades:20,streak:3,mPnl:'',mStreak:''};
let RS=Object.assign({},RS0,lsGet('risk',{})),LASTDS=null;const saveRS=()=>lsSet('risk',RS);
/* --- 1. 資金管理・損失制限 --- */
function dayStat(C){const td=todayJ(),days=[...new Set(C.map(t=>t.date))].sort(),d=days.includes(td)?td:(days[days.length-1]||td),T=C.filter(t=>t.date==d).sort((a,b)=>a.start<b.start?-1:1);
 let pnl=T.reduce((a,t)=>a+t.net,0),run=0,mx=0;T.forEach(t=>{if(t.net<0){run++;mx=Math.max(mx,run)}else run=0});let cur=run;const mp=num0(RS.mPnl),ms=num0(RS.mStreak);if(mp!=null)pnl=mp;if(ms!=null)cur=ms;
 const lossToday=Math.max(0,-pnl),remain=Math.max(0,(RS.dayLoss||0)-lossToday),w=[];
 if(RS.dayLoss&&lossToday>=RS.dayLoss)w.push(['stop','1日の損失上限に到達しました('+yen(-lossToday)+' / 上限 -'+comma(RS.dayLoss)+'円)'])
 else if(RS.tradeLoss&&RS.dayLoss&&remain<RS.tradeLoss)w.push(['warn','残りの許容額('+comma(remain)+'円)が1回の許容損失('+comma(RS.tradeLoss)+'円)を下回っています']);
 if(RS.streak&&cur>=RS.streak)w.push(['stop',cur+'連敗中です(停止条件: '+RS.streak+'連敗)']);
 if(RS.maxTrades&&T.length>=RS.maxTrades)w.push(['warn','取引回数が上限('+RS.maxTrades+'回)に達しています']);
 return {d,isToday:d==td,n:T.length,pnl,lossToday,remain,cur,mx,w,manual:mp!=null||ms!=null}}
function riskBar(ds){const b=$('#riskbar');if(!ds||(!ds.n&&!ds.manual)){b.className='hide';return}const stop=ds.w.some(x=>x[0]=='stop');b.className=stop?'stop':ds.w.length?'warn':'';
 b.innerHTML=`<b>リスク</b><span>対象日 ${esc(ds.d.slice(5))}${ds.isToday?'':'(最新の取引日)'}${ds.manual?'(手入力あり)':''}</span><span>損益 <b class="${cls(ds.pnl)}">${yen(ds.pnl)}</b></span><span>残り許容額 <b>${comma(ds.remain)}円</b> / 上限 ${comma(RS.dayLoss)}円</span><span>連敗 <b>${ds.cur}</b>(最大 ${ds.mx})</span><span>取引 ${ds.n}回</span>`+ds.w.map(x=>`<b class="${x[0]=='stop'?'up':'ac'}">⚠ ${esc(x[1])}</b>`).join('')}
function calcFor(e,l,t,sell,ds){const risk=sell?l-e:e-l;if(!(risk>0))return {err:'損切り価格の向きが逆です(買いなら損切りはエントリーより安く、売りなら高く入れてください)'};if(!(RS.tradeLoss>0))return {err:'「1回の許容損失」を設定してください'};
 const allow=Math.max(0,Math.min(RS.tradeLoss,RS.dayLoss?ds.remain:Infinity)),fee=+RS.fee||0,theo=Math.max(0,Math.floor((allow-fee)/risk)),unit=+RS.unit||1,byUnit=Math.floor(theo/unit)*unit,cap=RS.cap?Math.floor(RS.cap*(+RS.lev||1)/e):Infinity,capU=Math.floor(cap/unit)*unit,sh=Math.min(byUnit,capU),gain=t?(sell?e-t:t-e)*sh-fee:null,rr=t?(sell?e-t:t-e)/risk:null;
 return {risk,allow,fee,theo,unit,byUnit,capU,sh,maxLoss:sh*risk+fee,gain,rr}}
function calcHtml(r,ds){if(r.err)return `<div class="warn">${esc(r.err)}</div>`;const w=[];
 if(r.sh==0)w.push('許容損失では1単位も取れません。損切り幅を狭める・許容損失を上げる・売買単位を1株にする、のいずれかが必要です');
 if(r.rr!=null&&r.rr<1)w.push('リスクリワードが1未満です(利確目標が損切り幅より近い)');if(ds.w.some(x=>x[0]=='stop'))w.push('取引停止条件に達しています。新規エントリーは見送りを推奨します');
 return `<div class="kg" style="grid-template-columns:repeat(2,1fr)"><div><small>1株あたりの損失</small><b>${fx(r.risk,2)}円</b></div><div><small>使える許容損失</small><b>${comma(r.allow)}円</b></div><div><small>理論株数(許容損失−手数料)÷損切り幅</small><b>${r.theo}株</b></div><div><small>${r.unit}株単位に切り下げ</small><b>${r.byUnit}株</b></div><div><small>資金×倍率からの上限</small><b>${isFinite(r.capU)?r.capU+'株':'—'}</b></div><div><small>採用する株数</small><b class="ac" style="font-size:16px">${r.sh}株</b></div><div><small>想定最大損失(手数料込み)</small><b class="dn">-${comma(r.maxLoss)}円</b></div><div><small>目標到達時の利益 / R倍率</small><b>${r.gain==null?'—':yen(r.gain)+' / '+r.rr.toFixed(2)+'R'}</b></div></div>`+w.map(x=>`<div class="warn">${esc(x)}</div>`).join('')}
function updRisk(){const C=closedAll(),ds=dayStat(C);LASTDS=ds;riskBar(ds);if(!$('#rstat'))return;
 const pct=RS.dayLoss?Math.min(100,ds.lossToday/RS.dayLoss*100):0;
 $('#rstat').innerHTML=`<div class="kg" style="grid-template-columns:repeat(2,1fr)"><div><small>対象日</small><b>${esc(ds.d)}${ds.isToday?'':'(最新の取引日)'}</b></div><div><small>実現損益</small><b class="${cls(ds.pnl)}">${yen(ds.pnl)}</b></div><div><small>残り許容額</small><b>${comma(ds.remain)}円</b></div><div><small>連敗(現在 / 本日の最大)</small><b class="${ds.cur>=RS.streak?'up':''}">${ds.cur} / ${ds.mx}回</b></div><div><small>取引回数</small><b>${ds.n}回</b></div></div><div class="bar2"><i class="${pct>=100?'s':pct>=60?'w':''}" style="width:${pct}%"></i></div><div class="mu">損失上限の使用率 ${pct.toFixed(0)}%(実現損益のみ。含み損は反映されません)</div>`;
 const e=num0($('#ce').value),l=num0($('#cl').value),t=num0($('#ct').value);$('#rcalc').innerHTML=(e&&l)?calcHtml(calcFor(e,l,t,$('#cs').value=='s',ds),ds):'<div class="mu">エントリー価格と損切り価格を入れると、許容損失から株数を計算します</div>';
 $('#rrules').innerHTML=[['1日の損失上限',RS.dayLoss?`残り ${comma(ds.remain)}円 / 上限 ${comma(RS.dayLoss)}円`:'未設定',ds.w.some(x=>x[1].includes('損失上限'))],['1回の許容損失',RS.tradeLoss?`${comma(RS.tradeLoss)}円(資金の${RS.cap?(RS.tradeLoss/RS.cap*100).toFixed(2):'-'}%)`:'未設定',false],['連敗',`現在 ${ds.cur}回 / 停止条件 ${RS.streak||'-'}回`,RS.streak&&ds.cur>=RS.streak],['取引回数',`${ds.n}回 / 上限 ${RS.maxTrades||'-'}回`,RS.maxTrades&&ds.n>=RS.maxTrades]].map(([a,b,x])=>`<div>${x?'<b class="up">⚠</b>':'<b class="ok">✓</b>'} <b>${a}</b> <span class="mu">${esc(b)}</span></div>`).join('')+(ds.w.length?ds.w.map(x=>`<div class="warn">${esc(x[1])}</div>`).join(''):'<div class="ok">停止条件に該当なし</div>')+'<div class="mu">これは警告表示です。注文を自動で止める機能ではありません。</div>';
 $('#rpct').textContent=RS.cap?`1回の許容損失は資金の${(RS.tradeLoss/RS.cap*100).toFixed(2)}%、1日の上限は資金の${(RS.dayLoss/RS.cap*100).toFixed(2)}%です`:''}
function buildRisk(){const f=(k,l,st='')=>`<label>${l}<input data-r="${k}" type="number" value="${RS[k]}" ${st}></label>`;
 $('#risk').innerHTML=`<div class="cols2"><div class="box"><h4>① 損失の上限を決める</h4><div class="rgrid">${f('cap','資金(円)')}${f('dayLoss','1日の損失上限(円)')}${f('tradeLoss','1回の許容損失(円)')}${f('fee','手数料(往復・円)')}<label>売買単位<select data-r="unit"><option value="1">1株(単元未満株)</option><option value="100">100株</option></select></label>${f('lev','建玉倍率(資金に対する最大)','step="0.1"')}${f('maxTrades','1日の取引回数の上限')}${f('streak','連敗の停止条件(回)')}</div>
 <div class="row"><span class="mu">1回の許容損失:</span>${[0.1,0.25,0.5,1].map(p=>`<button data-q="tradeLoss:${p}">資金の${p}%</button>`).join('')}</div><div class="row"><span class="mu">1日の上限:</span>${[0.5,1,2,3].map(p=>`<button data-q="dayLoss:${p}">資金の${p}%</button>`).join('')}</div><div class="mu" id="rpct"></div></div>
 <div class="box"><h4>② 今日の状況(自動)</h4><div id="rstat"></div><div class="mu" style="margin-top:3px">CSVを取り込む前でも使えるよう、手入力で上書きできます(空欄なら取引データから自動計算)</div><div class="rgrid">${f('mPnl','今日の実現損益(手入力・円)')}${f('mStreak','現在の連敗数(手入力)')}</div></div>
 <div class="box"><h4>③ 損切り価格から株数を計算</h4><div class="rgrid"><label>売買<select id="cs"><option value="b">買い(ロング)</option><option value="s">売り(空売り)</option></select></label><label>エントリー予定価格<input id="ce" type="number" step="0.1"></label><label>損切り価格<input id="cl" type="number" step="0.1"></label><label>利確目標(任意)<input id="ct" type="number" step="0.1"></label></div><div id="rcalc"></div></div>
 <div class="box"><h4>④ 取引停止条件</h4><div id="rrules"></div></div></div>`;
 $('#risk').querySelector('[data-r="unit"]').value=String(RS.unit);updRisk()}
const onR=e=>{const t=e.target,r=t&&t.dataset&&t.dataset.r;if(r){RS[r]=t.value===''?'':+t.value;saveRS();updRisk();return}if(t&&t.id&&/^c[selt]$/.test(t.id))updRisk();if(t&&t.id&&/^pl-/.test(t.id))updPlanCalc()};
document.addEventListener('input',onR);document.addEventListener('change',onR);
document.addEventListener('click',e=>{const q=e.target.closest&&e.target.closest('[data-q]');if(!q)return;const [k,p]=q.dataset.q.split(':');RS[k]=Math.round((RS.cap||0)*(+p)/100);saveRS();const el=$('#risk').querySelector('[data-r="'+k+'"]');if(el)el.value=RS[k];updRisk()});
/* --- 2. 取引前のシナリオ --- */
const PLN=()=>lsGet('plans',[]);
const matchPlan=(t,plans)=>(plans||PLN()).find(p=>p.status!='見送り'&&String(p.date).replace(/-/g,'/')==t.date&&String(p.code).toUpperCase()==String(t.sym).toUpperCase());
const planLine=p=>`${String(p.date).slice(5)} ${p.code} ${p.side=='s'?'売り':'買い'} 予定${p.entry} 損切${p.stop} 目標${p.target||'-'} 株数${p.shares||'-'}`;
function cmpPlan(p,t){const first=t.ex[0].side,long=first>0,inE=t.ex.filter(e=>e.side==first),outE=t.ex.filter(e=>e.side!=first),w=a=>a.reduce((s,e)=>s+e.price*e.qty,0)/(a.reduce((s,e)=>s+e.qty,0)||1),ai=w(inE),ao=outE.length?w(outE):null,q=inE.reduce((s,e)=>s+e.qty,0),risk=Math.abs(p.entry-p.stop)||null,tags=[],worse=long?ai-p.entry:p.entry-ai;
 if(risk&&worse>risk*0.1)tags.push('追いかけ(予定より不利な価格)');if(ao!=null&&p.stop){if(long?ao<p.stop:ao>p.stop)tags.push('損切り超過')}
 if(ao!=null&&p.target){const hit=long?ao>=p.target:ao<=p.target;if(hit)tags.push('目標到達');else if(t.net>0)tags.push('目標前に利確')}if(p.shares&&q>p.shares*1.1)tags.push('過大ロット');
 return {ai,ao,q,tags,R:risk?t.gross/(q*risk):null,worse}}
function updPlanCalc(){const e=num0($('#pl-entry').value),l=num0($('#pl-stop').value),t=num0($('#pl-target').value),sell=$('#pl-side').value=='s',ds=LASTDS||dayStat(closedAll());
 $('#pl-calc').innerHTML=(e&&l)?calcHtml(calcFor(e,l,t,sell,ds),ds):'<div class="mu">エントリー予定価格と損切り価格を入れると、株数とR倍率を自動計算します</div>';const c=window.NAMEOF&&NAMEOF(($('#pl-code').value||'').trim().toUpperCase());$('#pl-name').value=c||''}
function buildPlans(){const td=todayJ().replace(/\//g,'-');
 $('#plans').innerHTML=`<div class="cols2"><div class="box"><h4>新しい計画</h4><div class="rgrid"><label>予定日<input id="pl-date" type="date" value="${td}"></label><label>銘柄コード<input id="pl-code" placeholder="7203"></label><label>銘柄名(自動)<input id="pl-name" readonly></label><label>売買<select id="pl-side"><option value="b">買い</option><option value="s">売り(空売り)</option></select></label><label>エントリー予定価格<input id="pl-entry" type="number" step="0.1"></label><label>損切り価格<input id="pl-stop" type="number" step="0.1"></label><label>利確目標<input id="pl-target" type="number" step="0.1"></label></div>
 <label class="chk" style="display:block;color:var(--mu)">エントリー条件<input id="pl-cond" placeholder="例: VWAPを上抜けて出来高が増えたら" style="width:100%"></label><label style="display:block;color:var(--mu)">取引する根拠<input id="pl-why" placeholder="例: 決算上方修正+業種が強い" style="width:100%"></label><label style="display:block;color:var(--mu)">シナリオが崩れる条件<input id="pl-inv" placeholder="例: 9:30までにORを下抜けたら撤退" style="width:100%"></label>
 <div id="pl-calc"></div><div class="row"><button id="pl-save">計画を保存</button><span class="mu" id="pl-msg"></span></div></div><div class="box"><h4>保存した計画</h4><div id="pl-list"></div></div></div>`;updPlanCalc();renderPlanList()}
function renderPlanList(){const P=PLN().slice().sort((a,b)=>String(b.date)+b.id<String(a.date)+a.id?-1:1);
 $('#pl-list').innerHTML=P.length?'<table><tr><th>計画</th><th>状態</th><th></th></tr>'+P.map(p=>`<tr class="plrow"><td style="text-align:left"><b>${esc(planLine(p))}</b><br><span class="mu">条件: ${esc(p.cond||'-')} / 根拠: ${esc(p.why||'-')} / 崩れる条件: ${esc(p.inv||'-')}${p.rr?' / R倍率 '+p.rr.toFixed(2):''}</span></td><td><select data-ps="${p.id}">${['計画中','実行済','見送り'].map(s=>`<option${p.status==s?' selected':''}>${s}</option>`).join('')}</select></td><td><button data-pdel="${p.id}">削除</button></td></tr>`).join('')+'</table>':'<div class="mu">まだ計画がありません。注文前にここへ記録しておくと、取引後に実績と比較できます</div>'}
document.addEventListener('click',e=>{const s=e.target.closest&&e.target.closest('#pl-save'),d=e.target.closest&&e.target.closest('[data-pdel]');
 if(s){const g=i=>$('#pl-'+i).value,code=g('code').trim().toUpperCase(),en=num0(g('entry')),st=num0(g('stop'));if(!code||!en||!st){$('#pl-msg').textContent='銘柄コード・エントリー予定価格・損切り価格は必須です';return}
  const ds=LASTDS||dayStat(closedAll()),r=calcFor(en,st,num0(g('target')),g('side')=='s',ds),P=PLN();P.push({id:Date.now(),date:g('date'),code,name:g('name'),side:g('side'),cond:g('cond'),entry:en,stop:st,target:num0(g('target')),why:g('why'),inv:g('inv'),shares:r.err?null:r.sh,rr:r.err?null:r.rr,status:'計画中',created:Date.now()});lsSet('plans',P);$('#pl-msg').textContent='保存しました';renderPlanList();render()}
 if(d&&confirm('この計画を削除しますか?')){lsSet('plans',PLN().filter(p=>String(p.id)!=d.dataset.pdel));renderPlanList();render()}});
document.addEventListener('change',e=>{const s=e.target.dataset&&e.target.dataset.ps;if(!s)return;const P=PLN(),p=P.find(x=>String(x.id)==s);if(p){p.status=e.target.value;lsSet('plans',P);render()}});
function renderPlanCmp(C){const P=PLN().filter(p=>p.status!='見送り'),rows=[];let matched=0;
 P.forEach(p=>{const t=C.find(x=>matchPlan(x,[p]));if(t){matched++;const c=cmpPlan(p,t);rows.push(`<tr class="plrow"><td style="text-align:left">${esc(planLine(p))}</td><td style="text-align:left">IN ${fx(c.ai,1)} → OUT ${c.ao==null?'未決済':fx(c.ao,1)} / ${c.q}株 / <b class="${cls(t.net)}">${yen(t.net)}</b>${c.R!=null?' ('+c.R.toFixed(2)+'R)':''}</td><td style="text-align:left">${c.tags.length?c.tags.map(x=>`<span class="tg ${/超過|追いかけ|過大/.test(x)?'warn':''}">${esc(x)}</span>`).join(''):'<span class="ok">計画どおり</span>'}</td></tr>`)}else rows.push(`<tr class="plrow"><td style="text-align:left">${esc(planLine(p))}</td><td class="mu" style="text-align:left">${String(p.date).replace(/-/g,'/')<=todayJ()?'該当する取引なし(見送り?)':'これから'}</td><td></td></tr>`)});
 const unplanned=P.length?C.filter(t=>!matchPlan(t)).length:0;
 $('#plancmp').innerHTML=(rows.length?'<table><tr><th>計画</th><th>実績</th><th>判定</th></tr>'+rows.join('')+'</table>':'<div class="mu">比較できる計画がありません</div>')+(PLN().length?`<div style="margin-top:3px">計画あり ${matched}件 / <b class="${unplanned?'up':''}">計画なしの取引 ${unplanned}件</b>(衝動的な取引の目安)。日付とコードが一致する取引を自動で対応づけます。</div>`:'')}
/* --- 3. 本当に勝てているか --- */
function evalRules(C){const out=new Map(),plans=PLN(),has=plans.length>0,JJ=J0(),byDay={};C.forEach(t=>(byDay[t.date]??=[]).push(t));
 for(const d in byDay){const a=byDay[d].sort((x,y)=>x.start<y.start?-1:1);let cum=0,run=0;a.forEach(t=>{const v=[],j=JJ[KOF(t)]||{};
  if(RS.dayLoss&&-cum>=RS.dayLoss)v.push('1日の損失上限に達した後の取引');if(RS.streak&&run>=RS.streak)v.push(RS.streak+'連敗後の取引');if(RS.tradeLoss&&t.net<-RS.tradeLoss*1.2)v.push('許容損失の超過('+comma(t.net)+'円)');
  const p=has?matchPlan(t,plans):null;if(has&&!p)v.push('計画なしの取引');if(p){cmpPlan(p,t).tags.forEach(x=>{if(x=='損切り超過'||x=='過大ロット')v.push(x)})}if(j.viol)v.push('手動: '+(j.vnote||'ルール違反'));
  out.set(KOF(t),v);cum+=t.net;run=t.net<0?run+1:0})}return out}
const corr=(a,b)=>{const n=a.length;if(n<3)return null;const ma=a.reduce((x,y)=>x+y,0)/n,mb=b.reduce((x,y)=>x+y,0)/n;let sa=0,sb=0,sc=0;for(let i=0;i<n;i++){sa+=(a[i]-ma)**2;sb+=(b[i]-mb)**2;sc+=(a[i]-ma)*(b[i]-mb)}return sa&&sb?sc/Math.sqrt(sa*sb):null};
function renderTruth(L,C){const el=$('#truth');if(!L.length){el.innerHTML='<div class="mu">取引データがありません</div>';return}
 const s=stats(L),R=window.__RULES||new Map(),st=num0($('#start').value)||0,n=L.length;let eq=st,pk=st,dd=0,ddp=0;L.forEach(t=>{eq+=t.net;pk=Math.max(pk,eq);const d=eq-pk;dd=Math.min(dd,d);if(pk>0)ddp=Math.min(ddp,d/pk*100)});
 const be=(s.aw&&s.al)?(-s.al/(s.aw-s.al))*100:null,gw=L.reduce((a,t)=>a+Math.max(t.gross,0),0),feeP=gw?s.fee/gw*100:0,okT=L.filter(t=>!(R.get(KOF(t))||[]).length),bad=L.filter(t=>(R.get(KOF(t))||[]).length),rate=okT.length/n*100;
 const avh=a=>a.length?a.reduce((x,t)=>x+t.hold,0)/a.length:0,wh=avh(L.filter(t=>t.net>0)),lh=avh(L.filter(t=>t.net<0)),cr=corr(L.map(t=>t.hold),L.map(t=>t.net)),bands=grp(L,band).filter(b=>b.n>=3).sort((a,b)=>a.p-b.p);
 const ins=[];if(s.wr>=50&&s.net<0)ins.push(`<b class="up">勝率は${s.wr.toFixed(0)}%ですが、損益は${yen(s.net)}です。</b>平均損失が平均利益の${s.aw?(-s.al/s.aw).toFixed(2):'-'}倍で、損益分岐の勝率は${be?be.toFixed(0):'-'}%のため、勝率が足りていません`);
 else if(be&&s.wr<be)ins.push(`勝率${s.wr.toFixed(0)}%は、損益分岐の勝率(${be.toFixed(0)}%)を下回っています`);
 if(bands.length&&bands[0].p<0)ins.push(`最も負けている時間帯: <b>${esc(bands[0].k)}台</b> ${yen(bands[0].p)}(${bands[0].n}回・勝率${(bands[0].w/bands[0].n*100).toFixed(0)}%)`);
 if(wh&&lh&&lh>wh*1.5)ins.push(`負けトレードの保有時間(${mmss(lh)})が、勝ちトレード(${mmss(wh)})の${(lh/wh).toFixed(1)}倍と長く、損切りが遅い傾向です`);
 if(bad.length){const bp=bad.reduce((a,t)=>a+t.net,0);ins.push(`ルール違反のあった取引 ${bad.length}件の損益合計は <b class="${cls(bp)}">${yen(bp)}</b>(守った取引は ${yen(okT.reduce((a,t)=>a+t.net,0))})`)}
 if(feeP>10)ins.push(`手数料が総利益の${feeP.toFixed(0)}%を占めています(${yen(-s.fee)})`);if(dd<0)ins.push(`最大ドローダウン <b class="dn">${yen(dd)}</b>${ddp?`(資産のピークから ${ddp.toFixed(1)}%)`:''}`);
 const k=(a,b,c)=>`<div><small>${a}</small><b class="${c||''}">${b}</b></div>`;
 el.innerHTML=`<div class="kg" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">${k('期待値(1取引あたりの平均損益)',yen(s.net/n),cls(s.net))}${k('プロフィットファクター',isFinite(s.pf)?s.pf.toFixed(2):'—',s.pf<1?'dn':'')}${k('最大ドローダウン',yen(dd)+(ddp?` (${ddp.toFixed(1)}%)`:''),'dn')}${k('手数料控除後の損益',yen(s.net),cls(s.net))}${k('手数料前の損益 / 手数料',yen(s.gross)+' / '+yen(-s.fee))}${k('勝率 / 損益分岐の勝率',s.wr.toFixed(1)+'% / '+(be?be.toFixed(1)+'%':'—'),be&&s.wr<be?'up':'')}${k('損益比(平均利益÷平均損失)',s.al?(s.aw/-s.al).toFixed(2):'—')}${k('ルール遵守率',rate.toFixed(0)+'%('+okT.length+'/'+n+'件)',rate<80?'up':'ok')}${k('平均保有時間 勝ち / 負け',(wh?mmss(wh):'—')+' / '+(lh?mmss(lh):'—'))}${k('保有時間と損益の相関',cr==null?'—':cr.toFixed(2)+(cr<-0.2?'(長く持つほど悪化)':cr>0.2?'(長く持つほど良い)':'(ほぼ無関係)'))}</div>
 ${ins.length?'<h4 class="ac" style="margin:6px 0 2px">発見(自動)</h4><ul class="ins">'+ins.map(i=>`<li>${i}</li>`).join('')+'</ul>':'<div class="mu">目立った問題は検出されませんでした</div>'}
 <div class="cols2"><div class="box"><h4>ルールを守った取引 / 違反した取引</h4>${tbl([{k:'守った',n:okT.length,w:okT.filter(t=>t.net>0).length,p:okT.reduce((a,t)=>a+t.net,0)},{k:'違反あり',n:bad.length,w:bad.filter(t=>t.net>0).length,p:bad.reduce((a,t)=>a+t.net,0)}].filter(r=>r.n),'区分')}<div class="mu">違反の内訳: ${Object.entries(bad.flatMap(t=>R.get(KOF(t))).reduce((m,v)=>{const k=v.replace(/[((:].*/,'');m[k]=(m[k]||0)+1;return m},{})).map(([a,b])=>esc(a)+' '+b+'件').join(' / ')||'なし'}</div></div>
 <div class="box"><h4>保有時間別の損益</h4>${tbl(grp(L,t=>hb(t.hold)).sort((a,b)=>HB.indexOf(a.k)-HB.indexOf(b.k)),'保有時間')}</div><div class="box"><h4>時間帯別(30分)</h4>${tbl(grp(L,band).sort((a,b)=>a.k<b.k?-1:1),'時間帯')}</div></div>
 <div class="mu">ルール遵守の判定: 1日の損失上限後の取引 / 連敗上限後の取引 / 許容損失の超過 / 計画なしの取引(計画を使っている場合) / 損切り超過 / 過大ロット / 日誌で自分が付けた違反。しきい値は「リスク管理」の設定に連動します。</div>`}
/* --- 5. 取引日誌の強化(感情・ミス・違反・画像) --- */
const MK=['追いかけ買い','損切り遅れ','利確が早すぎ','ナンピン','計画外の取引','過大ロット','連続取引(取り返し)','感情的な取引'],EMO=['','冷静','自信','焦り','欲','恐怖','怒り','退屈・つなぎ'];
function jh(t){const k=KOF(t),j=J0()[k]||{},vs=(window.__RULES&&window.__RULES.get(k))||[],p=matchPlan(t),a=esc(k);
 return `<div class="jn">${JF.map(([f,l])=>`<label>${l}<input data-jk="${a}" data-jf="${f}" value="${esc(j[f]||'')}"></label>`).join('')}</div>
 <div class="jn2"><label>そのときの感情<select data-jk="${a}" data-jf="emo">${EMO.map(e=>`<option${j.emo==e?' selected':''}>${e}</option>`).join('')}</select></label><label class="chk"><input type="checkbox" data-jk="${a}" data-jf="viol"${j.viol?' checked':''}> ルール違反があった</label><label>違反の内容<input data-jk="${a}" data-jf="vnote" value="${esc(j.vnote||'')}"></label></div>
 <div class="mk">${MK.map(m=>`<label class="chk"><input type="checkbox" data-jk="${a}" data-jf="mk" data-v="${esc(m)}"${(j.mk||[]).includes(m)?' checked':''}> ${esc(m)}</label>`).join('')}</div>
 ${vs.length?`<div class="up">自動検知: ${vs.map(esc).join(' / ')}</div>`:''}${p?`<div class="mu">取引前の計画: ${esc(planLine(p))} / 条件: ${esc(p.cond||'-')} / 崩れる条件: ${esc(p.inv||'-')}</div>`:''}
 <div class="imgs">${['in','out'].map(s=>`<div class="islot"><b>${s=='in'?'エントリー時':'決済時'}のチャート</b> <button data-imgbtn="${a}|${s}">画像を選ぶ</button><input type="file" accept="image/*" class="hide" data-img="${a}|${s}"><div class="pz" tabindex="0" data-paste="${a}|${s}">ここをクリック → Ctrl+V で貼り付け</div><div class="ith" data-th="${a}|${s}"></div></div>`).join('')}</div>`}
document.addEventListener('change',e=>{const i=e.target.closest&&e.target.closest('[data-jk]');if(!i)return;const JJ=J0(),k=i.dataset.jk,f=i.dataset.jf,o=(JJ[k]??={});
 if(f=='mk'){const a=new Set(o.mk||[]);i.checked?a.add(i.dataset.v):a.delete(i.dataset.v);o.mk=[...a]}else if(f=='viol')o.viol=i.checked;else o[f]=i.value;lsSet('jn',JJ);if(f=='viol'||f=='mk')renderMistakes(closedAll())});
async function shrinkImg(file){const url=URL.createObjectURL(file),img=await new Promise((res,rej)=>{const m=new Image();m.onload=()=>res(m);m.onerror=rej;m.src=url}),sc=Math.min(1,1280/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);return c.toDataURL('image/jpeg',0.82)}
async function loadThumb(el){const u=await idb.get('img|'+el.dataset.th);el.innerHTML='';if(!u)return;const m=document.createElement('img');m.src=u;m.alt='チャート画像';m.dataset.big='1';const b=document.createElement('button');b.textContent='画像を削除';b.dataset.imgdel=el.dataset.th;el.appendChild(m);el.appendChild(b)}
async function putImg(key,file){try{await idb.set('img|'+key,await shrinkImg(file));document.querySelectorAll('[data-th]').forEach(x=>{if(x.dataset.th==key)loadThumb(x)});$('#msg').textContent='画像を保存しました'}catch(e){$('#msg').textContent='画像を保存できませんでした'}}
document.addEventListener('toggle',e=>{const d=e.target;if(d&&d.tagName=='DETAILS'&&d.open&&d.querySelectorAll)d.querySelectorAll('[data-th]').forEach(loadThumb)},true);
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-imgbtn]'),dl=e.target.closest&&e.target.closest('[data-imgdel]'),bg=e.target.closest&&e.target.closest('img[data-big]');
 if(b){const f=b.parentNode.querySelector('[data-img]');if(f)f.click()}if(dl&&confirm('この画像を削除しますか?')){idb.del('img|'+dl.dataset.imgdel);document.querySelectorAll('[data-th]').forEach(x=>{if(x.dataset.th==dl.dataset.imgdel)x.innerHTML=''})}
 if(bg){const w=window.open('','_blank');if(w)w.document.write('<title>チャート</title><body style="margin:0;background:#000"><img src="'+bg.src+'" style="max-width:100%">')}});
document.addEventListener('change',e=>{const f=e.target.closest&&e.target.closest('[data-img]');if(f&&f.files&&f.files[0]){putImg(f.dataset.img,f.files[0]);f.value=''}});
document.addEventListener('paste',e=>{const a=document.activeElement;if(!a||!a.dataset||!a.dataset.paste)return;const it=[...((e.clipboardData&&e.clipboardData.items)||[])].find(x=>x.type.startsWith('image/'));if(!it)return;e.preventDefault();putImg(a.dataset.paste,it.getAsFile())});
/* 失敗の集計 */
function renderMistakes(C){const JJ=J0(),map=new Map(C.map(t=>[KOF(t),t])),now=Date.now(),tag={},emo={},R=window.__RULES||new Map();let n=0;
 Object.entries(JJ).forEach(([k,j])=>{const t=map.get(k);if(!t)return;if(j.emo||(j.mk||[]).length||j.viol)n++;const d=new Date(t.date.replace(/\//g,'-')).getTime();(j.mk||[]).forEach(m=>{const a=(tag[m]??={n:0,r:0,p:0,last:''});a.n++;a.p+=t.net;if(now-d<=30*86400000)a.r++;if(t.date>a.last)a.last=t.date});if(j.emo){const a=(emo[j.emo]??={n:0,w:0,p:0});a.n++;if(t.net>0)a.w++;a.p+=t.net}});
 const auto={};R.forEach(v=>v.forEach(x=>{const k=x.replace(/[((:].*/,'');auto[k]=(auto[k]||0)+1}));
 const rows=Object.entries(tag).sort((a,b)=>b[1].n-a[1].n);
 $('#mistakes').innerHTML=`<div class="mu">日誌に記録した取引: ${n}件。トレード一覧の各取引を開いて、感情・判断ミス・ルール違反を記録してください。</div>`
 +(rows.length?'<h4 class="ac" style="margin:6px 0 2px">判断ミスの種類(同じ失敗の発生回数)</h4><table><tr><th>失敗</th><th>回数</th><th>直近30日</th><th>該当取引の損益</th><th>最後の発生日</th></tr>'+rows.map(([k,a])=>`<tr><td>${esc(k)}</td><td>${a.n}</td><td class="${a.r>=3?'up':''}">${a.r}${a.r>=3?' ⚠':''}</td><td class="${cls(a.p)}">${yen(a.p)}</td><td>${esc(a.last)}</td></tr>`).join('')+'</table>':'<div class="mu">判断ミスの記録がまだありません</div>')
 +(Object.keys(emo).length?'<h4 class="ac" style="margin:6px 0 2px">感情別の成績</h4>'+tbl(Object.entries(emo).map(([k,a])=>({k,n:a.n,w:a.w,p:a.p})),'感情'):'')
 +(Object.keys(auto).length?'<h4 class="ac" style="margin:6px 0 2px">ルール違反(自動検知+手動)の回数</h4><table><tr><th>違反</th><th>回数</th></tr>'+Object.entries(auto).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')+'</table>':'')}
/* --- 6. バックアップ・復元 --- */
const dlFile=(name,text,mime)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:mime||'application/json'}));a.download=name;a.click()};
const stamp=()=>new Date().toISOString().slice(0,16).replace(/[-:T]/g,'');
const snapData=()=>({v:2,t:Date.now(),ex:EX,jn:J0(),plans:PLN(),risk:RS,start:lsGet('start',''),stars:STARS,imports:lsGet('imphash',[])});
async function bkMake(label){if(!EX.length&&!Object.keys(J0()).length&&!PLN().length)return false;const s=snapData();s.label=label;if(!await idb.set('bk|'+s.t,s))return false;const idx=lsGet('bkidx',[]);idx.unshift({t:s.t,label,n:EX.length,j:Object.keys(s.jn).length,p:s.plans.length});while(idx.length>12){const o=idx.pop();idb.del('bk|'+o.t)}lsSet('bkidx',idx);return true}
function applySnap(s,mode){if(mode=='replace'){EX=s.ex||[];lsSet('jn',s.jn||{});lsSet('plans',s.plans||[]);if(s.risk){RS=Object.assign({},RS0,s.risk);saveRS()}if(s.start!=null)lsSet('start',s.start);STARS=s.stars||[];saveStars()}
 else{const seen=new Set(EX.map(e=>e.id));let n=0;(s.ex||[]).forEach(e=>{if(!seen.has(e.id)){EX.push(e);n++}});lsSet('jn',Object.assign({},s.jn||{},J0()));const ids=new Set(PLN().map(p=>p.id));lsSet('plans',PLN().concat((s.plans||[]).filter(p=>!ids.has(p.id))));if(s.start&&!lsGet('start',''))lsSet('start',s.start);if(s.stars){STARS=[...new Set([...STARS,...s.stars])];saveStars()}}
 save();$('#start').value=lsGet('start','');TUI.p='';TUI.s='ALL';buildRisk();renderPlanList();render()}
async function bkRestore(t){if(!confirm('この復元ポイントに戻します。現在のデータは「復元前の自動保存」として残します。よろしいですか?'))return;await bkMake('復元前の自動保存');const s=await idb.get('bk|'+t);if(!s){$('#msg').textContent='復元ポイントを読み込めませんでした';return}applySnap(s,'replace');$('#msg').textContent='復元しました('+new Date(t).toLocaleString('ja-JP')+' の状態)'}
async function exportJSON(withImg){const s=snapData();s.exported=Date.now();if(withImg){s.img={};for(const k of await idb.keys())if(String(k).startsWith('img|'))s.img[k]=await idb.get(k)}dlFile('daytrade-backup-'+stamp()+'.json',JSON.stringify(s));lsSet('lastexp',Date.now());$('#msg').textContent='バックアップを保存しました'+(withImg?'(画像を含む)':'');renderBackup()}
const csvE=v=>{v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
function exportCSV(kind){let rows;if(kind=='exec'){rows=[['約定日','約定時間','銘柄コード','銘柄名','取引','約定数量','約定単価','手数料']].concat(EX.slice().sort((a,b)=>(a.date+a.time<b.date+b.time)?-1:1).map(e=>[e.date,e.time,e.sym,e.name,e.side>0?'買':'売',e.qty,e.price,e.fee]))}
 else{const JJ=J0(),R=window.__RULES||new Map();rows=[['日付','銘柄コード','銘柄名','方向','開始','終了','株数','平均IN','平均OUT','手数料前損益','手数料','損益','保有秒','セットアップ','感情','判断ミス','ルール違反']].concat(closedAll().sort((a,b)=>(a.date+a.start<b.date+b.start)?-1:1).map(t=>{const f=t.ex[0].side,w=a=>a.length?a.reduce((s,e)=>s+e.price*e.qty,0)/a.reduce((s,e)=>s+e.qty,0):'',j=JJ[KOF(t)]||{};return [t.date,t.sym,t.name,f>0?'買い':'売り',t.start,t.end,t.qty,r2(w(t.ex.filter(e=>e.side==f))),r2(w(t.ex.filter(e=>e.side!=f))),Math.round(t.gross),Math.round(t.fee),Math.round(t.net),t.hold,j.setup||'',j.emo||'',(j.mk||[]).join('/'),(R.get(KOF(t))||[]).join('/')]}))}
 dlFile((kind=='exec'?'executions-':'trades-')+stamp()+'.csv','\ufeff'+rows.map(r=>r.map(csvE).join(',')).join('\r\n'),'text/csv');$('#msg').textContent='CSVを保存しました'}
async function importJSONFile(file,mode){try{const d=JSON.parse(await file.text());if(!Array.isArray(d.ex))throw new Error('形式');
 if(mode=='replace'&&!confirm('現在のデータをバックアップの内容で置き換えます。よろしいですか?(置き換え前の状態は復元ポイントに残します)'))return;await bkMake(mode=='replace'?'置き換え前の自動保存':'読込前の自動保存');const before=EX.length;applySnap(d,mode);if(d.img)for(const k in d.img)await idb.set(k,d.img[k]);
 $('#msg').textContent=`読み込みました(約定 ${before}→${EX.length}件。同じ約定は重複登録しません)`}catch(e){$('#msg').textContent='このファイルは読み込めませんでした(本アプリのバックアップJSONを選んでください)'}renderBackup()}
function renderBackup(){const idx=lsGet('bkidx',[]),imp=lsGet('imphash',[]),le=lsGet('lastexp',0),days=le?Math.floor((Date.now()-le)/86400000):null,old=EX.length&&(le==0||days>=7);
 const b=$('#bkbtn');if(b)b.textContent='バックアップ・復元'+(old?' ⚠':'');
 $('#backup').innerHTML=`<div class="${old?'warn':'mu'}">${le?`最後にバックアップを保存したのは ${new Date(le).toLocaleString('ja-JP')}(${days}日前)`:'まだバックアップを保存していません'}。約定 ${EX.length}件 / 日誌 ${Object.keys(J0()).length}件 / 計画 ${PLN().length}件。データはこのブラウザ内にだけあります。ブラウザの履歴・サイトデータを消すと失われるため、定期的に保存してください。</div>
 <div class="cols2"><div class="box"><h4>書き出し(保存)</h4><div class="row"><button id="bk-json">全データをJSONで保存</button><label class="chk mu"><input type="checkbox" id="bk-img"> 画像も含める</label></div><div class="row"><button id="bk-cx">約定一覧をCSVで保存</button><button id="bk-ct">トレード一覧をCSVで保存</button></div><div class="mu">約定CSVは、そのまま本アプリの「CSV取込」で再び読み込めます。</div></div>
 <div class="box"><h4>読み込み(復元)</h4><div class="row"><label class="chk"><input type="radio" name="bkm" value="merge" checked> 統合(重複はスキップ)</label><label class="chk"><input type="radio" name="bkm" value="replace"> 置き換え</label></div><div class="row"><input type="file" id="bk-file" accept=".json"></div><div class="mu">同じ約定は二重に登録されません。置き換える前の状態は、自動で復元ポイントに残ります。</div></div>
 <div class="box"><h4>復元ポイント(誤操作の取り消し)</h4><div class="row"><button id="bk-now">今の状態を保存</button></div>${idx.length?'<table><tr><th>保存日時</th><th>内容</th><th></th></tr>'+idx.map(x=>`<tr><td>${new Date(x.t).toLocaleString('ja-JP')}</td><td style="text-align:left">${esc(x.label)} / 約定${x.n} 日誌${x.j} 計画${x.p||0}</td><td><button data-bkr="${x.t}">この状態に戻す</button></td></tr>`).join('')+'</table>':'<div class="mu">まだありません。CSV取込・データ削除・置き換えの直前と、毎日の初回起動時に自動で作ります(最新12件)</div>'}</div>
 <div class="box"><h4>CSV取込の履歴(二重取込の検知)</h4>${imp.length?'<table><tr><th>日時</th><th>ファイル</th><th>新規</th><th>重複</th></tr>'+imp.slice(0,15).map(x=>`<tr><td>${new Date(x.t).toLocaleString('ja-JP')}</td><td style="text-align:left">${esc(x.name)}</td><td>${x.add}</td><td>${x.dup}</td></tr>`).join('')+'</table>':'<div class="mu">取込の履歴はありません</div>'}<div class="mu">同じファイルを取り込み直すと、メッセージでお知らせします。約定の同一判定は「日付・時刻・銘柄・売買・株数・単価」です。</div></div></div>`}
document.addEventListener('click',e=>{const g=id=>e.target.closest&&e.target.closest(id);
 if(g('#bk-json'))exportJSON(!!$('#bk-img').checked);else if(g('#bk-cx'))exportCSV('exec');else if(g('#bk-ct'))exportCSV('trades');else if(g('#bk-now')){bkMake('手動保存').then(ok=>{$('#msg').textContent=ok?'復元ポイントを保存しました':'復元ポイントを保存できませんでした(保存するデータが無い、またはブラウザの保存領域が使えません)';renderBackup()})}
 const r=g('[data-bkr]');if(r)bkRestore(+r.dataset.bkr)});
document.addEventListener('change',e=>{if(e.target&&e.target.id=='bk-file'&&e.target.files[0]){const m=document.querySelector('input[name="bkm"]:checked');importJSONFile(e.target.files[0],m?m.value:'merge');e.target.value=''}});
async function fileHash(ab){try{const h=await crypto.subtle.digest('SHA-256',ab);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){return 'len'+ab.byteLength}}
/* --- 取引データを使ったAIプロンプトの追加情報 --- */
function extraText(){const ds=dayStat(closedAll()),R=window.__RULES||new Map(),L=VIEW,bad=L.filter(t=>(R.get(KOF(t))||[]).length),JJ=J0(),plans=PLN(),mk={};Object.entries(JJ).forEach(([k,j])=>(j.mk||[]).forEach(m=>mk[m]=(mk[m]||0)+1));
 return `\n【リスク設定】資金${comma(RS.cap||0)}円 / 1日の損失上限${comma(RS.dayLoss||0)}円 / 1回の許容損失${comma(RS.tradeLoss||0)}円 / 連敗停止${RS.streak}回 / 取引上限${RS.maxTrades}回\n【対象日の状況】${ds.d} 損益${comma(ds.pnl)}円 残り許容額${comma(ds.remain)}円 連敗${ds.cur} 取引${ds.n}回 警告: ${ds.w.map(x=>x[1]).join(' / ')||'なし'}\n【ルール遵守】遵守${L.length-bad.length}/${L.length}件 違反の内訳: ${[...new Set(bad.flatMap(t=>R.get(KOF(t))).map(v=>v.replace(/[((:].*/,'')))].map(k=>k+' '+bad.filter(t=>R.get(KOF(t)).some(v=>v.startsWith(k))).length+'件').join(' / ')||'なし'}\n【判断ミスの記録(回数)】${Object.entries(mk).map(([a,b])=>a+' '+b).join(' / ')||'記録なし'}\n【取引計画との比較】${plans.filter(p=>p.status!='見送り').slice(0,12).map(p=>{const t=closedAll().find(x=>matchPlan(x,[p]));if(!t)return planLine(p)+' → 該当取引なし';const c=cmpPlan(p,t);return planLine(p)+' → IN'+fx(c.ai,1)+' OUT'+(c.ao==null?'-':fx(c.ao,1))+' 損益'+Math.round(t.net)+'円 '+(c.tags.join('・')||'計画どおり')}).join('\n')||'計画の記録なし'}\n【感情の記録(損失の大きい取引)】${L.filter(t=>t.net<0).sort((a,b)=>a.net-b.net).slice(0,8).map(t=>{const j=JJ[KOF(t)]||{};return t.date+' '+t.sym+' '+Math.round(t.net)+'円 感情:'+(j.emo||'-')+' ミス:'+((j.mk||[]).join('/')||'-')}).join('\n')||'なし'}`}
const TK2={t_risk:'リスク管理の点検。損失上限・連敗・許容損失に対して、ルールが守られていたか、どこで破られたかを数字で示してください。',t_plan:'取引前の計画と実際の約定の比較。追いかけ・損切りの遅れ・計画外の取引・過大ロットがどれだけあったかを整理してください。'};
function extra2(L,C,S,P){window.__RULES=evalRules(C);updRisk();renderPlanCmp(C);renderTruth(L,C);renderMistakes(C);renderBackup()}
buildRisk();buildPlans();renderBackup();
(async()=>{if(EX.length&&lsGet('lastauto','')!=todayJ()){if(await bkMake('自動(その日の最初の起動)'))lsSet('lastauto',todayJ());renderBackup()}})();
$('#exp').onclick=()=>exportJSON(false);$('#imp').onclick=()=>$('#impf').click();$('#impf').onchange=()=>{const f=$('#impf').files[0];if(f)importJSONFile(f,'merge');$('#impf').value=''};

Object.assign(TK,TK2);Object.keys(TK).forEach(k=>PROMPTS[k]=()=>VIEW.length?TI+TK[k]+'\n\n'+tradeText()+extraText():'(収支タブにデータがありません。CSVを読み込むか手入力してください)');
applySub();
render();
