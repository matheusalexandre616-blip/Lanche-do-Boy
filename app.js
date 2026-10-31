const PHOTOS={};let LOGO='',LOGO_SM='';

(function(){
"use strict";
/* ------------------------------ utilidades ------------------------------ */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const money=v=>'R$ '+(+v).toFixed(2).replace('.',',');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const digits=s=>String(s||'').replace(/\D/g,'');
const fmtPhone=v=>{let d=digits(v);if(d.length>11&&d.startsWith('55'))d=d.slice(2);d=d.slice(0,11);if(d.length<=2)return d?'('+d:'';if(d.length<=6)return '('+d.slice(0,2)+') '+d.slice(2);if(d.length<=10)return '('+d.slice(0,2)+') '+d.slice(2,6)+(d.length>6?'-'+d.slice(6):'');return '('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7)};
document.addEventListener('input',e=>{const t=e.target;if(t.id==='ck-phone'||t.id==='s-wa'){t.value=fmtPhone(t.value)}if(t.id==='ck-cep'){t.value=fmtCep(t.value)}});
const fmtCep=v=>{const d=digits(v).slice(0,8);return d.length>5?d.slice(0,5)+'-'+d.slice(5):d};
const norm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const feeFor=b=>{const m=BAIRROS.find(x=>norm(x.n)===norm(b));return m?m.fee:(S.settings.feeDefault!=null?+S.settings.feeDefault:8)};
async function lookupCep(cep){
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),6000);
  try{
    const r=await fetch('https://viacep.com.br/ws/'+cep+'/json/',{signal:ctl.signal});
    if(!r.ok)throw 0;const j=await r.json();if(j.erro)return{notfound:true};return j;
  }finally{clearTimeout(t)}
}
let cust=null;
const myOrders=()=>Object.values(S.orders).filter(o=>S.user&&o.cid===S.user.id).sort((a,b)=>b.createdAt-a.createdAt);
function openLogin(next){
  const c=cust||LS.get('lb_cust',{});
  openSheet(`<div class="hd"><button class="back" data-act="close" aria-label="Voltar"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg><span>Voltar</span></button><h2>${next==='checkout'?'Entre para pedir':'Entrar'}</h2></div>
  <form class="bd" id="cl" novalidate><p class="mini" style="margin:0">Informe seu nome e WhatsApp. Assim guardamos seu endereço e você acompanha seus pedidos em qualquer aparelho.</p>
  <div class="f"><label for="cl-name">Seu nome</label><input id="cl-name" autocomplete="name" value="${esc(c.name||'')}"><div class="err" id="cl-en"></div></div>
  <div class="f"><label for="cl-phone">WhatsApp</label><input id="cl-phone" inputmode="tel" autocomplete="tel" maxlength="15" placeholder="(31) 99999-9999" value="${esc(fmtPhone(c.phone||''))}"><div class="err" id="cl-ep"></div></div>
  <button class="btn" type="submit">Entrar</button></form>`,sh=>{
    $('#cl-phone',sh).addEventListener('input',e=>{e.target.value=fmtPhone(e.target.value)});
    $('#cl',sh).addEventListener('submit',e=>{e.preventDefault();const n=$('#cl-name',sh).value.trim(),ph=$('#cl-phone',sh).value.trim();let bad=false;
      $('#cl-en',sh).textContent=n.length>1?'':(bad=true,'Informe seu nome.');$('#cl-ep',sh).textContent=digits(ph).length>=10?'':(bad=true,'Informe o WhatsApp com DDD.');if(bad)return;
      cust={name:n,phone:ph};LS.set('lb_login',cust);LS.set('lb_cust',Object.assign({},LS.get('lb_cust',{}),{name:n,phone:ph}));
      closeSheet();toast('Olá, '+n.split(' ')[0]+'!');render();if(next==='checkout')openCheckout()});
    $('#cl-name',sh).focus({preventScroll:true})});
}
const DASH='- - - - - - - - - - -',LINE='------------------------------------';
function orderMsg(o,intro){
  const L=[];
  if(intro!==false)L.push('Muito obrigado por realizar seu pedido conosco, *'+o.customer.name+'*! Segue abaixo um resumo do seu pedido','');
  L.push('*Pedido #'+o.code+'*',LINE,'▶️ *TOTAL = '+money(o.total)+'*',LINE,'');
  o.items.forEach(it=>{L.push('*'+it.qty+'x '+it.name+'* ('+money(it.unit*it.qty)+')');
    (it.extras||[]).forEach(x=>L.push('  (1x) '+x));(it.removed||[]).forEach(x=>L.push('  (1x) Retirar '+x));if(it.note)L.push('  Obs.: '+it.note);
    L.push('','Subtotal do item: '+money(it.unit*it.qty),DASH,'')});
  L.push(LINE,'▶️ *Dados para entrega*','',
    'Nome: '+o.customer.name,'Endereço: '+o.addr.street+', nº '+o.addr.number,'Bairro: '+o.addr.bairro+(o.addr.cep?'\nCEP: '+o.addr.cep:''));
  if(o.addr.comp)L.push('Complemento/Referência: '+o.addr.comp);
  L.push('WhatsApp: '+fmtPhone(o.customer.phone),'','Taxa de Entrega: '+money(o.fee),'','🕐 Tempo de Entrega: aprox. 40 a 55 min','',
    LINE,'▶️ *TOTAL = '+money(o.total)+'*',LINE,'','▶️ *PAGAMENTO*','');
  const m=o.pay.method;
  L.push(m==='pix'?'Pagamento por Pix'+(S.settings.pix?'\nChave Pix: '+S.settings.pix:''):m==='dinheiro'?'Pagamento em dinheiro na entrega'+(o.pay.change?'\nTroco para: '+money(o.pay.change):''):'Pagamento no cartão na entrega');
  L.push('','🍔 Lanches do Boy · Av. João XXIII, 439');
  return L.join('\n');
}
function openSent(o){
  const msg=orderMsg(o);const store=digits(S.settings.wa);
  const html=`<div class="hd"><button class="back" data-act="close" aria-label="Voltar"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg><span>Voltar</span></button><h2>Pedido enviado</h2></div><div class="bd">
  <div class="card" style="background:var(--ok-soft);border-color:transparent"><b style="color:var(--ok)">Pedido recebido pela hamburgueria!</b><div class="mini" style="color:var(--ok)">Guarde o resumo no seu WhatsApp para acompanhar.</div></div>
  <div class="wamsg"><pre>${esc(msg)}</pre></div>
  <a class="btn ok" target="_blank" rel="noopener" href="${waLink(store?S.settings.wa:o.customer.phone,msg)}">Enviar resumo pelo WhatsApp</a>
  <button class="btn ghost" data-act="copy" data-t="${esc(msg)}">Copiar mensagem</button>
  <button class="btn dark" data-act="track">Acompanhar meu pedido</button></div>`;
  openSheet(html);
}
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;t.setAttribute('role','status');document.body.appendChild(t);setTimeout(()=>t.remove(),2800)}
function copy(txt){return (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('Copiado')).catch(()=>toast('Selecione e copie o texto manualmente'))}
const ago=t=>{const m=Math.max(0,Math.round((Date.now()-t)/60000));return m<1?'agora':m<60?m+' min':Math.floor(m/60)+' h '+(m%60)+' min'};
const hhmm=t=>new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});

