/* Rift Skirmish: self-contained game code. */
(function () {
"use strict";
const WORLD = { w: 1536, h: 1024 };
const BASES = [{x:176,y:821},{x:1348,y:138}];
const TOWERS = [{x:500,y:630},{x:1040,y:307}];
const SPELLS = {
  q:{cost:35,cd:4},w:{cost:50,cd:10},e:{cost:40,cd:7},r:{cost:100,cd:32},d:{cost:0,cd:45},f:{cost:0,cd:35}
};
const ITEMS = {blade:{cost:300},heart:{cost:300},lens:{cost:450}};
const dist = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const laneDX=BASES[1].x-BASES[0].x,laneDY=BASES[1].y-BASES[0].y,laneL=Math.hypot(laneDX,laneDY);
const lanePoint = (t,offset=0)=>({x:BASES[0].x+laneDX*t-laneDY/laneL*offset,y:BASES[0].y+laneDY*t+laneDX/laneL*offset});
function walkable(p){
  const t=clamp(((p.x-BASES[0].x)*laneDX+(p.y-BASES[0].y)*laneDY)/(laneL*laneL),-.045,1.045);
  const center=lanePoint(t),side=((p.x-center.x)*-laneDY+(p.y-center.y)*laneDX)/laneL;
  return lanePoint(t,clamp(side,-(t<.13||t>.87?112:88),t<.13||t>.87?112:88));
}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
class Game {
  constructor(){this.reset();}
  reset(){
    this.state='ready';this.time=0;this.id=0;this.entities=[];this.projectiles=[];this.effects=[];this.events=[];this.score=[0,0];this.gold=350;this.cs=0;this.kills=0;this.deaths=0;this.xp=0;this.items=new Set();this.waveTimer=15;this.passiveGold=0;this.selected=null;this.recall=0;this.aim={x:800,y:470};this.moveInput={x:0,y:0};this.wave=0;
    this.towers=TOWERS.map((p,team)=>this.add({kind:'tower',team,...p,maxHp:1600,hp:1600,radius:46,range:265,attack:100,period:1.25}));
    this.nexuses=BASES.map((p,team)=>this.add({kind:'nexus',team,...p,maxHp:2300,hp:2300,radius:58,range:0,attack:0}));
    this.player=this.hero(0,lanePoint(.09,25));this.enemy=this.hero(1,lanePoint(.78,-10));
    this.spawnWave(true);
  }
  add(data){const e={id:++this.id,alive:true,attackTimer:0,attackAnim:0,angle:-.52,speed:0,shield:0,shieldTime:0,slow:0,moving:false,...data};this.entities.push(e);return e;}
  hero(team,p){return this.add({kind:'hero',team,...p,maxHp:team?1150:1100,hp:team?1150:1100,maxMana:620,mana:620,attack:team?62:76,range:103,radius:24,speed:team?173:215,period:team?.95:.73,level:6,cooldowns:{q:0,w:0,e:0,r:0,d:0,f:0},spellPower:1,respawn:0,aiTimer:5,retreating:false});}
  start(){this.state='playing';this.emit('announce','Welcome to the Rift');}
  emit(type,text,data={}){this.events.push({type,text,...data});}
  effect(type,x,y,data={}){this.effects.push({type,x,y,age:0,life:.7,...data});}
  spawnWave(initial=false){
    this.wave++;
    for(let team=0;team<2;team++)for(let i=0;i<4;i++){
      const t=initial?(team?.69-i*.023:.29+i*.023):(team?1-i*.018:i*.018);
      const pos=lanePoint(t,(i%2?1:-1)*(22+Math.floor(i/2)*14));
      this.add({kind:'minion',team,...pos,maxHp:255+Math.min(this.wave*4,130),hp:255+Math.min(this.wave*4,130),radius:14,range:142,speed:62,attack:20+Math.floor(this.wave/3),period:1.12,offset:(i%2?1:-1)*(18+Math.floor(i/2)*12)});
    }
  }
  protected(e){return e.kind==='nexus'&&this.towers[e.team].alive;}
  enemies(e){return this.entities.filter(t=>t.alive&&t.team!==e.team&&!this.protected(t));}
  nearest(e,range=Infinity,filter=()=>true){let best=null,bd=range;for(const t of this.enemies(e)){const d=dist(e,t)-t.radius;if(d<bd&&filter(t)){bd=d;best=t;}}return best;}
  moveTo(p,target=null){
    if(this.state!=='playing'||!this.player.alive)return;
    this.cancelRecall();this.player.destination=walkable(p);this.selected=target?.alive&&target.team===1?target:null;
    this.effect('click',p.x,p.y,{life:.55,enemy:!!this.selected});
  }
  cancelRecall(){if(this.recall){this.recall=0;this.emit('toast','Recall interrupted');}}
  move(e,p,dt,stop=4){
    const d=dist(e,p);if(d<=stop){e.moving=false;return true;}
    const s=Math.min(d-stop,e.speed*(e.slow>0?.58:1)*dt);e.angle=Math.atan2(p.y-e.y,p.x-e.x);
    const pos=walkable({x:e.x+Math.cos(e.angle)*s,y:e.y+Math.sin(e.angle)*s});e.x=pos.x;e.y=pos.y;e.moving=s>0;return false;
  }
  damage(source,target,amount){
    if(this.state==='victory'||this.state==='defeat'||!target?.alive||this.protected(target))return;
    if(target===this.player){this.cancelRecall();if(source.kind==='hero')this.emit('hurt','');}
    let dmg=amount;if(target.shield>0){const absorbed=Math.min(dmg,target.shield);target.shield-=absorbed;dmg-=absorbed;}
    target.hp=Math.max(0,target.hp-dmg);target.hitFlash=.16;
    if(source===this.player||target===this.player||target.kind!=='minion')this.effect('number',target.x+(Math.random()-.5)*18,target.y-30,{text:String(Math.round(amount)),color:target.team===0?'#ff8b91':'#ffe6a1',life:.95});
    if(source===this.player&&target.kind==='hero')for(const t of this.towers)if(t.team===1&&t.alive&&dist(t,this.player)<t.range+this.player.radius)t.aggro=this.player;
    if(target.hp<=0)this.kill(source,target);
  }
  kill(source,target){
    target.alive=false;target.destination=null;target.shield=0;target.shieldTime=0;this.effect('death',target.x,target.y,{team:target.team,life:1.1,big:target.kind==='tower'||target.kind==='nexus'});
    if(target===this.selected)this.selected=null;
    if(target.kind==='minion'){
      if(target.team===1&&this.player.alive&&dist(this.player,target)<700){this.gold+=source===this.player?25:12;this.xp+=22;if(source===this.player){this.cs++;this.effect('number',target.x,target.y-55,{text:'+25',color:'#e9cb73',life:1});}}
    }else if(target.kind==='hero'){
      this.score[source.team]++;target.respawn=target.team?15:Math.min(10+this.deaths*2,20);
      if(target===this.player){this.deaths++;this.recall=0;this.emit('announce','You have been slain');}else{this.kills++;this.gold+=250;this.xp+=110;this.emit('announce',this.kills===1?'First blood':'Enemy slain');this.emit('sound','kill');}
    }else if(target.kind==='tower'){
      if(target.team===1){this.gold+=225;this.emit('announce','Enemy turret destroyed');}else this.emit('announce','Your turret has fallen');
    }else if(target.kind==='nexus'){
      this.state=target.team===1?'victory':'defeat';this.emit('finish',this.state);this.emit('sound',this.state==='victory'?'victory':'defeat');
    }
  }
  cast(key,aim=this.aim,caster=this.player){
    const s=SPELLS[key];if(!s||this.state!=='playing'||!caster.alive)return false;
    if(caster.cooldowns[key]>0){if(caster===this.player)this.emit('toast','Ability is not ready');return false;}
    if(caster.mana<s.cost){if(caster===this.player)this.emit('toast','Not enough mana');return false;}
    if(caster===this.player)this.cancelRecall();
    caster.cooldowns[key]=s.cd;caster.mana-=s.cost;
    const angle=Math.atan2(aim.y-caster.y,aim.x-caster.x);caster.angle=angle;
    const origin={x:caster.x,y:caster.y};
    if(key==='q'){
      caster.attackAnim=.3;this.effect('slash',caster.x,caster.y,{angle,team:caster.team,range:225,life:.38});
      for(const e of this.enemies(caster)){let delta=Math.atan2(e.y-caster.y,e.x-caster.x)-angle;delta=Math.atan2(Math.sin(delta),Math.cos(delta));if(dist(caster,e)<230+e.radius&&Math.abs(delta)<1.18)this.damage(caster,e,(e.kind==='tower'||e.kind==='nexus'?85:155)*caster.spellPower);}
    }else if(key==='w'){
      caster.shield=240*caster.spellPower;caster.shieldTime=4;this.effect('ring',caster.x,caster.y,{radius:75,team:caster.team,life:.6});
    }else if(key==='e'||key==='f'){
      const end=walkable({x:caster.x+Math.cos(angle)*(key==='e'?240:290),y:caster.y+Math.sin(angle)*(key==='e'?240:290)});
      this.effect('dash',origin.x,origin.y,{end,team:caster.team,life:.5,flash:key==='f'});caster.x=end.x;caster.y=end.y;caster.destination=null;
      if(key==='e')for(const e of this.enemies(caster))if(segmentDistance(e,origin,end)<65+e.radius)this.damage(caster,e,110*caster.spellPower);
    }else if(key==='r'){
      this.effect('storm',caster.x,caster.y,{radius:285,team:caster.team,life:1.3});
      for(const e of this.enemies(caster))if(dist(caster,e)<285+e.radius){this.damage(caster,e,(e.kind==='tower'||e.kind==='nexus'?220:410)*caster.spellPower);e.slow=2.5;}
      if(caster===this.player)this.emit('shake','',{strength:7});
    }else if(key==='d'){
      caster.hp=Math.min(caster.maxHp,caster.hp+350);this.effect('heal',caster.x,caster.y,{life:1,radius:70});this.effect('number',caster.x,caster.y-50,{text:'+350',color:'#a3f0ab',life:1.1});
    }
    if(caster===this.player)this.emit('sound',key);return true;
  }
  attack(e,t){
    if(e.attackTimer>0||!t.alive)return;e.attackTimer=e.period;e.attackAnim=.24;e.angle=Math.atan2(t.y-e.y,t.x-e.x);
    if(e.kind==='hero'){
      this.damage(e,t,e.attack);this.effect('slash',e.x,e.y,{angle:e.angle,range:Math.min(dist(e,t)+20,140),team:e.team,life:.2,small:true});
      if(e===this.player)this.emit('sound','attack');
    }else{
      this.projectiles.push({x:e.x,y:e.y-(e.kind==='tower'?72:14),source:e,target:t,speed:e.kind==='tower'?440:360,damage:e.attack,life:3,tower:e.kind==='tower'});
    }
  }
  recallHome(){if(!this.player.alive||this.state!=='playing')return;if(dist(this.player,BASES[0])<145){this.emit('toast','You are already at the fountain');return;}this.recall=5;this.player.destination=null;this.selected=null;this.emit('toast','Recalling… moving or taking damage will interrupt');}
  buy(id){
    const item=ITEMS[id];if(!item||this.items.has(id))return false;
    if(this.state!=='playing'||!this.player.alive||dist(this.player,BASES[0])>185){this.emit('toast','Return to your fountain to buy items');return false;}
    if(this.gold<item.cost){this.emit('toast','Not enough gold');return false;}
    this.gold-=item.cost;this.items.add(id);
    if(id==='blade')this.player.attack+=24;
    if(id==='heart'){this.player.maxHp+=260;this.player.hp+=260;}
    if(id==='lens')this.player.spellPower+=.35;
    this.emit('sound','buy');return true;
  }
  updateHeroAI(e,dt){
    const p=this.player;e.aiTimer-=dt;
    if(e.hp<e.maxHp*.26)e.retreating=true;
    if(e.retreating){this.move(e,BASES[1],dt);if(e.hp>e.maxHp*.88)e.retreating=false;return;}
    const allyMinions=this.entities.filter(t=>t.alive&&t.kind==='minion'&&t.team===1&&dist(t,e)<300);
    const t=this.nearest(e,340,x=>x.kind!=='nexus'||!this.towers[0].alive);
    if(t){
      const blueTower=this.towers[0];
      if(blueTower.alive&&dist(e,blueTower)<300&&allyMinions.length===0&&t!==blueTower){this.move(e,lanePoint(.57,-30),dt);return;}
      if(dist(e,t)>e.range+t.radius-4)this.move(e,t,dt,e.range+t.radius-8);else this.attack(e,t);
      if(e.aiTimer<=0&&t.kind==='hero'&&dist(e,t)<215){this.cast('q',t,e);e.aiTimer=5.5;}
      if(e.hp<e.maxHp*.55&&e.cooldowns.w===0&&dist(e,t)<240)this.cast('w',t,e);
      if(this.time>55&&t===p&&dist(e,p)<210&&e.cooldowns.r===0&&p.hp>300)this.cast('r',p,e);
    }else{
      const target=this.towers[0].alive?this.towers[0]:this.nexuses[0];
      const forward=allyMinions.filter(m=>dist(m,BASES[0])<dist(e,BASES[0])+100).sort((a,b)=>dist(a,BASES[0])-dist(b,BASES[0]))[0];
      if(forward){this.move(e,forward,dt,85);}else this.move(e,lanePoint(this.towers[0].alive?.61:.27,-22),dt);
      if(dist(e,target)<e.range+target.radius)this.attack(e,target);
    }
  }
  step(dt){
    if(this.state!=='playing')return;dt=Math.min(dt,.05);this.time+=dt;this.waveTimer-=dt;this.passiveGold+=dt*2.5;
    if(this.passiveGold>=1){this.gold+=Math.floor(this.passiveGold);this.passiveGold%=1;}
    if(this.waveTimer<=0){this.spawnWave();this.waveTimer=17;}
    for(const e of this.entities){
      e.attackTimer=Math.max(0,e.attackTimer-dt);e.attackAnim=Math.max(0,e.attackAnim-dt);e.slow=Math.max(0,e.slow-dt);e.hitFlash=Math.max(0,(e.hitFlash||0)-dt);e.moving=false;
      if(e.kind==='hero'){
        for(const k of Object.keys(e.cooldowns))e.cooldowns[k]=Math.max(0,e.cooldowns[k]-dt);
        if(!e.alive){e.respawn-=dt;if(e.respawn<=0){Object.assign(e,BASES[e.team]);e.hp=e.maxHp;e.mana=e.maxMana;e.alive=true;e.retreating=false;e.destination=null;if(e===this.player)this.emit('announce','Back into the fight');}continue;}
        if(dist(e,BASES[e.team])<155){e.hp=Math.min(e.maxHp,e.hp+e.maxHp*.2*dt);e.mana=Math.min(e.maxMana,e.mana+e.maxMana*.25*dt);}else{e.hp=Math.min(e.maxHp,e.hp+2*dt);e.mana=Math.min(e.maxMana,e.mana+7*dt);}
      }
      if(!e.alive)continue;
      if(e.shieldTime>0){e.shieldTime-=dt;if(e.shieldTime<=0)e.shield=0;}
      if(e.kind==='tower'){
        if(e.aggro&&(!e.aggro.alive||dist(e,e.aggro)>e.range+e.aggro.radius))e.aggro=null;
        if(!e.aggro)e.aggro=this.nearest(e,e.range,t=>t.kind==='minion')||this.nearest(e,e.range,t=>t.kind==='hero');
        if(e.aggro)this.attack(e,e.aggro);
      }else if(e.kind==='minion'){
        const t=this.nearest(e,225);
        if(t){if(dist(e,t)>e.range+t.radius)this.move(e,t,dt,e.range+t.radius-3);else this.attack(e,t);}else{
          const t=this.towers[1-e.team].alive?this.towers[1-e.team]:this.nexuses[1-e.team];this.move(e,{x:t.x-laneDY/laneL*e.offset,y:t.y+laneDX/laneL*e.offset},dt,e.range+t.radius-8);
        }
      }else if(e===this.player){
        const input=this.moveInput;
        if(input.x||input.y){this.cancelRecall();this.selected=null;e.destination=null;this.move(e,{x:e.x+input.x*300,y:e.y+input.y*300},dt);}
        else if(this.recall>0){this.recall-=dt;if(this.recall<=0){Object.assign(e,BASES[0]);this.effect('ring',e.x,e.y,{radius:100,team:0,life:1});this.emit('toast','Fountain reached');}}
        else if(this.selected?.alive){const t=this.selected;if(this.protected(t)){this.emit('toast','Destroy the enemy turret first');this.selected=null;}else if(dist(e,t)>e.range+t.radius)this.move(e,t,dt,e.range+t.radius-3);else this.attack(e,t);}
        else if(e.destination){if(this.move(e,e.destination,dt))e.destination=null;}
        else {const t=this.nearest(e,e.range);if(t)this.attack(e,t);}
      }else if(e.kind==='hero')this.updateHeroAI(e,dt);
      if(this.state!=='playing')break;
    }
    for(const p of this.projectiles){
      p.life-=dt;if(!p.target.alive){p.life=0;continue;}
      const tx=p.target.x,ty=p.target.y-20,dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy);
      if(d<p.speed*dt+6){this.damage(p.source,p.target,p.damage);this.effect('hit',tx,ty,{team:p.source.team,life:.3});p.life=0;}
      else{p.x+=dx/d*p.speed*dt;p.y+=dy/d*p.speed*dt;}
    }
    this.projectiles=this.projectiles.filter(p=>p.life>0);
    for(const f of this.effects)f.age+=dt;this.effects=this.effects.filter(f=>f.age<f.life);
    this.entities=this.entities.filter(e=>e.alive||e.kind!=='minion');
    const nextLevel=6+Math.floor(this.xp/150);
    if(nextLevel>this.player.level&&nextLevel<=18){this.player.level=nextLevel;this.player.maxHp+=90;this.player.hp=Math.min(this.player.hp+190,this.player.maxHp);this.player.attack+=7;this.emit('announce','Level up');this.effect('heal',this.player.x,this.player.y,{life:1.5,radius:100});}
  }
}



const $=id=>document.getElementById(id);
const game=new Game();
const canvas=$('battle-canvas'),ctx=canvas.getContext('2d');
const mini=$('minimap'),mc=mini.getContext('2d');
const map=new Image(),sprites=new Image();
map.src='assets/battlefield.png';sprites.src='assets/sprites.png';
const blue='#6de8f1',red='#f07a8c';
const camera={x:768,y:512,scale:1};
let width=1,height=1,dpr=1,last=0,realTime=0,uiTime=0,loaded=false;
let pointer={x:800,y:450},pointerScreen=null,hasAim=false,isTouch=false,hovered=null,shake=0,toastUntil=0,announceUntil=0,pausedBy=null;
let muted=true,audioContext=null,lastSound=0;
const keys=new Set();
const abilityButtons=[...document.querySelectorAll('[data-spell]')];
const dialogs=[...document.querySelectorAll('dialog')];

function resize(){
  const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  camera.scale=Math.max(width/WORLD.w,height/WORLD.h)*(width<760?1.75:1.07);
}
new ResizeObserver(resize).observe(canvas);
function screenToWorld(x,y){return{x:(x-width/2)/camera.scale+camera.x,y:(y-height/2)/camera.scale+camera.y};}
function eventPoint(e){const r=canvas.getBoundingClientRect();pointerScreen={x:e.clientX-r.left,y:e.clientY-r.top};return screenToWorld(pointerScreen.x,pointerScreen.y);}
function pick(p){return game.entities.filter(e=>e.alive&&e.team===1&&Math.hypot(p.x-e.x,p.y-(e.y-(e.kind==='tower'?38:18)))<(e.kind==='nexus'?72:e.kind==='tower'?67:e.kind==='hero'?45:31)).sort((a,b)=>dist(a,p)-dist(b,p))[0]||null;}
function updateAim(){
  if(isTouch||!hasAim){const t=game.selected?.alive?game.selected:game.nearest(game.player,400);if(t)game.aim={x:t.x,y:t.y};else game.aim={x:game.player.x+Math.cos(game.player.angle)*300,y:game.player.y+Math.sin(game.player.angle)*300};}
  else {if(pointerScreen)pointer=screenToWorld(pointerScreen.x,pointerScreen.y);game.aim=pointer;}
}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointermove',e=>{pointer=eventPoint(e);hasAim=true;hovered=pick(pointer);updateAim();});
canvas.addEventListener('pointerdown',e=>{
  e.preventDefault();if(game.state!=='playing')return;canvas.focus({preventScroll:true});isTouch=e.pointerType==='touch';pointer=eventPoint(e);hasAim=true;updateAim();game.moveTo(pointer,pick(pointer));
});
canvas.addEventListener('pointerleave',()=>{hovered=null;});
mini.addEventListener('pointerdown',e=>{e.preventDefault();if(game.state!=='playing')return;const r=mini.getBoundingClientRect();const p={x:(e.clientX-r.left)/r.width*WORLD.w,y:(e.clientY-r.top)/r.height*WORLD.h};game.moveTo(p,pick(p));});

function showDialog(id,pause=false){
  const el=$(id);if(el.open)return;if(pause&&game.state==='playing'){game.state='paused';pausedBy=el;}keys.clear();game.moveInput={x:0,y:0};el.showModal();
}
function closeDialog(id){$(id).close();}
for(const el of dialogs){el.addEventListener('close',()=>{if(pausedBy===el){if(game.state==='paused')game.state='playing';pausedBy=null;}if(game.state==='playing')canvas.focus({preventScroll:true});});}
for(const id of ['start-dialog','end-dialog'])$(id).addEventListener('cancel',e=>e.preventDefault());
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog(b.dataset.close)));
function play(){closeDialog('start-dialog');game.start();canvas.focus({preventScroll:true});updateHUD();}
$('play-button').disabled=true;
$('play-button').addEventListener('click',play);
$('help-button').addEventListener('click',()=>showDialog('help-dialog',true));
function pause(){if(game.state==='playing')showDialog('pause-dialog',true);else if($('pause-dialog').open)closeDialog('pause-dialog');}
$('pause-button').addEventListener('click',pause);
$('resume-button').addEventListener('click',()=>closeDialog('pause-dialog'));
function restart(){pausedBy=null;for(const d of dialogs)if(d.open)d.close();keys.clear();game.reset();camera.x=game.player.x;camera.y=game.player.y;game.start();updateHUD();canvas.focus({preventScroll:true});}
$('restart-button').addEventListener('click',restart);$('again-button').addEventListener('click',restart);
$('recall-button').addEventListener('click',()=>game.recallHome());
function openShop(){if(game.state!=='playing')return;showDialog('shop-dialog');updateShop();}
$('shop-button').addEventListener('click',openShop);
document.querySelectorAll('[data-item]').forEach(b=>b.addEventListener('click',()=>{if(game.buy(b.dataset.item)){toast('Item equipped');updateShop();updateHUD();}}));
for(const b of abilityButtons)b.addEventListener('click',e=>{e.preventDefault();updateAim();game.cast(b.dataset.spell);canvas.focus({preventScroll:true});});
window.addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  if(dialogs.some(d=>d.open))return;
  const key=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','q','w','e','r','d','f','p','b','escape'].includes(key))e.preventDefault();
  if(e.repeat&&SPELLS[key])return;
  keys.add(key);
  if(SPELLS[key]){updateAim();game.cast(key);}
  if(key==='b')game.recallHome();if(key==='p')openShop();if(key==='escape')pause();
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();game.moveInput={x:0,y:0};if(game.state==='playing'&&!dialogs.some(d=>d.open))pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.state==='playing'&&!dialogs.some(d=>d.open))pause();});

