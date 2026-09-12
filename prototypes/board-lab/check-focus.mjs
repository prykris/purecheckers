import assert from 'node:assert/strict';
const targets = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const socket = new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let id=0; const pending=new Map();
socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
try {
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await send('Page.navigate',{url:'http://127.0.0.1:5182/'});
 for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector(".enter-focus")'))break;await pause(50);}
 await evaluate('[...document.querySelectorAll("button")].find(b=>b.getAttribute("aria-label")==="Board settings").click()');await pause(50);
 await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Try a double jump").click()');await pause(80);
 const rect=()=>evaluate('document.querySelector("canvas").getBoundingClientRect().toJSON()');
 const point=(b,row,col,id)=>({x:b.x+(col+.5)*b.width/8,y:b.y+(row+.5)*b.height/8,id,radiusX:3,radiusY:3});
 const touch=(type,points)=>send('Input.dispatchTouchEvent',{type,touchPoints:points});
 async function pair(moving=false,cancel=false){const b=await rect(),a=point(b,5,0,1),c=point(b,6,6,2);await touch('touchStart',[a]);await touch('touchStart',[a,c]);if(moving){a.x+=25;await touch('touchMove',[a,c]);}await touch(cancel?'touchCancel':'touchEnd',[]);await pause(100);}
 const state=()=>evaluate('({focus:document.querySelector("main").classList.contains("immersive"),moves:document.querySelectorAll(".history .move-strip>button").length,selected:document.querySelectorAll(".keyboard-square[aria-pressed=true]").length})');
 await pair();assert.deepEqual(await state(),{focus:true,moves:0,selected:0});
 await pair(true);assert.deepEqual(await state(),{focus:true,moves:0,selected:0});
 await pair(false,true);assert.deepEqual(await state(),{focus:true,moves:0,selected:0});
 await pair();assert.deepEqual(await state(),{focus:false,moves:0,selected:0});
 // A normal drag still submits exactly one capture after the cancelled gestures.
 let b=await rect(),a=point(b,5,0,1),destination=point(b,3,2,1);
 await touch('touchStart',[a]);await touch('touchMove',[destination]);await touch('touchEnd',[]);await pause(700);
 assert.equal((await state()).moves,1);
 // Button/Escape round trip preserves the position.
 const before=await evaluate('[...document.querySelectorAll(".keyboard-square")].map(e=>e.getAttribute("aria-label"))');
 await evaluate('document.querySelector(".enter-focus").click()');await pause(100);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await pause(100);
 assert.equal((await state()).focus,false);
 assert.deepEqual(await evaluate('[...document.querySelectorAll(".keyboard-square")].map(e=>e.getAttribute("aria-label"))'),before);
 console.log('Real touch checks passed: two-finger entry/exit, moved/cancelled gesture suppression, no unintended moves, normal one-finger drag, button/Escape and board preservation.');
} finally { await send('Browser.close').catch(()=>{});socket.close(); }