/* ------------------------------ cardápio ------------------------------ */
const EXTRAS=[{id:'abacaxi',n:'Abacaxi',p:3},{id:'bacon',n:'Bacon',p:10},{id:'batata',n:'Batata',p:3},{id:'catupiry',n:'Catupiry',p:6},{id:'frango',n:'Frango desfiado',p:10},{id:'burger120',n:'Hambúrguer 120g',p:12},{id:'burgerboi',n:'Hambúrguer de boi',p:8},{id:'burgerfrango',n:'Hambúrguer de frango',p:8},{id:'milho',n:'Milho',p:3},{id:'ovo',n:'Ovo',p:3},{id:'presunto',n:'Presunto',p:3},{id:'queijo',n:'Queijo',p:3}];
const EXTRAS_MAC=[{id:'bacon',n:'Bacon',p:10},{id:'calabresa',n:'Calabresa',p:8},{id:'catupiry',n:'Catupiry',p:6},{id:'frango',n:'Frango',p:10},{id:'maionese',n:'Maionese',p:6},{id:'molhoalho',n:'Molho alho',p:6}];
const EXTRAS_MISTO=[{id:'maionese',n:'Maionese',p:6},{id:'molhoverde',n:'Molho verde',p:6},{id:'ovo',n:'Ovo',p:3},{id:'presunto',n:'Presunto',p:3},{id:'queijo',n:'Queijo',p:3}];
const EXTRAS_OMELETE=[{id:'bacon',n:'Bacon',p:10},{id:'catupiry',n:'Catupiry',p:6},{id:'frango',n:'Frango',p:10},{id:'maionese',n:'Maionese',p:6},{id:'milho',n:'Milho',p:3},{id:'molhoverde',n:'Molho verde',p:6},{id:'presunto',n:'Presunto',p:3},{id:'queijo',n:'Queijo',p:3}];
const EXTRA_SETS={mac:EXTRAS_MAC,misto:EXTRAS_MISTO,omelete:EXTRAS_OMELETE};
const REMOVE=['cebola','tomate','alface','milho','batata palha'];
const MENU=[
 {id:'xtudo',cat:'Lanches',name:'X-Tudo',price:20,tag:'Mais pedido',opts:1,art:{t:'b',l:['patty','bacon','egg','chicken','ham','cheese','lettuce','tomato','corn','potato']},desc:'Hambúrguer de boi, bacon, ovo, frango desfiado, presunto, queijo, alface, tomate, milho e batata palha.'},
 {id:'boyburguer',cat:'Lanches',name:'Boy Burguer',price:25,tag:'Da casa',opts:1,art:{t:'b',l:['patty','patty','bacon','egg','chicken','ham','cheese','lettuce','tomato','potato']},desc:'Hambúrguer de boi e de frango, bacon, ovo, frango desfiado, presunto, queijo, alface, tomate e batata palha.'},
 {id:'boyjunior',cat:'Lanches',name:'Boy Júnior',price:28,opts:1,art:{t:'b',l:['patty','chicken','bacon','egg','cheese','ham','lettuce','tomato','corn']},desc:'Hambúrguer de boi 120 g, hambúrguer de frango e o recheio completo da casa.'},
 {id:'california',cat:'Lanches',name:'California',price:22,opts:1,art:{t:'b',l:['patty','egg','bacon','chicken','cheese','lettuce','tomato']},desc:'Pão hambúrguer Boy, ovo, bacon, frango desfiado, queijo, alface e tomate.'},
 {id:'xegg',cat:'Lanches',name:'X-Egg Bacon',price:18,tag:'Mais pedido',opts:1,art:{t:'b',l:['patty','bacon','egg','cheese','lettuce','tomato']},desc:'Por que não deixar tudo mais gostoso com bacon? Pão, bacon, ovo, queijo, hambúrguer, alface e tomate.'},
 {id:'xbacon',cat:'Lanches',name:'X-Bacon',price:18,opts:1,art:{t:'b',l:['patty','bacon','bacon','cheese','lettuce','tomato']},desc:'Talvez o cara mais simpático do cardápio. Afinal, quem não ama bacon? Pão, hambúrguer, bacon, queijo, alface e tomate.'},
 {id:'xgalinha',cat:'Lanches',name:'X-Galinha',price:23,opts:1,art:{t:'b',l:['patty','chicken','bacon','egg','ham','cheese','lettuce']},desc:'Hambúrguer de frango, frango desfiado, bacon, ovo, catupiry, presunto e queijo.'},
 {id:'franburguer',cat:'Lanches',name:'Fran-Burguer',price:18,opts:1,art:{t:'b',l:['patty','egg','bacon','cheese','ham','lettuce','tomato']},desc:'Pão, hambúrguer de frango, ovo, bacon, queijo, presunto, alface e tomate.'},
 {id:'xgg',cat:'Lanches',name:'X-GG Burguer',price:12,opts:1,art:{t:'b',l:['patty','egg','ham','cheese','lettuce','tomato','corn','potato']},desc:'Hambúrguer de boi, ovo, presunto, queijo, alface, tomate, milho e batata palha.'},
 {id:'hamburguer',cat:'Lanches',name:'Hambúrguer',price:9,opts:1,art:{t:'b',l:['patty','lettuce','corn','potato']},desc:'O básico que não deixa na mão! Pão, bife de hambúrguer, batata, milho e molho.'},
 {id:'misto',cat:'Lanches',name:'Misto',price:6,extras:'misto',art:{t:'m',n:1},desc:'Delicioso misto quente com dupla fatia de um suculento presunto e dupla fatia de queijo.'},
 {id:'mistao',cat:'Lanches',name:'Mistão',price:8,extras:'misto',art:{t:'m',n:2},desc:'O misto turbinado do Boy com dupla fatia de um suculento presunto, dupla fatia de uma saborosa mussarela, ovo, milho e salada.'},
 {id:'promo2xgg',cat:'Promoções',name:'Promoção 2 X-GG Bacon',price:34,tag:'2 unidades',opts:1,art:{t:'b',l:['patty','egg','bacon','ham','cheese','lettuce','tomato','corn','potato']},desc:'Dois lanches: carne, ovo, bacon, presunto, mussarela, alface, tomate, milho e batata palha.'},
 {id:'promo2tudo',cat:'Promoções',name:'Promoção 2 X-Tudo',price:38,tag:'2 unidades',opts:1,art:{t:'b',l:['patty','bacon','egg','chicken','ham','cheese','lettuce','tomato','potato']},desc:'Dois lanches: carne, ovo, bacon, frango, presunto, mussarela, alface, tomate e batata palha.'},
 {id:'duplaxgg',cat:'Promoções',name:'2 X-GG Burguer',price:20,tag:'2 unidades',opts:1,art:{t:'b',l:['patty','egg','ham','cheese','lettuce','tomato']},desc:'Dois X-GG Burguer pelo preço da promoção.'},
 {id:'macarrao',cat:'Pratos',name:'Macarrão na Chapa',price:30,extras:'mac',art:{t:'p'},desc:'Macarrão, bacon, calabresa, frango desfiado, cebola, pimentão, tomate, milho e molho shoyu.'},
 {id:'omelete',cat:'Pratos',name:'Omelete do Boy',price:25,extras:'omelete',art:{t:'o'},desc:'Omelete do Boy: 3 ovos, queijo, presunto, frango desfiado, bacon, vinagrete, milho, batata e salada.'},
 {id:'cola2l',cat:'Bebidas',name:'Coca-Cola 2 L',price:15,art:{t:'bt',c:'#2A0F0B',cap:'#D5231B',lab:'COLA',h:1}},
 {id:'cola350',cat:'Bebidas',name:'Coca-Cola lata 350 ml',price:7,art:{t:'can',c1:'#E0302A',c2:'#8E130E',lab:'COLA'}},
 {id:'guarana1l',cat:'Bebidas',name:'Guaraná Antarctica 1 L',price:9,art:{t:'bt',c:'#E7A52A',cap:'#1B7F3B',lab:'GUARANÁ',h:.86}},
 {id:'refri200',cat:'Bebidas',name:'Refrigerante 200 ml',price:4,art:{t:'bt',c:'#C9741E',cap:'#555',lab:'REFRI',h:.62}}
];
const P=Object.fromEntries(MENU.map(p=>[p.id,p]));
const CATS=['Promoções','Lanches','Pratos','Bebidas'];
const STORE={addr:'Avenida João XXIII, 439, Belo Horizonte, Brasil',lat:-19.8415,lng:-43.9710};
/* bairros: coordenadas aproximadas só para ordenar a rota; taxas de exemplo */
const BAIRROS=[
 {n:'Jardim São José',fee:4,lat:-19.8415,lng:-43.9710},{n:'Santa Branca',fee:6,lat:-19.8510,lng:-43.9590},
 {n:'Pampulha',fee:7,lat:-19.8560,lng:-43.9760},{n:'Planalto',fee:7,lat:-19.8350,lng:-43.9380},
 {n:'Céu Azul',fee:8,lat:-19.8240,lng:-43.9450},{n:'Itapoã',fee:7,lat:-19.8570,lng:-43.9890},
 {n:'Jaqueline',fee:8,lat:-19.8320,lng:-43.9860},{n:'São Luiz',fee:6,lat:-19.8680,lng:-43.9600}
];
const BM=Object.fromEntries(BAIRROS.map(b=>[b.n,b]));
const STATUS={novo:'Novo',preparo:'Em preparo',pronto:'Pronto',rota:'Em rota',entregue:'Entregue',cancelado:'Cancelado'};