function sound(type){
  if(muted)return;
  try{
    if(!audioContext)audioContext=new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume();
    const now=audioContext.currentTime;if(type==='attack'&&now-lastSound<.12)return;lastSound=now;
    const notes={q:[420,190,.16,'triangle'],w:[370,720,.27,'sine'],e:[740,190,.2,'triangle'],r:[95,40,.8,'sawtooth'],d:[520,1000,.35,'sine'],f:[900,1800,.13,'sine'],attack:[170,80,.07,'triangle'],kill:[620,1100,.45,'sine'],buy:[740,1100,.18,'sine'],victory:[520,1040,1,'triangle'],defeat:[150,65,.8,'sine']};
    const [from,to,duration,wave]=notes[type]||notes.q;
    const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type=wave;osc.frequency.setValueAtTime(from,now);osc.frequency.exponentialRampToValueAtTime(to,now+duration);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(type==='r'?.045:.065,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain).connect(audioContext.destination);osc.start(now);osc.stop(now+duration+.03);
  }catch{muted=true;}
}
$('sound-button').addEventListener('click',()=>{muted=!muted;$('sound-button').querySelector('.mute-mark').style.display=muted?'':'none';$('sound-button').setAttribute('aria-label',muted?'Turn sound on':'Turn sound off');if(!muted)sound('buy');});
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');toastUntil=realTime+2.6;}
function announce(text){$('announcement').textContent=text;$('announcement').classList.add('visible');announceUntil=realTime+3.5;}
function timeText(t){return`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;}
function updateShop(){
  $('shop-gold').textContent=Math.floor(game.gold);const home=game.player.alive&&dist(game.player,BASES[0])<185;
  for(const b of document.querySelectorAll('[data-item]')){const id=b.dataset.item,owned=game.items.has(id);b.disabled=owned||game.gold<ITEMS[id].cost||!home;b.querySelector('strong').textContent=owned?'Equipped':`${ITEMS[id].cost} ◆`;}
  $('shop-note').textContent=home?'Items are equipped immediately and stay with you for this match.':'Return to your fountain to buy items. Press B to recall.';
}
function updateHUD(){
  const p=game.player;$('hp-fill').style.width=`${p.hp/p.maxHp*100}%`;$('hp-text').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}${p.shield>0?' + '+Math.ceil(p.shield):''}`;
  $('mana-fill').style.width=`${p.mana/p.maxMana*100}%`;$('mana-text').textContent=`${Math.floor(p.mana)} / ${p.maxMana}`;
  $('level').textContent=p.level;$('gold').textContent=Math.floor(game.gold).toLocaleString();$('attack-stat').textContent=p.attack;$('kda').textContent=`${game.kills} / ${game.deaths}`;$('cs').textContent=game.cs;
  $('timer').textContent=timeText(game.time);$('blue-score').textContent=game.score[0];$('red-score').textContent=game.score[1];
  $('objective-text').textContent=game.towers[1].alive?'Destroy the enemy turret':'Destroy the enemy Nexus';
  for(const b of abilityButtons){const key=b.dataset.spell,cd=p.cooldowns[key];b.classList.toggle('on-cooldown',cd>0);b.classList.toggle('no-mana',p.mana<SPELLS[key].cost);b.querySelector('.cooldown').textContent=cd>0?(cd<1?cd.toFixed(1):Math.ceil(cd)):'';}
  $('respawn').classList.toggle('hidden',p.alive);$('respawn-count').textContent=Math.max(1,Math.ceil(p.respawn));
  $('recall-progress').classList.toggle('hidden',game.recall<=0);$('recall-progress').querySelector('i').style.width=`${(1-game.recall/5)*100}%`;
  $('game-status').textContent=game.state==='playing'?'MATCH IN PROGRESS':game.state==='paused'?'PAUSED':game.state==='ready'?'READY TO PLAY':game.state.toUpperCase();
  $('controls-hint').style.opacity=game.time>45?'0':'1';if($('shop-dialog').open)updateShop();
}
function finish(){
  const win=game.state==='victory';$('end-eyebrow').textContent=win?'ENEMY NEXUS DESTROYED':'YOUR NEXUS HAS FALLEN';$('end-title').textContent=win?'Victory':'Defeat';$('end-title').style.color=win?'var(--gold-bright)':'#eeb2ad';$('end-description').textContent=win?'The Rift is yours.':'Regroup. There’s always another fight.';$('end-kills').textContent=game.kills;$('end-cs').textContent=game.cs;$('end-time').textContent=timeText(game.time);
  for(const d of dialogs)if(d.open)d.close();showDialog('end-dialog');
}

