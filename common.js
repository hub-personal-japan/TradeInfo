const $=s=>document.querySelector(s),pad=n=>String(n).padStart(2,'0');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const yen=n=>(n>0?'+':'')+Math.round(n).toLocaleString('ja-JP')+'円';
const cls=n=>n>0?'up':n<0?'dn':'';
const fx=(n,d=2)=>n==null?'—':Number(n).toLocaleString('ja-JP',{minimumFractionDigits:d,maximumFractionDigits:d});
const pc=n=>n==null?'—':(n>0?'+':'')+n.toFixed(2)+'%';
const API=location.protocol==='file:'?'http://127.0.0.1:8000':'';
let WL={add:[],skip:[]};try{WL=JSON.parse(localStorage.getItem('wl'))||WL}catch(e){}
const saveWL=()=>{try{localStorage.setItem('wl',JSON.stringify(WL))}catch(e){}};
const qs=()=>'codes='+encodeURIComponent(WL.add.map(a=>a[0]+':'+a[1]).join(','))+'&skip='+WL.skip.join(',');
let nextM=0,nextN=0,onM=null,onN=null;
function tick(){const j=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Tokyo'})),hm=j.getHours()*60+j.getMinutes(),wd=j.getDay();
 $('#clock').textContent=j.toLocaleTimeString('ja-JP');
 const st=wd==0||wd==6?'休場日':hm>=540&&hm<690?'前場':hm>=690&&hm<750?'昼休み':hm>=750&&hm<930?'後場':'場外';
 $('#mstate').textContent=st;$('#mstate').className='st'+(st=='前場'||st=='後場'?' on':'');
 const iv=$('#rate')?+$('#rate').value:0,n=Date.now();
 if(onM&&iv&&n>=nextM){nextM=n+iv*1000;onM()}
 if(onN&&n>=nextN){nextN=n+120000;onN()}
 if($('#cd'))$('#cd').textContent=iv?Math.max(0,Math.ceil((nextM-n)/1000))+'秒':'停止'}
setInterval(tick,1000);