/* ------------------------------ ilustrações ------------------------------ */
function R(seed){let s=Math.abs(seed|0)%2147483647||1;return()=>(s=s*16807%2147483647)/2147483647}
function wavy(x1,x2,y,amp,n,h){const w=(x2-x1)/n;let d=`M${x1} ${y}`;for(let i=0;i<n;i++)d+=`q${w/4} ${-amp} ${w/2} 0 q${w/4} ${amp} ${w/2} 0`;d+=`L${x2} ${y+h}`;for(let i=0;i<n;i++)d+=`q${-w/4} ${amp*.6} ${-w/2} 0 q${-w/4} ${-amp*.6} ${-w/2} 0`;return d+'Z'}
function burger(layers,seed){
  const r=R(seed);let y=150,o=`<ellipse cx="100" cy="156" rx="84" ry="8" fill="#000" opacity=".3" filter="url(#blur)"/>`;
  o+=`<path d="M34 ${y-14}H166V${y-6}Q166 ${y} 156 ${y}H44Q34 ${y} 34 ${y-6}Z" fill="url(#bunB)"/>`;y-=14;
  for(const l of layers){
    if(l==='patty'){o+=`<rect x="31" y="${y-15}" width="138" height="16" rx="8" fill="url(#patty)"/>`;for(let i=0;i<28;i++)o+=`<ellipse cx="${(38+r()*124).toFixed(1)}" cy="${(y-13+r()*12).toFixed(1)}" rx="${(1+r()*2.2).toFixed(1)}" ry="${(.8+r()).toFixed(1)}" fill="#24110A" opacity=".5"/>`;o+=`<path d="M40 ${y-12}Q100 ${y-16} 160 ${y-12}" stroke="#B87750" stroke-width="1.6" fill="none" opacity=".5" stroke-linecap="round"/>`;y-=14}
    else if(l==='cheese'){o+=`<path d="M29 ${y-5}H171V${y-1}L158 ${y-1}L152 ${y+7}L146 ${y-1}H60L54 ${y+4}L48 ${y-1}H29Z" fill="url(#cheese)"/>`;y-=5}
    else if(l==='bacon'){o+=`<path d="${wavy(30,170,y-6,3,7,6)}" fill="url(#bacon)"/><path d="${wavy(30,170,y-4,2,7,1.6)}" fill="#F3BFA6" opacity=".55"/>`;y-=6}
    else if(l==='egg'){o+=`<path d="M34 ${y}Q30 ${y-7} 52 ${y-8}Q100 ${y-12} 148 ${y-8}Q172 ${y-7} 166 ${y}Q150 ${y+3} 100 ${y+2}Q50 ${y+3} 34 ${y}Z" fill="#FFFDF7"/><ellipse cx="116" cy="${y-8}" rx="17" ry="6.5" fill="url(#yolk)"/>`;y-=8}
    else if(l==='ham'){o+=`<path d="${wavy(28,172,y-4,1.8,6,4)}" fill="url(#ham)"/>`;y-=4}
    else if(l==='lettuce'){o+=`<path d="${wavy(24,176,y-7,5,8,8)}" fill="url(#let)"/><path d="${wavy(24,176,y-5,3,8,0.8)}" fill="#D7F5A6" opacity=".5"/>`;y-=8}
    else if(l==='tomato'){for(let i=0;i<5;i++)o+=`<ellipse cx="${46+i*27}" cy="${y-4}" rx="15" ry="5" fill="url(#tom)"/><ellipse cx="${46+i*27}" cy="${y-5.5}" rx="9" ry="2" fill="#FF9F82" opacity=".5"/>`;y-=7}
    else if(l==='chicken'){let d=`M36 ${y}`;for(let x=36;x<164;x+=14)d+=`Q${x+7} ${(y-8-r()*7).toFixed(1)} ${x+14} ${(y-2-r()*3).toFixed(1)}`;d+=`L164 ${y+1}H36Z`;o+=`<path d="${d}" fill="url(#chick)"/>`;for(let i=0;i<14;i++){const x=42+r()*112;o+=`<path d="M${x.toFixed(1)} ${(y-3-r()*5).toFixed(1)}l${(6+r()*6).toFixed(1)} ${(r()*3-1).toFixed(1)}" stroke="#A3733A" stroke-width="1.3" stroke-linecap="round" opacity=".6"/>`}y-=10}
    else if(l==='corn'){for(let i=0;i<26;i++)o+=`<circle cx="${(38+r()*124).toFixed(1)}" cy="${(y-2-r()*7).toFixed(1)}" r="2.7" fill="#FFD23F" stroke="#E9A21A" stroke-width=".6"/>`;y-=6}
    else if(l==='potato'){for(let i=0;i<34;i++){const x=34+r()*132,yy=y-r()*5;o+=`<path d="M${x.toFixed(1)} ${yy.toFixed(1)}l${(r()*10-5).toFixed(1)} ${(-3-r()*3).toFixed(1)}" stroke="#DDAE5F" stroke-width="1.3" stroke-linecap="round"/>`}y-=3}
  }
  const top=y;
  o+=`<path d="M30 ${top}C30 ${top-54} 170 ${top-54} 170 ${top}Q170 ${top+7} 160 ${top+7}H40Q30 ${top+7} 30 ${top}Z" fill="url(#bunT)"/>`;
  for(let i=0;i<18;i++){const x=50+r()*100,hm=40*Math.sqrt(Math.max(0,1-((x-100)/74)**2)),sy=top-6-r()*Math.max(4,hm-16),a=(r()*70-35).toFixed(0);o+=`<ellipse cx="${x.toFixed(1)}" cy="${(sy+1).toFixed(1)}" rx="3.4" ry="1.8" fill="#8A4E17" opacity=".35" transform="rotate(${a} ${x.toFixed(1)} ${sy.toFixed(1)})"/><ellipse cx="${x.toFixed(1)}" cy="${sy.toFixed(1)}" rx="3.2" ry="1.7" fill="#FFF1D2" transform="rotate(${a} ${x.toFixed(1)} ${sy.toFixed(1)})"/>`}
  o+=`<path d="M56 ${top-20}Q78 ${top-40} 114 ${top-38}" stroke="#fff" stroke-opacity=".38" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  const topY=top-42,H=158-topY,s=Math.min(1,150/H),mid=(topY+158)/2;
  return `<svg viewBox="0 0 200 170" role="img" aria-hidden="true"><g transform="translate(100 85) scale(${s.toFixed(3)}) translate(-100 ${-mid})">${o}</g></svg>`;
}
function sandwich(n,seed){
  const r=R(seed);let o=`<ellipse cx="100" cy="152" rx="84" ry="8" fill="#000" opacity=".3" filter="url(#blur)"/>`;
  const one=(dx,dy,rot)=>{let y=0,g='';const bread=()=>{g+=`<rect x="35" y="${y-16}" width="130" height="16" rx="6" fill="url(#toast)"/>`;for(let i=0;i<6;i++)g+=`<path d="M${46+i*21} ${y-14}l8 12" stroke="#7A4A1E" stroke-width="3" stroke-linecap="round" opacity=".5"/>`;y-=15};
    bread();for(let k=0;k<n;k++){g+=`<path d="${wavy(32,168,y-4,2,6,4)}" fill="url(#ham)"/>`;y-=3;g+=`<path d="M31 ${y-4}H169V${y}L156 ${y}L150 ${y+7}L144 ${y}H70L64 ${y+5}L58 ${y}H31Z" fill="url(#cheese)"/>`;y-=4}
    bread();return `<g transform="translate(${dx} ${dy}) rotate(${rot} 100 ${y/2})">${g}</g>`};
  o+=one(-4,98,-3)+one(8,128,2);
  return `<svg viewBox="0 0 200 170" role="img" aria-hidden="true">${o}</svg>`;
}
function omelete(){
  const r=R(11);let o=`<circle cx="100" cy="88" r="74" fill="#F4F2EE" stroke="#DDD8D0"/><circle cx="100" cy="88" r="62" fill="#fff" stroke="#EAE6DF"/>`;
  o+=`<ellipse cx="96" cy="90" rx="54" ry="34" fill="url(#omel)" transform="rotate(-12 96 90)"/><ellipse cx="96" cy="90" rx="54" ry="34" fill="none" stroke="#D2831A" stroke-width="3" opacity=".5" transform="rotate(-12 96 90)"/>`;
  o+=`<path d="M52 98Q96 64 142 80" stroke="#E5A52B" stroke-width="2.4" fill="none" opacity=".7" stroke-linecap="round"/>`;
  for(let i=0;i<26;i++){const a=r()*6.28,d=r()*13;o+=`<circle cx="${(150+Math.cos(a)*d).toFixed(1)}" cy="${(64+Math.sin(a)*d*.7).toFixed(1)}" r="2.7" fill="#FFD23F" stroke="#E9A21A" stroke-width=".6"/>`}
  for(let i=0;i<36;i++){const x=138+r()*28,yy=104+r()*18;o+=`<path d="M${x.toFixed(1)} ${yy.toFixed(1)}l${(r()*12-6).toFixed(1)} ${(r()*8-4).toFixed(1)}" stroke="#D9A85A" stroke-width="1.3" stroke-linecap="round"/>`}
  o+=`<path d="${wavy(30,62,112,3,3,10)}" fill="url(#let)"/><ellipse cx="46" cy="122" rx="12" ry="4.5" fill="url(#tom)"/>`;
  return `<svg viewBox="0 0 200 170" role="img" aria-hidden="true"><g transform="translate(0 -3)">${o}</g></svg>`;
}
function pasta(){
  const r=R(23);let o=`<circle cx="100" cy="85" r="76" fill="#2A2220"/><circle cx="100" cy="85" r="66" fill="#3A302D"/>`;
  const cols=['#EBBE63','#DDA84A','#F2CC7C'];
  for(let i=0;i<54;i++){const a=r()*6.28,d=r()*46,x=100+Math.cos(a)*d,y=85+Math.sin(a)*d,b=r()*6.28,l=22+r()*24;o+=`<path d="M${x.toFixed(1)} ${y.toFixed(1)}q${(Math.cos(b)*l).toFixed(1)} ${(Math.sin(b)*l*.6).toFixed(1)} ${(Math.cos(b+1)*l).toFixed(1)} ${(Math.sin(b+1)*l).toFixed(1)}" stroke="${cols[i%3]}" stroke-width="3.2" fill="none" stroke-linecap="round" opacity=".95"/>`}
  for(let i=0;i<8;i++){const a=r()*6.28,d=r()*44,x=(100+Math.cos(a)*d).toFixed(1),y=(85+Math.sin(a)*d).toFixed(1);o+=`<circle cx="${x}" cy="${y}" r="7" fill="#A03E2D" stroke="#7A2A1E"/><circle cx="${+x-2}" cy="${+y-1}" r="1.3" fill="#E9A38F"/><circle cx="${+x+2}" cy="${+y+2}" r="1.3" fill="#E9A38F"/>`}
  for(let i=0;i<22;i++){const a=r()*6.28,d=r()*52;o+=`<circle cx="${(100+Math.cos(a)*d).toFixed(1)}" cy="${(85+Math.sin(a)*d).toFixed(1)}" r="2.7" fill="#FFD23F"/>`}
  for(let i=0;i<7;i++){const a=r()*6.28,d=r()*46,x=100+Math.cos(a)*d,y=85+Math.sin(a)*d;o+=`<path d="M${x.toFixed(1)} ${y.toFixed(1)}l9 4" stroke="#5CAE3B" stroke-width="3.4" stroke-linecap="round"/>`}
  for(let i=0;i<6;i++){const a=r()*6.28,d=r()*46;o+=`<rect x="${(100+Math.cos(a)*d).toFixed(1)}" y="${(85+Math.sin(a)*d).toFixed(1)}" width="7" height="4" rx="1.5" fill="#C7452E"/>`}
  return `<svg viewBox="0 0 200 170" role="img" aria-hidden="true">${o}</svg>`;
}
function can(a,k){return `<svg viewBox="0 0 200 170" role="img" aria-hidden="true"><defs><linearGradient id="cg${k}" x1="0" x2="1"><stop offset="0" stop-color="${a.c2}"/><stop offset=".35" stop-color="${a.c1}"/><stop offset=".7" stop-color="${a.c1}"/><stop offset="1" stop-color="${a.c2}"/></linearGradient></defs><ellipse cx="100" cy="153" rx="46" ry="6" fill="#000" opacity=".3" filter="url(#blur)"/><rect x="68" y="30" width="64" height="118" rx="9" fill="url(#cg${k})"/><ellipse cx="100" cy="30" rx="32" ry="6" fill="#D9DDE0"/><ellipse cx="100" cy="30" rx="24" ry="3.6" fill="#B6BBC0"/><ellipse cx="100" cy="148" rx="32" ry="5" fill="${a.c2}"/><path d="M68 98Q100 78 132 98V112Q100 94 68 112Z" fill="#fff" opacity=".9"/><text x="100" y="74" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="19" fill="#fff" letter-spacing="1">${a.lab}</text><rect x="76" y="36" width="7" height="108" rx="3.5" fill="#fff" opacity=".28"/></svg>`}
function bottle(a,k){const h=a.h,top=150-120*h,sh=top+26*h;return `<svg viewBox="0 0 200 170" role="img" aria-hidden="true"><defs><linearGradient id="bg${k}" x1="0" x2="1"><stop offset="0" stop-color="${a.c}"/><stop offset=".4" stop-color="${a.c}" stop-opacity=".78"/><stop offset="1" stop-color="${a.c}"/></linearGradient></defs><ellipse cx="100" cy="154" rx="40" ry="6" fill="#000" opacity=".3" filter="url(#blur)"/><path d="M90 ${top}H110V${sh}Q132 ${sh+8} 132 ${sh+30*h}V146Q132 152 126 152H74Q68 152 68 146V${sh+30*h}Q68 ${sh+8} 90 ${sh}Z" fill="url(#bg${k})" stroke="#fff" stroke-opacity=".25"/><rect x="87" y="${top-9}" width="26" height="11" rx="3" fill="${a.cap}"/><rect x="68" y="${150-58*h-10}" width="64" height="${52*h+10}" fill="${a.cap}" opacity=".92"/><text x="100" y="${150-30*h-2}" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="${a.lab.length>6?12:15}" fill="#fff" letter-spacing=".8">${a.lab}</text><rect x="74" y="${sh+10}" width="6" height="${100*h}" rx="3" fill="#fff" opacity=".3"/></svg>`}
const artCache={};
function artOf(p){if(artCache[p.id])return artCache[p.id];const a=p.art,k=p.id;let s;
  if(a.t==='b')s=burger(a.l,k.length*97+a.l.length*13);else if(a.t==='m')s=sandwich(a.n,5);else if(a.t==='o')s=omelete();else if(a.t==='p')s=pasta();else if(a.t==='can')s=can(a,k);else s=bottle(a,k);
  return artCache[p.id]=s}
const heroBurger=()=>burger(['patty','bacon','egg','cheese','lettuce','tomato'],41);

/* ------------------------------ estado e dados ------------------------------ */
/* ------------------------------ Supabase ------------------------------ */
const SB_URL='https://dvrupqsedmgqpfmoyivm.supabase.co',SB_KEY='sb_publishable_ctbBJtbGA-qDrKwEFs550w_JIH0eeE2';
const sb=supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const S={orders:{},rows:[],settings:{open:true,pix:'',wa:'',drivers:[],soldOut:{},feeDefault:8},photos:{},db:true,drivers:[],user:null};
let rq=0;function emit(){if(rq)return;rq=requestAnimationFrame(()=>{rq=0;render()})}
function dbFail(e){const m=(e&&e.message)||'Não foi possível concluir. Tente de novo.';toast(m);console.warn(e)}
const rowToOrder=r=>{const i=S.drivers.findIndex(d=>d.id===r.driver);return{id:r.id,code:r.code,createdAt:Date.parse(r.created_at),status:r.status,driver:i<0?null:i,cid:r.customer_id,customer:r.customer,addr:r.addr,items:r.items,subtotal:+r.subtotal,fee:+r.fee,total:+r.total,pay:r.pay,pixPaid:r.pix_paid,paid:r.paid,history:r.history||[]}};
function rebuildOrders(){const m={};S.rows.forEach(r=>{m[r.id]=rowToOrder(r)});S.orders=m;S.settings.drivers=S.drivers.map(d=>d.name)}
async function loadOrders(){if(!S.user){S.rows=[];rebuildOrders();emit();return}
  const{data,error}=await sb.from('orders').select('*').order('created_at',{ascending:false}).limit(300);
  if(error){console.warn(error);return}S.rows=data;rebuildOrders();emit()}
async function loadStaff(){if(!S.user||!sess){S.drivers=[];rebuildOrders();return}
  const{data}=await sb.from('staff').select('user_id,name,role,active').eq('role','motoboy').eq('active',true).order('created_at');
  S.drivers=(data||[]).map(d=>({id:d.user_id,name:d.name}));
  if(isMoto()){const i=S.drivers.findIndex(d=>d.id===S.user.id);sess.drv=i<0?0:i}
  rebuildOrders()}
function setList(arr,items){arr.length=0;items.forEach(x=>arr.push(x))}
async function loadCatalog(){
  const[p,e,z,st,ph]=await Promise.all([sb.from('products').select('*').order('sort'),sb.from('extras').select('*'),sb.from('zones').select('*'),sb.from('store_settings').select('*').eq('id',1).maybeSingle(),sb.from('photos').select('*')]);
  if(p.data&&p.data.length){setList(MENU,p.data.map(r=>({id:r.id,cat:r.cat,name:r.name,price:+r.price,tag:r.tag||'',opts:r.opts?1:0,extras:r.extras_set||undefined,desc:r.descr||''})));
    Object.keys(P).forEach(k=>delete P[k]);MENU.forEach(m=>P[m.id]=m);
    const so={};p.data.forEach(r=>{if(r.sold_out)so[r.id]=true});S.settings.soldOut=so}
  if(e.data){const by=k=>e.data.filter(x=>x.set_id===k).map(x=>({id:x.id,n:x.name,p:+x.price}));
    setList(EXTRAS,by('default'));setList(EXTRAS_MAC,by('mac'));setList(EXTRAS_MISTO,by('misto'));setList(EXTRAS_OMELETE,by('omelete'))}
  if(z.data&&z.data.length){setList(BAIRROS,z.data.map(r=>({n:r.bairro,fee:+r.fee,lat:r.lat,lng:r.lng})));Object.keys(BM).forEach(k=>delete BM[k]);BAIRROS.forEach(b=>BM[b.n]=b)}
  if(st.data){S.settings.open=st.data.open;S.settings.pix=st.data.pix||'';S.settings.wa=st.data.wa||'';S.settings.feeDefault=+st.data.fee_default}
  if(ph.data){const m={};ph.data.forEach(r=>m[r.product_id]=r.data);S.photos=m}
  emit()}
async function saveOrder(){}
async function removeOrder(){}
async function saveSettings(){emit();const{error}=await sb.from('store_settings').update({open:S.settings.open,pix:S.settings.pix,wa:S.settings.wa,fee_default:S.settings.feeDefault}).eq('id',1);if(error)dbFail(error)}
async function savePhoto(id,img){S.photos[id]=img;emit();const{error}=await sb.from('photos').upsert({product_id:id,data:img});if(error)dbFail(error)}
async function setSold(id){const v=!S.settings.soldOut[id];const so=Object.assign({},S.settings.soldOut);if(v)so[id]=true;else delete so[id];S.settings.soldOut=so;emit();const{error}=await sb.from('products').update({sold_out:v}).eq('id',id);if(error)dbFail(error)}
async function rpc(fn,args){const{data,error}=await sb.rpc(fn,args);if(error){dbFail(error);return{error}}await loadOrders();return{data}}
function upd(){}
let reloadT=0;function reloadSoon(){clearTimeout(reloadT);reloadT=setTimeout(()=>{loadOrders();loadCatalog();loadStaff().then(()=>{loadOrders()})},350)}
async function refreshRole(){
  if(!S.user){setSess(null);S.drivers=[];rebuildOrders();emit();return}
  const{data}=await sb.rpc('my_role');
  if(data==='loja'||data==='motoboy'){setSess({role:data,drv:0})}else setSess(null);
  await loadStaff();await loadOrders();renderTeam();emit()}
function applyUser(u){S.user=u||null;const m=(u&&u.user_metadata)||{};cust=u?{name:m.name||(u.email||'').split('@')[0],phone:m.phone||'',email:u.email}:null;
  if(cust){LS.set('lb_cust',Object.assign({},LS.get('lb_cust',{}),{name:cust.name,phone:cust.phone}))}}
async function initData(){
  const sy=$('#sync');sy.innerHTML='<i></i><span>Ao vivo</span>';
  const{data:{session}}=await sb.auth.getSession();applyUser(session&&session.user);
  sb.auth.onAuthStateChange((ev,ses)=>{applyUser(ses&&ses.user);setTimeout(()=>{refreshRole();emit()},0)});
  await loadCatalog();await refreshRole();
  sb.channel('lb-live').on('postgres_changes',{event:'*',schema:'public'},reloadSoon).subscribe();
  emit();
}
async function renderTeam(){const el=$('#teamList');if(!el||!isLoja())return;
  const[a,b]=await Promise.all([sb.from('staff').select('name,role,active').eq('role','motoboy'),sb.from('staff_invites').select('*')]);
  el.innerHTML=(a.data||[]).map(d=>`<div class="mrow" style="grid-template-columns:1fr auto"><b>${esc(d.name)}</b><span class="pill">ativo</span></div>`).join('')+(b.data||[]).map(d=>`<div class="mrow" style="grid-template-columns:1fr auto"><div><b>${esc(d.name)}</b><span class="mini">${esc(d.email)}</span></div><span class="pill warn">convite pendente</span></div>`).join('')||'<div class="mini">Nenhum motoboy ainda.</div>'}

/* ------------------------------ rota ------------------------------ */
function hav(a,b){const t=x=>x*Math.PI/180,dl=t(b.lng-a.lng),dp=t(b.lat-a.lat),h=Math.sin(dp/2)**2+Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dl/2)**2;return 2*6371*Math.asin(Math.sqrt(h))}
function hash(s){let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return h}
function ptOf(o){const b=BM[o.addr.bairro]||BAIRROS[0],h=hash(o.addr.street+o.addr.number);return{lat:b.lat+((h%1000)/1000-.5)*.006,lng:b.lng+(((h>>10)%1000)/1000-.5)*.006}}
function planRoute(orders){
  const st=orders.map(o=>({o,pt:ptOf(o)}));let rem=st.slice(),path=[],cur=STORE;
  while(rem.length){rem.sort((a,b)=>hav(cur,a.pt)-hav(cur,b.pt));const n=rem.shift();path.push(n);cur=n.pt}
  const len=p=>{let d=0,c=STORE;for(const s of p){d+=hav(c,s.pt);c=s.pt}return d};
  let imp=true,guard=0;while(imp&&guard++<30){imp=false;for(let i=0;i<path.length-1;i++)for(let j=i+1;j<path.length;j++){const np=path.slice(0,i).concat(path.slice(i,j+1).reverse(),path.slice(j+1));if(len(np)<len(path)-1e-6){path=np;imp=true}}}
  let c=STORE,tot=0;path.forEach(s=>{s.km=hav(c,s.pt)*1.35;tot+=s.km;c=s.pt});
  return{stops:path,km:tot,min:Math.round(tot*3.2+path.length*4)};
}
const addrText=o=>`${o.addr.street}, ${o.addr.number} - ${o.addr.bairro}, ${o.addr.city||'Belo Horizonte - MG'}${o.addr.cep?', '+o.addr.cep:''}`;
function mapsLegs(stops){const legs=[];let origin=STORE.addr;for(let i=0;i<stops.length;i+=10){const ch=stops.slice(i,i+10),dest=addrText(ch[ch.length-1].o),wp=ch.slice(0,-1).map(s=>addrText(s.o)).join('|');
  legs.push('https://www.google.com/maps/dir/?api=1&travelmode=driving&origin='+encodeURIComponent(origin)+'&destination='+encodeURIComponent(dest)+(wp?'&waypoints='+encodeURIComponent(wp):''));origin=dest}return legs}
const navLink=o=>'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+encodeURIComponent(addrText(o));
const waLink=(ph,txt)=>{let d=digits(ph);if(d.length<=11)d='55'+d;return 'https://wa.me/'+d+(txt?'?text='+encodeURIComponent(txt):'')};

/* ------------------------------ navegação ------------------------------ */
const VIEWS=['cliente','cozinha','motoboy','entrar'];
const cur=()=>{const h=(location.hash||'').slice(1);return VIEWS.includes(h)?h:'cliente'};
let drv=LS.get('lb_driver',null);
const pinLoja=()=>S.settings.pinLoja||'1234';
const pinOf=i=>(S.settings.pins||[])[i]||String(1111*(i+1));
let sess=null;
const setSess=x=>{sess=x};
const isLoja=()=>sess&&sess.role==='loja', isMoto=()=>sess&&sess.role==='motoboy';
const allowed=v=>v==='cliente'||v==='entrar'||(v==='cozinha'&&isLoja())||(v==='motoboy'&&(isLoja()||isMoto()));
let wanted=null,loginTab='loja',lastAssigned=-1;
function renderLogin(){
  const dn=S.settings.drivers;
  $('#login').innerHTML=`<div class="card" style="max-width:420px;margin:18px auto 0;display:grid;gap:14px">
   <div><b class="d" style="font-size:26px">Acesso da equipe</b><div class="mini">Área restrita. Clientes fazem pedidos na tela inicial.</div></div>
   <div class="tabs" style="box-shadow:none;grid-template-columns:1fr 1fr"><button type="button" data-lt="loja" aria-selected="${loginTab==='loja'}">Hamburgueria</button><button type="button" data-lt="motoboy" aria-selected="${loginTab==='motoboy'}">Motoboy</button></div>
   <form id="lf" class="f" style="gap:12px" novalidate>
    ${loginTab==='motoboy'?`<div class="f"><label for="lf-d">Seu nome</label><select id="lf-d">${dn.map((n,i)=>`<option value="${i}">${esc(n)}</option>`).join('')}</select></div>`:''}
    <div class="f"><label for="lf-p">Senha</label><input id="lf-p" type="password" inputmode="numeric" autocomplete="current-password" placeholder="Digite a senha"><div class="err" id="lf-e" role="alert"></div></div>
    <button class="btn" type="submit">Entrar</button>
    <button class="btn ghost" type="button" data-go="cliente">Voltar ao cardápio</button>
   </form></div>`;
  $('#lf').addEventListener('submit',e=>{e.preventDefault();const pw=$('#lf-p').value.trim();
    if(loginTab==='loja'){if(pw!==pinLoja()){$('#lf-e').textContent='Senha incorreta.';return}setSess({role:'loja'})}
    else{const i=+$('#lf-d').value;if(pw!==pinOf(i)){$('#lf-e').textContent='Senha incorreta.';return}setSess({role:'motoboy',drv:i})}
    const go=wanted&&allowed(wanted)?wanted:(isLoja()?'cozinha':'motoboy');wanted=null;
    if(location.hash==='#'+go)render();else location.hash='#'+go});
  const lp=$('#lf-p');if(lp)lp.focus({preventScroll:true});
}
function render(){
  let v=cur();
  if(!allowed(v)&&sess){location.hash=isMoto()?'#motoboy':'#cozinha';return}
  if(!allowed(v)){wanted=v;v='entrar'}
  if(v==='entrar'&&sess&&allowed(wanted||'x'))v=wanted;
  document.body.dataset.v=v;
  const nav=$('#nav');nav.hidden=!isLoja();$('#logout').hidden=!sess;{const cb=$('#custbtn');cb.hidden=!(v==='cliente'&&!sess);if(cust){cb.textContent='Olá, '+cust.name.split(' ')[0]+' · Sair';cb.dataset.act='clogout'}else{cb.textContent='Entrar';cb.dataset.act='login'}}
  $('#t-cliente').hidden=!isLoja();
  VIEWS.forEach(x=>{$('#v-'+x).hidden=x!==v;{const t=$('#t-'+x);if(t)t.setAttribute('aria-selected',x===v)}});
  const os=Object.values(S.orders);
  const nNovo=os.filter(o=>o.status==='novo').length;
  const setB=(id,n)=>{const e=$(id);e.hidden=!n;e.textContent=n};
  setB('#b-cozinha',nNovo);
  if(isMoto())drv=sess.drv;
  const myDrv=(drv==null||!S.settings.drivers[drv])?0:drv;
  setB('#b-motoboy',os.filter(o=>o.driver===myDrv&&(o.status==='pronto'||o.status==='rota')).length);
  const mine=myOrders().filter(o=>o.status!=='entregue'&&o.status!=='cancelado');
  setB('#b-cliente',0);
  if(v==='cliente')renderCliente(mine);else if(v==='cozinha')renderCozinha();else if(v==='motoboy')renderMoto();else renderLogin();
  renderDock(v,mine);
  syncSettings();
  if(trackOpen)renderTrack();
}
window.addEventListener('hashchange',()=>{closeSheet();render();window.scrollTo(0,0)});

/* ------------------------------ cliente ------------------------------ */
let cart=LS.get('lb_cart',[]),filter='',catOn='';
const cartCount=()=>cart.reduce((a,l)=>a+l.qty,0),cartSub=()=>cart.reduce((a,l)=>a+l.total*l.qty,0);
const saveCart=()=>LS.set('lb_cart',cart);
function thumb(p){const u=S.photos[p.id]||PHOTOS[p.id];if(u)return `<img src="${u}" alt="${esc(p.name)}" loading="lazy">`;return `<img class="nophoto" src="${LOGO_SM}" alt="Lanches do Boy">`;}
function renderCliente(){
  const ha=$('#heroArt');if(!ha.firstElementChild)ha.innerHTML=`<img class="seal" src="${LOGO}" alt="Selo Food Truck Lanches do Boy, desde 2014">`;
  $('#feeMin').textContent='a partir de '+money(Math.min(feeFor(''),...BAIRROS.map(b=>b.fee)));
  const open=S.settings.open;const pill=$('#openPill');pill.className='pill'+(open?'':' closed');pill.lastElementChild.textContent=open?'Aberta agora':'Loja fechada';
  $('#chips').innerHTML=CATS.map(c=>`<button class="chip ${catOn===c?'on':''}" data-act="cat" data-c="${c}">${c}</button>`).join('');
  const f=filter.trim().toLowerCase();
  const list=MENU.filter(p=>!f||(p.name+' '+p.desc).toLowerCase().includes(f));
  let h='';
  const isPromo=p=>p.cat==='Promoções'||p.promo;
  if(!f){const st=MENU.filter(isPromo);if(st.length)h+=`<div class="sec promo" id="cat-Promoções" style="margin-top:6px"><h2>🔥 Promoções <small>${st.length} ${st.length>1?'ofertas':'oferta'}</small></h2><div class="stars">${st.map(p=>{const out=S.settings.soldOut[p.id];return `<button class="star ${out?'out':''}" data-act="prod" data-id="${p.id}" ${out?'disabled':''}><span class="ribbon">Promoção</span><div class="ph">${thumb(p)}</div><div class="b"><b>${esc(p.name)}</b>${p.tag?`<em>${esc(p.tag)}</em>`:''}<div class="pr">${p.old?`<s>${money(p.old)}</s>`:''}<span>${money(p.price)}</span></div><div class="cta">${out?'Esgotado':'Pedir agora'}</div></div></button>`}).join('')}</div></div>`}
  CATS.forEach(c=>{const it=list.filter(p=>p.cat===c);if(!it.length)return;if(!f&&c==='Promoções')return;
    h+=`<div class="sec" id="cat-${c}"><h2>${c} <small>${it.length} ${it.length>1?'itens':'item'}</small></h2><div class="gi">${it.map(p=>{const out=S.settings.soldOut[p.id];return `<button class="item ${out?'out':''}" data-act="prod" data-id="${p.id}" ${out?'disabled':''}><div class="t"><h3>${esc(p.name)}${p.tag?`<span class="tag">${esc(p.tag)}</span>`:''}</h3><p>${esc(p.desc)}</p><div class="price">${money(p.price)}</div></div><div class="ph">${thumb(p)}${out?'<span class="out-tag">Esgotado</span>':'<span class="add">+</span>'}</div></button>`}).join('')}</div></div>`});
  if(!list.length)h=`<div class="empty">Nenhum produto encontrado para "${esc(filter)}".</div>`;
  $('#menu').innerHTML=h;
}
$('#q').addEventListener('input',e=>{filter=e.target.value;renderCliente()});
function renderDock(v,mine){
  const d=$('#dock'),in_=$('#dockIn');
  if(v!=='cliente'){d.hidden=true;return}
  const act=myOrders().filter(o=>o.status!=='entregue'&&o.status!=='cancelado').length;
  const n=cartCount();
  if(!n&&!act){d.hidden=true;return}
  d.hidden=false;
  in_.innerHTML=(act?`<button class="btn round" data-act="track" aria-label="Meus pedidos"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="16.5" r="3"/><circle cx="18" cy="16.5" r="3"/><path d="M6 16.5 9 9.5h5.5l3.5 7"/><path d="M14.5 9.5 13.5 6.5H11"/></svg><span class="badge">${act}</span></button>`:'')+(n?`<button class="btn grow" data-act="cart"><span><span class="cnt">${n}</span>Ver sacola</span><b>${money(cartSub())}</b></button>`:'');
}

/* ------------------------------ sheets ------------------------------ */
let trackOpen=false;
function openSheet(html,onReady){const L=$('#layer');L.innerHTML=`<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;document.body.style.overflow='hidden';trackOpen=false;if(onReady)onReady($('.sheet',L))}
function closeSheet(){$('#layer').innerHTML='';document.body.style.overflow='';trackOpen=false}
function openProduct(id){
  const p=P[id];let qty=1,note='';const ex=new Set(),rm=new Set();
  const list=EXTRA_SETS[p.extras]||EXTRAS;
  const calc=()=>p.price+[...ex].reduce((a,e)=>a+list.find(x=>x.id===e).p,0);
  const html=`<div class="pstick"><button class="back float" data-act="close" aria-label="Voltar ao cardápio"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg><span>Voltar</span></button></div><div class="pbig ph">${thumb(p)}</div><div class="hd"><h2>${esc(p.name)}</h2></div>
  <div class="bd"><p style="margin:0;color:var(--muted)">${esc(p.desc)}</p>
  ${(p.opts||p.extras)?`<div class="opts"><h4>Adicionais (opcional)</h4>${list.map(e=>`<label class="opt"><span>${e.n} <span class="mini">+ ${money(e.p)}</span></span><input type="checkbox" data-ex="${e.id}"></label>`).join('')}</div>${p.opts?`<div class="opts"><h4>Retirar</h4>${REMOVE.map(e=>`<label class="opt"><span>Sem ${e}</span><input type="checkbox" data-rm="${e}"></label>`).join('')}</div>`:''}`:''}
  <div class="f"><label for="pn">Observação</label><textarea id="pn" rows="2" placeholder="Ex.: ponto da carne, sem sal..."></textarea></div>
  <div style="display:flex;gap:12px;align-items:center"><div class="stepper"><button data-q="-1" aria-label="Menos">−</button><span id="pq">1</span><button data-q="1" aria-label="Mais">+</button></div><button class="btn grow" id="padd" style="flex:1"><span>Adicionar</span><span id="ptot"></span></button></div></div>`;
  openSheet(html,sh=>{
    const tot=()=>{$('#ptot',sh).textContent=money(calc()*qty)};tot();
    sh.addEventListener('change',e=>{const t=e.target;if(t.dataset.ex){t.checked?ex.add(t.dataset.ex):ex.delete(t.dataset.ex);t.closest('.opt').classList.toggle('on',t.checked)}if(t.dataset.rm){t.checked?rm.add(t.dataset.rm):rm.delete(t.dataset.rm);t.closest('.opt').classList.toggle('on',t.checked)}tot()});
    sh.addEventListener('click',e=>{const q=e.target.closest('[data-q]');if(q){qty=Math.max(1,Math.min(20,qty+ +q.dataset.q));$('#pq',sh).textContent=qty;tot()}});
    $('#padd',sh).addEventListener('click',()=>{note=$('#pn',sh).value.trim();
      const exs=[...ex].sort(),rms=[...rm].sort(),key=[id,exs,rms,note].join('|');
      const hit=cart.find(l=>l.key===key);if(hit)hit.qty+=qty;else cart.push({key,pid:id,name:p.name,qty,total:calc(),extras:exs.map(e=>list.find(x=>x.id===e).n),xids:exs,removed:rms,note});
      saveCart();closeSheet();toast('Adicionado à sacola');emit()});
  });
}
function openCart(){
  if(!cart.length){closeSheet();return}
  const html=`<div class="hd"><button class="back" data-act="close" aria-label="Voltar"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg><span>Voltar</span></button><h2>Sua sacola</h2></div><div class="bd">
  ${cart.map((l,i)=>`<div class="line"><div><b>${l.qty}× ${esc(l.name)}</b>${l.extras.length?`<small>+ ${esc(l.extras.join(', '))}</small>`:''}${l.removed.length?`<small>sem ${esc(l.removed.join(', '))}</small>`:''}${l.note?`<small>“${esc(l.note)}”</small>`:''}<div class="stepper" style="margin-top:8px"><button data-ci="${i}" data-d="-1" aria-label="Menos">−</button><span>${l.qty}</span><button data-ci="${i}" data-d="1" aria-label="Mais">+</button></div></div><b>${money(l.total*l.qty)}</b></div>`).join('')}
  <div class="sum"><div><span>Subtotal</span><span>${money(cartSub())}</span></div><div class="mini"><span>A taxa de entrega é calculada pelo endereço na próxima etapa.</span></div></div>
  <button class="btn" data-act="checkout" ${S.settings.open?'':'disabled'}>${S.settings.open?'Continuar para entrega':'Loja fechada no momento'}</button></div>`;
  openSheet(html,sh=>sh.addEventListener('click',e=>{const b=e.target.closest('[data-ci]');if(!b)return;const l=cart[+b.dataset.ci];l.qty+= +b.dataset.d;if(l.qty<1)cart.splice(+b.dataset.ci,1);saveCart();emit();openCart()}));
}
function openCheckout(){
  const c=Object.assign({},LS.get('lb_cust',{}),cust||{});
  const html=`<div class="hd"><button class="back" data-act="close" aria-label="Voltar"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg><span>Voltar</span></button><h2>Entrega e pagamento</h2></div><form class="bd" id="ck" novalidate>
  <div class="g2"><div class="f w"><label for="ck-name">Seu nome</label><input id="ck-name" autocomplete="name" value="${esc(c.name||'')}"><div class="err" id="e-name"></div></div>
  <div class="f w"><label for="ck-phone">WhatsApp</label><input id="ck-phone" inputmode="tel" autocomplete="tel" placeholder="(31) 99999-9999" maxlength="15" value="${esc(fmtPhone(c.phone||''))}"><div class="err" id="e-phone"></div></div>
  <div class="f w"><label for="ck-cep">CEP</label><input id="ck-cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9" value="${esc(fmtCep(c.cep||''))}"><div class="mini" id="cep-st" role="status" aria-live="polite">Digite o CEP para preencher o endereço automaticamente.</div><div class="err" id="e-cep"></div></div>
  <div class="f w"><label for="ck-street">Rua ou avenida</label><input id="ck-street" autocomplete="address-line1" value="${esc(c.street||'')}"><div class="err" id="e-street"></div></div>
  <div class="f"><label for="ck-num">Número</label><input id="ck-num" inputmode="numeric" value="${esc(c.num||'')}"><div class="err" id="e-num"></div></div>
  <div class="f"><label for="ck-bairro">Bairro</label><input id="ck-bairro" autocomplete="address-level3" value="${esc(c.bairro||'')}"><div class="err" id="e-bairro"></div></div>
  <div class="f w"><label for="ck-city">Cidade</label><input id="ck-city" autocomplete="address-level2" value="${esc(c.city||'Belo Horizonte - MG')}"></div>
  <div class="f w"><label for="ck-comp">Complemento ou referência</label><input id="ck-comp" value="${esc(c.comp||'')}" placeholder="Apto, bloco, ponto de referência"></div></div>
  <div class="opts"><h4>Pagamento</h4>
   <label class="opt on"><span>Pix (chave aparece após o pedido)</span><input type="radio" name="pay" value="pix" checked></label>
   <label class="opt"><span>Dinheiro na entrega</span><input type="radio" name="pay" value="dinheiro"></label>
   <label class="opt"><span>Cartão na entrega</span><input type="radio" name="pay" value="cartao"></label></div>
  <div class="f" id="chg" hidden><label for="ck-change">Troco para quanto?</label><input id="ck-change" inputmode="decimal" placeholder="Ex.: 50"></div>
  <div class="sum" id="ck-sum"></div>
  <button class="btn" type="submit" ${S.settings.open?'':'disabled'}>${S.settings.open?'Enviar pedido':'Loja fechada no momento'}</button></form>`;
  openSheet(html,sh=>{
    const fee=()=>feeFor($('#ck-bairro',sh).value);
    const sum=()=>{$('#ck-sum',sh).innerHTML=`<div><span>Subtotal</span><span>${money(cartSub())}</span></div><div><span>Entrega</span><span>${money(fee())}</span></div><div class="tot"><span>Total</span><span>${money(cartSub()+fee())}</span></div>`};sum();
    sh.addEventListener('input',e=>{if(e.target.id==='ck-bairro')sum();if(e.target.id==='ck-cep'){const d=digits(e.target.value);if(d.length===8)doCep(d)}});
    let lastCep='';
    const doCep=async d=>{if(d===lastCep)return;lastCep=d;const st=$('#cep-st',sh);st.textContent='Buscando endereço...';
      try{const j=await lookupCep(d);
        if(j.notfound){st.textContent='CEP não encontrado. Confira ou preencha o endereço abaixo.';return}
        if(j.logradouro)$('#ck-street',sh).value=j.logradouro;
        if(j.bairro)$('#ck-bairro',sh).value=j.bairro;
        if(j.localidade)$('#ck-city',sh).value=j.localidade+(j.uf?' - '+j.uf:'');
        st.textContent='Endereço encontrado. Informe o número'+(j.logradouro?'.':' e confira os dados.');sum();$('#ck-num',sh).focus();
      }catch(err){st.textContent='Não foi possível consultar o CEP agora. Preencha o endereço manualmente.'}
    };
    if(digits($('#ck-cep',sh).value).length===8)lastCep=digits($('#ck-cep',sh).value);
    sh.addEventListener('change',e=>{if(e.target.name==='pay'){$$('.opt',sh).forEach(x=>{if(x.querySelector('[name=pay]'))x.classList.toggle('on',x.querySelector('[name=pay]').checked)});$('#chg',sh).hidden=e.target.value!=='dinheiro'}});
    $('#ck',sh).addEventListener('submit',e=>{e.preventDefault();
      const v=id=>$('#'+id,sh).value.trim();let bad=false;const chk=(id,er,ok,msg)=>{$('#'+er,sh).textContent=ok?'':msg;if(!ok)bad=true};
      chk('ck-name','e-name',v('ck-name').length>1,'Informe seu nome.');chk('ck-phone','e-phone',digits(v('ck-phone')).length>=10,'Informe o WhatsApp com DDD.');chk('ck-street','e-street',v('ck-street').length>2,'Informe a rua.');chk('ck-num','e-num',v('ck-num').length>0,'Informe o número.');chk('ck-bairro','e-bairro',v('ck-bairro').length>1,'Informe o bairro.');chk('ck-cep','e-cep',!v('ck-cep')||digits(v('ck-cep')).length===8,'CEP deve ter 8 números.');
      if(bad)return;
      const pay=$('[name=pay]:checked',sh).value;
      const btn=$('#ck button[type=submit]',sh);btn.disabled=true;btn.textContent='Enviando...';
      const payload={items:cart.map(l=>({pid:l.pid,qty:l.qty,extras:l.xids||[],removed:l.removed||[],note:l.note||''})),
        customer:{name:v('ck-name'),phone:v('ck-phone')},
        addr:{cep:v('ck-cep'),street:v('ck-street'),number:v('ck-num'),bairro:v('ck-bairro'),city:v('ck-city')||'Belo Horizonte - MG',comp:v('ck-comp')},
        pay:{method:pay,change:pay==='dinheiro'?parseFloat(v('ck-change').replace(',','.'))||0:0}};
      sb.rpc('create_order',{p:payload}).then(async({data,error})=>{
        if(error){btn.disabled=false;btn.textContent='Enviar pedido';dbFail(error);return}
        const o=rowToOrder(data);S.orders[o.id]=o;
        LS.set('lb_cust',{name:o.customer.name,phone:o.customer.phone,cep:o.addr.cep,street:o.addr.street,num:o.addr.number,bairro:o.addr.bairro,city:o.addr.city,comp:o.addr.comp});
        cart=[];saveCart();closeSheet();toast('Pedido enviado para a hamburgueria');openSent(o);loadOrders()});
    });
  });
}
function openWhere(){
  const q=encodeURIComponent(STORE.addr);
  openSheet(`<div class="hd"><button class="back" data-act="close" aria-label="Voltar"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg><span>Voltar</span></button><h2>Como chegar</h2></div><div class="bd"><div><b>Lanches do Boy</b><div class="mini">${esc(STORE.addr)}</div></div>
  <a class="btn" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">Abrir no Google Maps</a>
  <a class="btn dark" href="https://waze.com/ul?q=${q}&navigate=yes" target="_blank" rel="noopener">Abrir no Waze</a>
  <button class="btn ghost" data-act="copy" data-t="${esc(STORE.addr)}">Copiar endereço</button></div>`);
}
function openTrack(){openSheet('<div class="hd"><button class="back" data-act="close" aria-label="Voltar"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg><span>Voltar</span></button><h2>Meus pedidos</h2></div><div class="bd" id="trk"></div>');trackOpen=true;renderTrack()}
function renderTrack(){
  const t=$('#trk');if(!t)return;
  const my=myOrders();
  if(!my.length){t.innerHTML='<div class="empty">Você ainda não fez pedidos.</div>';return}
  const stp=['novo','preparo','pronto','rota','entregue'],lab=['Recebido','Preparando','Pronto','A caminho','Entregue'];
  t.innerHTML=my.map(o=>{const i=stp.indexOf(o.status);const can=o.status==='cancelado';
    return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><b class="d" style="font-size:20px">Pedido #${o.code}</b><span class="pill ${can?'closed':o.status==='entregue'?'':'warn'}">${STATUS[o.status]}</span></div>
    ${can?'<p class="mini">A hamburgueria não pôde aceitar este pedido. Chame no WhatsApp da loja.</p>':`<div class="steps">${lab.map((l,k)=>`<div class="${k<=i?'on':''}">${l}</div>`).join('')}</div>`}
    <ul style="margin:8px 0;padding-left:18px">${o.items.map(it=>`<li>${it.qty}× ${esc(it.name)}</li>`).join('')}</ul>
    <div class="sum"><div><span>Entrega em ${esc(o.addr.bairro)}</span><span>${money(o.fee)}</span></div><div class="tot"><span>Total</span><span>${money(o.total)}</span></div></div>
    ${o.pay.method==='pix'&&!o.pixPaid&&!can?`<div style="margin-top:10px"><div class="lbl">Pague com Pix e avise a loja</div>${S.settings.pix?`<div class="copy"><span style="flex:1">${esc(S.settings.pix)}</span><button class="btn sm dark" data-act="copy" data-t="${esc(S.settings.pix)}">Copiar</button></div>`:'<div class="mini">A chave Pix será enviada pela loja no WhatsApp.</div>'}</div>`:''}
    ${o.pay.method==='pix'&&o.pixPaid?'<p class="pill" style="margin-top:10px"><i></i>Pix confirmado</p>':''}</div>`}).join('<div style="height:10px"></div>');
}

/* ------------------------------ hamburgueria ------------------------------ */
const COLS=[['novo','Novos'],['preparo','Em preparo'],['pronto','Prontos para sair'],['rota','Em rota']];
function itemsHtml(o){return `<ul>${o.items.map(it=>`<li>${it.qty}× ${esc(it.name)}${(it.extras&&it.extras.length)||(it.removed&&it.removed.length)||it.note?`<small>${it.extras&&it.extras.length?'+ '+esc(it.extras.join(', '))+' ':''}${it.removed&&it.removed.length?'· sem '+esc(it.removed.join(', '))+' ':''}${it.note?'· “'+esc(it.note)+'”':''}</small>`:''}</li>`).join('')}</ul>`}
function payBadge(o){const m=o.pay.method;if(m==='pix')return o.pixPaid?'<span class="pill">Pix pago</span>':'<span class="pill warn">Pix pendente</span>';if(m==='dinheiro')return `<span class="pill warn">Dinheiro${o.pay.change?' · troco p/ '+money(o.pay.change):''}</span>`;return '<span class="pill warn">Cartão na entrega</span>'}
function orderCard(o){
  const dn=S.settings.drivers;let a='';
  if(o.pay.method==='pix'&&!o.pixPaid&&o.status!=='cancelado')a+=`<button class="btn sm ghost" data-act="pix" data-id="${o.id}">Confirmar Pix recebido</button>`;
  if(o.status==='novo')a+=`<button class="btn sm" data-act="st" data-id="${o.id}" data-s="preparo">Aceitar e preparar</button><button class="btn sm ghost" data-act="st" data-id="${o.id}" data-s="cancelado">Recusar</button>`;
  if(o.status==='preparo')a+=`<button class="btn sm ok" data-act="st" data-id="${o.id}" data-s="pronto">Marcar pronto</button>`;
  if(o.status==='pronto')a+=`<select data-act="assign" data-id="${o.id}" aria-label="Destinar a motoboy"><option value="">Escolha o motoboy</option>${dn.map((n,i)=>`<option value="${i}" ${o.driver===i?'selected':''}>${esc(n||'Motoboy '+(i+1))}</option>`).join('')}</select>`;
  if(o.status==='rota')a+=`<button class="btn sm ok" data-act="st" data-id="${o.id}" data-s="entregue">Confirmar entrega</button>`;
  a+=`<a class="btn sm ghost" target="_blank" rel="noopener" href="${waLink(o.customer.phone,orderMsg(o))}">Enviar resumo no WhatsApp</a>`;
  const dr=o.driver!=null&&o.driver!==''?`<span class="pill">🛵 ${esc(dn[o.driver]||'Motoboy')}</span>`:(o.status==='pronto'?'<span class="pill warn">Sem motoboy</span>':'');
  return `<article class="o ${o.status==='novo'?'new':''}"><div class="h"><b>#${o.code}</b><span class="mini">${hhmm(o.createdAt)} · há ${ago(o.createdAt)}</span></div>
   <div><b>${esc(o.customer.name)}</b> <span class="mini">${esc(o.addr.street)}, ${esc(o.addr.number)} · ${esc(o.addr.bairro)} · ${esc(fmtPhone(o.customer.phone))}</span></div>${itemsHtml(o)}
   <div class="meta"><b style="color:var(--ink)">${money(o.total)}</b>${payBadge(o)}${dr}${o.demo?'<span class="pill closed">exemplo</span>':''}</div><div class="acts">${a}</div></article>`}
function renderCozinha(){
  const os=Object.values(S.orders).sort((a,b)=>a.createdAt-b.createdAt);
  const today=os.filter(o=>new Date(o.createdAt).toDateString()===new Date().toDateString()&&o.status!=='cancelado');
  const rev=today.reduce((a,o)=>a+o.total,0);
  $('#stats').innerHTML=`<div class="stat"><b>${os.filter(o=>o.status==='novo').length}</b><span>Novos pedidos</span></div><div class="stat"><b>${os.filter(o=>o.status==='preparo').length}</b><span>Em preparo</span></div><div class="stat"><b>${os.filter(o=>o.status==='rota').length}</b><span>Em rota</span></div><div class="stat"><b>${money(rev)}</b><span>Vendas de hoje (${today.length})</span></div>
   <div class="stat" style="display:flex;flex-direction:column;gap:8px;justify-content:center"><span class="pill ${S.settings.open?'':'closed'}" style="align-self:flex-start"><i></i>${S.settings.open?'Loja aberta':'Loja fechada'}</span><button class="btn sm dark" data-act="toggleOpen">${S.settings.open?'Fechar a loja':'Abrir a loja'}</button></div>`;
  const live=os.filter(o=>o.status!=='entregue'&&o.status!=='cancelado');
  let h='';
  if(!os.length)h=`<div class="sample"><b class="d" style="font-size:22px">Nenhum pedido ainda</b><span class="mini">Os pedidos feitos na aba Cliente aparecem aqui na hora.</span></div>`;
  else{h=COLS.map(([s,t])=>{const l=live.filter(o=>o.status===s);return `<section class="col" data-s="${s}"><h3>${t} <span class="badge">${l.length}</span></h3>${l.map(orderCard).join('')||'<div class="mini" style="padding:8px 4px">Nenhum pedido.</div>'}</section>`}).join('');
    const done=os.filter(o=>o.status==='entregue'||o.status==='cancelado').slice(-8).reverse();
    if(done.length)h+=`<section class="col" style="grid-column:1/-1"><h3>Finalizados </h3>${done.map(o=>`<div class="o"><div class="h"><b>#${o.code}</b><span class="pill ${o.status==='cancelado'?'closed':''}">${STATUS[o.status]}</span></div><div class="mini">${esc(o.customer.name)} · ${esc(o.addr.bairro)} · ${money(o.total)}</div></div>`).join('')}</section>`}
  $('#board').innerHTML=h;
  $('#menuAdmin').innerHTML=MENU.map(p=>`<div class="mrow"><div class="ph">${thumb(p)}</div><div><b>${esc(p.name)}</b><span class="mini">${esc(p.cat)} · ${money(p.price)}${(S.photos[p.id]||PHOTOS[p.id])?' · com foto':''}</span></div><div class="a"><button class="btn sm ghost" data-act="photo" data-id="${p.id}">Foto</button><button class="btn sm ${S.settings.soldOut[p.id]?'dark':'ghost'}" data-act="sold" data-id="${p.id}">${S.settings.soldOut[p.id]?'Esgotado':'Disponível'}</button></div></div>`).join('');
}
function syncSettings(){const m={'s-pix':S.settings.pix,'s-wa':S.settings.wa,'s-fee':String(S.settings.feeDefault!=null?S.settings.feeDefault:8).replace('.',',')};for(const k in m){const e=$('#'+k);if(e&&document.activeElement!==e&&e.value!==(m[k]||''))e.value=m[k]||''}}
['s-pix','s-wa','s-fee'].forEach(id=>$('#'+id).addEventListener('change',e=>{const v=e.target.value.trim();if(id==='s-fee'){const n=parseFloat(v.replace(',','.'));S.settings.feeDefault=isFinite(n)&&n>=0?n:8}else if(id==='s-pix')S.settings.pix=v;else S.settings.wa=v;saveSettings()}));
$('#invF').addEventListener('submit',async e=>{e.preventDefault();const n=$('#inv-name').value.trim(),m=$('#inv-mail').value.trim().toLowerCase();
  if(n.length<2||!/^\S+@\S+\.\S+$/.test(m)){toast('Informe nome e e-mail válidos');return}
  const{error}=await sb.from('staff_invites').upsert({email:m,role:'motoboy',name:n});if(error){dbFail(error);return}
  $('#inv-name').value='';$('#inv-mail').value='';toast('Convite criado. Peça para ele criar a conta com esse e-mail.');renderTeam()});
function bindDrv(){const s=$('#drvSel');if(s)s.addEventListener('change',e=>{drv=+e.target.value;LS.set('lb_driver',drv);render()})}

/* ------------------------------ eventos ------------------------------ */
document.addEventListener('click',e=>{
  const lt=e.target.closest('[data-lt]');if(lt){loginTab=lt.dataset.lt;renderLogin();return}
  const g=e.target.closest('[data-go]');if(g){location.hash='#'+g.dataset.go;return}
  const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act,id=b.dataset.id;
  if(a==='scrim'){if(e.target===b)closeSheet();return}
  if(a==='close')closeSheet();
  else if(a==='cat'){catOn=b.dataset.c;filter='';$('#q').value='';renderCliente();const t=document.getElementById('cat-'+catOn);if(t)t.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}
  else if(a==='prod')openProduct(id);else if(a==='cart')openCart();else if(a==='checkout'){cust?openCheckout():openLogin('checkout')}else if(a==='login')openLogin();else if(a==='clogout'){sb.auth.signOut().then(()=>{toast('Você saiu');render()})}else if(a==='track')openTrack();else if(a==='where')openWhere();
  else if(a==='copy')copy(b.dataset.t);else if(a==='logout'){sb.auth.signOut().then(()=>{setSess(null);location.hash='#cliente';render()})}
  else if(a==='st'){rpc('set_status',{oid:id,ns:b.dataset.s})}
  else if(a==='pix')rpc('confirm_pix',{oid:id});
  else if(a==='toggleOpen'){S.settings.open=!S.settings.open;saveSettings()}
  
  
  else if(a==='photo'){photoFor=id;$('#photoIn').click()}
  else if(a==='sold')setSold(id);
  else if(a==='start'){Promise.all(Object.values(S.orders).filter(o=>o.driver===drv&&o.status==='pronto').map(o=>sb.rpc('set_status',{oid:o.id,ns:'rota'}))).then(()=>{loadOrders();toast('Boa entrega!')})}
});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset&&t.dataset.act==='assign'){const v=t.value===''?null:+t.value;rpc('assign_driver',{oid:t.dataset.id,drv:v==null?null:S.drivers[v].id}).then(r=>{if(!r.error&&v!=null)toast('Pedido destinado a '+S.settings.drivers[v])})}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});
setInterval(()=>{if(cur()==='cozinha'&&!document.hidden&&!$('#layer').children.length)renderCozinha()},60000);
(function(){const l=$('.logo');l.textContent='';l.style.background=`url(${LOGO_SM}) center/cover`;l.style.boxShadow='none'})();
/* ------------------------------ login (Supabase Auth) ------------------------------ */
const BACKSVG='<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
let authMode='in';
function openLogin(next){
  const up=authMode==='up',c=LS.get('lb_cust',{});
  openSheet(`<div class="hd"><button class="back" data-act="close" aria-label="Voltar">${BACKSVG}<span>Voltar</span></button><h2>${up?'Criar conta':(next==='checkout'?'Entre para pedir':'Entrar')}</h2></div>
  <form class="bd" id="cl" novalidate>
  <div class="tabs" style="box-shadow:none;grid-template-columns:1fr 1fr"><button type="button" data-am="in" aria-selected="${!up}">Já tenho conta</button><button type="button" data-am="up" aria-selected="${up}">Criar conta</button></div>
  ${up?`<div class="f"><label for="cl-name">Seu nome</label><input id="cl-name" autocomplete="name" value="${esc(c.name||'')}"></div>
  <div class="f"><label for="cl-phone">WhatsApp</label><input id="cl-phone" inputmode="tel" autocomplete="tel" maxlength="15" placeholder="(31) 99999-9999" value="${esc(fmtPhone(c.phone||''))}"></div>`:''}
  <div class="f"><label for="cl-mail">E-mail</label><input id="cl-mail" type="email" inputmode="email" autocomplete="email"></div>
  <div class="f"><label for="cl-pw">Senha</label><input id="cl-pw" type="password" autocomplete="${up?'new-password':'current-password'}" placeholder="${up?'Mínimo 6 caracteres':''}"><div class="err" id="cl-err" role="alert"></div></div>
  <button class="btn" type="submit">${up?'Criar conta e continuar':'Entrar'}</button></form>`,sh=>{
    const ph=$('#cl-phone',sh);if(ph)ph.addEventListener('input',e=>{e.target.value=fmtPhone(e.target.value)});
    $$('[data-am]',sh).forEach(b=>b.addEventListener('click',()=>{authMode=b.dataset.am;openLogin(next)}));
    $('#cl',sh).addEventListener('submit',async e=>{e.preventDefault();const err=$('#cl-err',sh),btn=$('#cl button[type=submit]',sh);
      const em=$('#cl-mail',sh).value.trim(),pw=$('#cl-pw',sh).value;err.textContent='';
      if(!/^\S+@\S+\.\S+$/.test(em)){err.textContent='Informe um e-mail válido.';return}
      if(pw.length<6){err.textContent='A senha precisa ter ao menos 6 caracteres.';return}
      btn.disabled=true;let r;
      if(up){const n=$('#cl-name',sh).value.trim(),p=$('#cl-phone',sh).value.trim();
        if(n.length<2||digits(p).length<10){err.textContent='Informe seu nome e o WhatsApp com DDD.';btn.disabled=false;return}
        r=await sb.auth.signUp({email:em,password:pw,options:{data:{name:n,phone:p}}});
        if(!r.error&&!r.data.session){err.style.color='var(--ok)';err.textContent='Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.';btn.disabled=false;return}}
      else r=await sb.auth.signInWithPassword({email:em,password:pw});
      if(r.error){err.textContent=r.error.message==='Invalid login credentials'?'E-mail ou senha incorretos.':r.error.message;btn.disabled=false;return}
      applyUser(r.data.user);closeSheet();toast('Olá, '+cust.name.split(' ')[0]+'!');render();if(next==='checkout')openCheckout()});
    const f=$('#cl-name',sh)||$('#cl-mail',sh);f.focus({preventScroll:true})});
}
let staffMode='in';
function renderLogin(){
  const up=staffMode==='up';
  $('#login').innerHTML=`<div class="card" style="max-width:420px;margin:18px auto 0;display:grid;gap:14px">
   <div><b class="d" style="font-size:26px">Acesso da equipe</b><div class="mini">Área restrita à hamburgueria e aos motoboys. Clientes fazem pedidos na tela inicial.</div></div>
   ${S.user&&!sess?`<div class="card" style="background:var(--warn-soft);border-color:transparent"><b>${esc(S.user.email)}</b><div class="mini">Esse e-mail ainda não tem acesso de equipe. Peça à hamburgueria para convidar este e-mail.</div><button class="btn sm ghost" data-act="clogout" style="margin-top:8px">Sair desta conta</button></div>`:''}
   <div class="tabs" style="box-shadow:none;grid-template-columns:1fr 1fr"><button type="button" data-sm="in" aria-selected="${!up}">Entrar</button><button type="button" data-sm="up" aria-selected="${up}">Criar conta</button></div>
   <form id="lf" class="f" style="gap:12px" novalidate>
    <div class="f"><label for="lf-m">E-mail</label><input id="lf-m" type="email" inputmode="email" autocomplete="email"></div>
    <div class="f"><label for="lf-p">Senha</label><input id="lf-p" type="password" autocomplete="${up?'new-password':'current-password'}" placeholder="${up?'Mínimo 6 caracteres':''}"><div class="err" id="lf-e" role="alert"></div></div>
    <button class="btn" type="submit">${up?'Criar conta de equipe':'Entrar'}</button>
    <button class="btn ghost" type="button" data-go="cliente">Voltar ao cardápio</button>
   </form></div>`;
  $$('[data-sm]').forEach(b=>b.addEventListener('click',()=>{staffMode=b.dataset.sm;renderLogin()}));
  $('#lf').addEventListener('submit',async e=>{e.preventDefault();const err=$('#lf-e'),btn=$('#lf button[type=submit]'),em=$('#lf-m').value.trim(),pw=$('#lf-p').value;err.textContent='';err.style.color='';
    if(!/^\S+@\S+\.\S+$/.test(em)||pw.length<6){err.textContent='Informe e-mail e senha (mínimo 6 caracteres).';return}
    btn.disabled=true;let r;
    if(up){r=await sb.auth.signUp({email:em,password:pw,options:{data:{name:em.split('@')[0],phone:''}}});
      if(!r.error&&!r.data.session){err.style.color='var(--ok)';err.textContent='Conta criada! Confirme pelo link enviado ao e-mail e depois entre.';btn.disabled=false;return}}
    else r=await sb.auth.signInWithPassword({email:em,password:pw});
    if(r.error){err.textContent=r.error.message==='Invalid login credentials'?'E-mail ou senha incorretos.':r.error.message;btn.disabled=false;return}
    applyUser(r.data.user);
    const cl=await sb.rpc('claim_staff');
    if(!cl.data){S.user=r.data.user;setSess(null);renderLogin();btn.disabled=false;return}
    await refreshRole();
    const go=wanted&&allowed(wanted)?wanted:(isLoja()?'cozinha':'motoboy');wanted=null;
    if(location.hash==='#'+go)render();else location.hash='#'+go});
  const lp=$('#lf-m');if(lp)lp.focus({preventScroll:true});
}
document.addEventListener('click',e=>{const lt=e.target.closest('[data-lt]');if(lt)e.stopImmediatePropagation()},true);

window.__applyAssets=function(){const lg=$('.logo');if(lg){lg.textContent='';lg.style.background='url('+LOGO_SM+') center/cover'}const ha=$('#heroArt');if(ha)ha.innerHTML='';emit()};
initData();render();
})();