function circle(x,y,r,color,fill=false,line=1){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=color;ctx.fill();}else{ctx.strokeStyle=color;ctx.lineWidth=line;ctx.stroke();}}
function ellipse(x,y,rx,ry,color,fill=true,line=1){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.lineWidth=line;if(fill){ctx.fillStyle=color;ctx.fill();}else{ctx.strokeStyle=color;ctx.stroke();}}
function glow(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
function path(points,fill,stroke,width=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function healthBar(e,y,w){
  const h=e.kind==='hero'?7:5;
  ctx.fillStyle='#020b12e8';ctx.fillRect(e.x-w/2-2,y-2,w+4,h+4);
  ctx.fillStyle=e===game.player?'#8fdd9f':e.team===0?'#56bed9':'#d76572';ctx.fillRect(e.x-w/2,y,w*e.hp/e.maxHp,h);
  ctx.fillStyle='#ffffff17';ctx.fillRect(e.x-w/2,y,w*e.hp/e.maxHp,2);
  if(e.shield>0){ctx.fillStyle='#b1f1fc';ctx.fillRect(e.x-w/2,y-3,w*clamp(e.shield/e.maxHp,0,1),2);}
  if(e.kind==='hero'){ctx.fillStyle='#163653';ctx.fillRect(e.x-w/2,y+h+3,w,3);ctx.fillStyle='#5bacda';ctx.fillRect(e.x-w/2,y+h+3,w*e.mana/e.maxMana,3);}
}
function drawNexus(e){
  const color=e.team===0?blue:red,pulse=Math.sin(realTime*2.2)*.06+1;
  if(!e.alive){ellipse(e.x,e.y,63,28,'#151e24aa');return;}
  glow(e.x,e.y-25,100,e.team===0?'#2cc5e43b':'#e8476b3b');
  ellipse(e.x,e.y+4,58,27,'#071e2799');ellipse(e.x,e.y,54,24,color,false,2);
  ctx.save();ctx.translate(e.x,e.y-36);ctx.scale(pulse,pulse);
  const gradient=ctx.createLinearGradient(-25,-75,30,50);gradient.addColorStop(0,'#e3fbff');gradient.addColorStop(.42,color);gradient.addColorStop(1,e.team===0?'#07537a':'#8e194d');
  path([[0,-77],[31,-21],[25,15],[0,43],[-26,15],[-31,-21]],gradient,color,2);
  path([[0,-77],[3,-7],[31,-21]],e.team===0?'#b6f7ffd0':'#ffd6e3b0');path([[3,-7],[0,43],[-26,15]],e.team===0?'#13668590':'#760a4990');
  ctx.restore();
  if(game.protected(e)){ellipse(e.x,e.y-29,70,85,e.team===0?'#77d9ec22':'#e47a9922',false,1);}
  healthBar(e,e.y-135,98);
  ctx.textAlign='center';ctx.font='600 11px Inter,Arial';ctx.fillStyle=e.team===0?'#adf3f0':'#ffc4cf';ctx.shadowColor='#000';ctx.shadowBlur=5;ctx.fillText(e.team===0?'ALLIED NEXUS':'ENEMY NEXUS',e.x,e.y-149);ctx.shadowBlur=0;
}
function drawEntity(e){
  if(e.kind==='nexus'){drawNexus(e);return;}
  if(!e.alive){if(e.kind==='tower')ellipse(e.x,e.y,42,19,'#10202aaa');return;}
  const tower=e.kind==='tower',hero=e.kind==='hero';
  const size=tower?164:hero?116:65,index=tower?(e.team===0?4:5):hero?e.team:(e.team===0?2:3);
  const bob=e.moving?Math.sin(realTime*(hero?14:11)+e.id)*2:Math.sin(realTime*2+e.id)*.5;
  ellipse(e.x,e.y+2,tower?40:hero?24:13,tower?16:hero?10:6,'#020c12a0');
  if(e===game.player){ellipse(e.x,e.y+2,29,13,'#a7f3d173',false,2);ellipse(e.x,e.y+2,33,16,'#062e24a0',false,1);}
  if(e===game.selected||e===hovered)ellipse(e.x,e.y+2,e.radius+8,(e.radius+8)*.48,e.team===0?blue:red,false,2);
  if(e.shield>0)ellipse(e.x,e.y-34,40,56,'#7cdff450',false,2);
  if(sprites.complete&&sprites.naturalWidth){
    ctx.save();ctx.translate(e.x,e.y+bob);if(!tower&&Math.cos(e.angle)<0)ctx.scale(-1,1);
    if(e.hitFlash>0)ctx.filter='brightness(1.7)';
    ctx.drawImage(sprites,index%3*512,Math.floor(index/3)*512,512,512,-size*.5,-size*.86,size,size);ctx.restore();
  }
  if(tower){healthBar(e,e.y-158,87);if(e===hovered){ctx.font='11px Inter,Arial';ctx.textAlign='center';ctx.fillStyle=e.team===0?'#b0f2ef':'#f7b6c2';ctx.fillText(`${Math.ceil(e.hp)} / ${e.maxHp}`,e.x,e.y-166);}}
  else if(hero){
    healthBar(e,e.y-108,67);ctx.textAlign='center';ctx.font='600 10px Inter,Arial';ctx.fillStyle=e.team===0?'#ecf9dd':'#ffbbc7';ctx.shadowBlur=5;ctx.shadowColor='#000';ctx.fillText(e===game.player?'AETHER':'DREADKNIGHT',e.x,e.y-117);ctx.shadowBlur=0;
    if(e===game.player){const y=e.y-136+Math.sin(realTime*3)*3;path([[e.x-5,y-7],[e.x+5,y-7],[e.x,y]],'#e2f4cf');}
  }else healthBar(e,e.y-58,32);
}
function drawEffect(f){
  const t=f.age/f.life,alpha=1-t,color=f.team===1?red:blue;ctx.save();ctx.globalAlpha=alpha;
  if(f.type==='number'){ctx.font=`600 ${f.text.startsWith('+')?15:18}px Inter,Arial`;ctx.textAlign='center';ctx.fillStyle=f.color;ctx.shadowColor='#000';ctx.shadowBlur=4;ctx.fillText(f.text,f.x,f.y-t*58);}
  else if(f.type==='click'){
    const r=12+t*17;ellipse(f.x,f.y,r,r*.5,f.enemy?red:'#a5efba',false,2);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.beginPath();ctx.moveTo(f.x+Math.cos(a)*(r+4),f.y+Math.sin(a)*(r+4)*.5);ctx.lineTo(f.x+Math.cos(a)*(r+9),f.y+Math.sin(a)*(r+9)*.5);ctx.strokeStyle=f.enemy?red:'#a5efba';ctx.stroke();}
  }else if(f.type==='slash'){
    ctx.translate(f.x,f.y-18);ctx.rotate(f.angle);const r=f.range*(.4+t*.6);
    ctx.beginPath();ctx.arc(0,0,r,-1.05+t*.35,.8+t*.35);ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=15;ctx.lineWidth=(f.small?10:24)*(1-t);ctx.stroke();ctx.beginPath();ctx.arc(0,0,r-4,-.9,.7);ctx.lineWidth=2;ctx.strokeStyle='#e5ffff';ctx.stroke();
  }else if(f.type==='ring'){ellipse(f.x,f.y,20+f.radius*t,(20+f.radius*t)*.7,color,false,3);}
  else if(f.type==='storm'){
    const r=f.radius*Math.min(t*3,1);glow(f.x,f.y,r,f.team===1?'#f8559940':'#38dcf030');ellipse(f.x,f.y,r,r*.82,color,false,3);
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2+t*2;const x=f.x+Math.cos(a)*r*.78,y=f.y+Math.sin(a)*r*.65;ctx.beginPath();ctx.moveTo(x,y-130*(1-t));ctx.lineTo(x-10,y-70*(1-t));ctx.lineTo(x+9,y-55*(1-t));ctx.lineTo(x,y);ctx.strokeStyle=i%2?'#effff8':color;ctx.lineWidth=2.5;ctx.shadowBlur=12;ctx.shadowColor=color;ctx.stroke();}
  }else if(f.type==='dash'){
    ctx.beginPath();ctx.moveTo(f.x,f.y-25);ctx.lineTo(f.end.x,f.end.y-25);ctx.strokeStyle=f.flash?'#fff0ad':color;ctx.lineWidth=(f.flash?9:19)*(1-t);ctx.shadowColor=color;ctx.shadowBlur=20;ctx.stroke();ellipse(f.end.x,f.end.y,20+25*t,10+12*t,color,false,2);
  }else if(f.type==='heal'){
    glow(f.x,f.y-35,f.radius||70,'#75e8a844');ellipse(f.x,f.y,20+30*t,10+15*t,'#9ef2b4',false,2);
    for(let i=0;i<8;i++){const x=f.x+Math.sin(i*2.3)*35,y=f.y-i*8-t*55;ctx.fillStyle='#b6ffd0';ctx.fillRect(x-3,y,6,2);ctx.fillRect(x-1,y-2,2,6);}
  }else if(f.type==='death'||f.type==='hit'){
    const n=f.big?35:f.type==='hit'?7:16,r=(f.big?120:45)*t;
    for(let i=0;i<n;i++){const a=i*2.399;circle(f.x+Math.cos(a)*r,f.y-15+Math.sin(a)*r*.7,Math.max(.2,(f.big?5:3)*(1-t)),i%3?color:'#fff2c3',true);}
  }
  ctx.restore();
}
function drawGround(){
  if(map.complete&&map.naturalWidth)ctx.drawImage(map,0,0,WORLD.w,WORLD.h);
  else{ctx.fillStyle='#173d36';ctx.fillRect(0,0,WORLD.w,WORLD.h);}
  ctx.fillStyle='#001f3020';ctx.fillRect(0,0,WORLD.w,WORLD.h);
  for(const t of game.towers){
    if(!t.alive)continue;
    const danger=t.team===1&&game.player.alive&&dist(game.player,t)<t.range+100;
    if(t===hovered||danger){circle(t.x,t.y,t.range,t.team===0?'#6dddec30':danger?'#f5747730':'#ec829d24',true);circle(t.x,t.y,t.range,t.team===0?'#9df1ec88':'#ef909074',false,1.4);}
  }
  if(game.recall>0){const p=game.player;ellipse(p.x,p.y,43,21,blue,false,2);ellipse(p.x,p.y,50+Math.sin(realTime*6)*5,27,blue,false,1);glow(p.x,p.y-30,70,'#53d2e447');}
  for(let i=0;i<23;i++){const x=(i*163.7+Math.sin(realTime*.3+i)*12)%WORLD.w,y=(i*213.7+realTime*(i%2?2:-2)+2000)%WORLD.h;const a=.13+Math.sin(realTime*1.4+i)*.1;circle(x,y,1.4,`rgba(157,239,200,${a})`,true);}
}
function render(dt){
  const p=game.player;let tx=game.state==='ready'?768:p.x,ty=game.state==='ready'?512:p.y;
  const halfW=width/camera.scale/2,halfH=height/camera.scale/2;
  tx=halfW*2>WORLD.w?WORLD.w/2:clamp(tx,halfW,WORLD.w-halfW);
  ty=halfH*2>WORLD.h?WORLD.h/2:clamp(ty,halfH,WORLD.h-halfH);
  const smooth=1-Math.exp(-dt*5);camera.x+=(tx-camera.x)*smooth;camera.y+=(ty-camera.y)*smooth;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle='#0a2022';ctx.fillRect(0,0,width,height);
  ctx.save();ctx.translate(width/2+(Math.random()-.5)*shake,height/2+(Math.random()-.5)*shake);ctx.scale(camera.scale,camera.scale);ctx.translate(-camera.x,-camera.y);
  drawGround();
  for(const e of [...game.entities].sort((a,b)=>a.y-b.y))drawEntity(e);
  for(const p of game.projectiles){const color=p.source.team===0?blue:red;glow(p.x,p.y,p.tower?16:8,p.source.team===0?'#79eaff90':'#ff719790');circle(p.x,p.y,p.tower?4.5:2.5,'#fff7dd',true);}
  for(const f of game.effects)drawEffect(f);
  ctx.restore();
  const g=ctx.createRadialGradient(width*.5,height*.47,height*.3,width*.5,height*.5,Math.max(width,height)*.66);g.addColorStop(0,'transparent');g.addColorStop(1,'#011013b0');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
  if(!p.alive){ctx.fillStyle='#18233280';ctx.fillRect(0,0,width,height);}
  if(p.alive&&p.hp<p.maxHp*.3){ctx.strokeStyle=`rgba(227,65,73,${.1+Math.sin(realTime*4)*.05})`;ctx.lineWidth=18;ctx.strokeRect(0,0,width,height);}
  shake=Math.max(0,shake-dt*25);
}
function drawMinimap(){
  mc.clearRect(0,0,240,150);if(map.complete&&map.naturalWidth)mc.drawImage(map,0,0,240,150);mc.fillStyle='#041b2180';mc.fillRect(0,0,240,150);
  for(const e of game.entities){if(!e.alive)continue;const x=e.x/WORLD.w*240,y=e.y/WORLD.h*150;mc.fillStyle=e===game.player?'#f5efc2':e.team===0?'#66e5ef':'#ff788e';mc.beginPath();mc.arc(x,y,e.kind==='hero'?4:e.kind==='minion'?1.3:e.kind==='tower'?3:5,0,Math.PI*2);mc.fill();if(e===game.player){mc.strokeStyle='#fcffe1';mc.lineWidth=1;mc.beginPath();mc.arc(x,y,6,0,Math.PI*2);mc.stroke();}}
  mc.strokeStyle='#d9eae57c';mc.lineWidth=1;mc.strokeRect((camera.x-width/camera.scale/2)/WORLD.w*240,(camera.y-height/camera.scale/2)/WORLD.h*150,width/camera.scale/WORLD.w*240,height/camera.scale/WORLD.h*150);
}
function frame(timestamp){
  const dt=Math.min((timestamp-last)/1000||.016,.05);last=timestamp;realTime+=dt;
  game.moveInput={x:(keys.has('arrowright')?1:0)-(keys.has('arrowleft')?1:0),y:(keys.has('arrowdown')?1:0)-(keys.has('arrowup')?1:0)};
  updateAim();game.step(dt);
  for(const ev of game.events){if(ev.type==='announce')announce(ev.text);else if(ev.type==='toast')toast(ev.text);else if(ev.type==='sound')sound(ev.text);else if(ev.type==='shake')shake=ev.strength;else if(ev.type==='finish')finish();}game.events=[];
  if(realTime>toastUntil)$('toast').classList.remove('visible');if(realTime>announceUntil)$('announcement').classList.remove('visible');
  render(dt);uiTime+=dt;if(uiTime>.1){updateHUD();drawMinimap();uiTime=0;}
  requestAnimationFrame(frame);
}
showDialog('start-dialog');
Promise.all([map.decode(),sprites.decode()]).then(()=>{loaded=true;$('play-button').disabled=false;$('asset-status').textContent='Solo vs. AI · No download needed';}).catch(()=>{$('asset-status').textContent='Artwork could not load. Please refresh to try again.';});
resize();updateHUD();requestAnimationFrame(frame);

})();
