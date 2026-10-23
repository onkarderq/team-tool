(function(){
 let cleanup=()=>{};
 const land=[[[ -168,70],[-130,72],[-105,55],[-62,52],[-82,25],[-100,15],[-126,32],[-168,60]], [[-82,13],[-50,6],[-35,-8],[-50,-32],[-68,-55],[-80,-22]], [[-18,36],[8,38],[38,27],[50,10],[35,-32],[18,-35],[0,-5],[-17,14]], [[-11,37],[-6,58],[27,72],[59,60],[98,75],[175,62],[151,45],[125,20],[105,-7],[76,8],[44,30],[26,38]], [[111,-12],[138,-10],[154,-27],[141,-40],[116,-32]], [[-55,60],[-20,65],[-39,84],[-61,81]], [[46,-13],[51,-15],[48,-27],[43,-25]]];
 function inside(x,y,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [a,b]=poly[i],[c,d]=poly[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;}return hit;}
 const sphere=[];for(let lat=-75;lat<=78;lat+=5)for(let lon=-180;lon<180;lon+=5){const a=lat*Math.PI/180,b=lon*Math.PI/180;sphere.push({x:Math.cos(a)*Math.sin(b),y:-Math.sin(a),z:Math.cos(a)*Math.cos(b),land:land.some(poly=>inside(lon,lat,poly))});}
 function mount(){
  cleanup();const stage=document.querySelector('#globe-stage');if(!stage)return;
  const canvas=stage.querySelector('canvas'),ctx=canvas.getContext('2d');if(!ctx)return;
  const nodes=[...stage.querySelectorAll('[data-history-person]')],counter=document.querySelector('#globe-page-label');let width=0,height=0,yaw=-.4,pitch=.1,zoom=1,frame=0,dragging=false,lastX=0,lastY=0,animating=false,viewPage=0,disposed=false;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function transform(p){const x=p.x*Math.cos(yaw)+p.z*Math.sin(yaw),z=-p.x*Math.sin(yaw)+p.z*Math.cos(yaw);return {x,y:p.y*Math.cos(pitch)-z*Math.sin(pitch),z:p.y*Math.sin(pitch)+z*Math.cos(pitch)};}
  function project(p,r){const scale=7/(7-p.z);return {x:width/2+p.x*r*scale,y:height/2+p.y*r*scale,scale,z:p.z};}
  function line(points,color,lineWidth=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke();}
  function draw(){
   if(disposed)return;const ratio=Math.min(2,devicePixelRatio||1);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
   const radius=Math.min(width*.145,height*.22)*zoom;
   const space=ctx.createRadialGradient(width/2,height/2,0,width/2,height/2,Math.max(width,height)*.65);space.addColorStop(0,'#102e53');space.addColorStop(.5,'#08172d');space.addColorStop(1,'#020a18');ctx.fillStyle=space;ctx.fillRect(0,0,width,height);
   for(let i=0;i<150;i++){const x=((i*173+17)%997)/997*width,y=((i*257+31)%991)/991*height,size=i%11===0?4:2;ctx.fillStyle=i%5===0?'#3a759044':'#477b9a22';ctx.fillRect(Math.round(x/4)*4,Math.round(y/4)*4,size,size);}
   ctx.strokeStyle='#62baff0d';for(let x=0;x<width;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}for(let y=0;y<height;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
   const halo=ctx.createRadialGradient(width/2,height/2,radius*.7,width/2,height/2,radius*1.8);halo.addColorStop(0,'#1788cb45');halo.addColorStop(1,'#159ed500');ctx.fillStyle=halo;ctx.fillRect(width/2-radius*2,height/2-radius*2,radius*4,radius*4);
   const pageSize=width<600?6:10,pages=Math.max(1,Math.ceil(nodes.length/pageSize));viewPage=Math.min(viewPage,pages-1);const visible=nodes.slice(viewPage*pageSize,(viewPage+1)*pageSize);counter.textContent=nodes.length?`${viewPage+1} / ${pages}`:'0 / 0';
   nodes.forEach(node=>{node.hidden=!visible.includes(node);});
   const positions=visible.map((node,i)=>{const angle=(i/visible.length)*Math.PI*2-Math.PI/2;const p=transform({x:Math.cos(angle)*2.25,y:Math.sin(angle)*1.65,z:Math.sin(angle*2)*.5});return {node,...project(p,radius),tone:node.dataset.tone};});
   for(const point of positions){const origin={x:width/2+(point.x-width/2)*.35,y:height/2+(point.y-height/2)*.35};line([origin,{x:point.x,y:point.y}],point.tone==='high'?'#30d9a67a':point.tone==='low'?'#ffae5670':'#5ab8fa70',1.5);ctx.fillStyle='#8adeff';ctx.fillRect(origin.x-2,origin.y-2,4,4);}
   const earth=ctx.createRadialGradient(width/2-radius*.4,height/2-radius*.45,radius*.1,width/2+radius*.3,height/2+radius*.2,radius*1.4);earth.addColorStop(0,'#12517b');earth.addColorStop(.6,'#0a304e');earth.addColorStop(1,'#030b1c');ctx.fillStyle=earth;ctx.beginPath();ctx.arc(width/2,height/2,radius,0,Math.PI*2);ctx.fill();
   for(let lat=-60;lat<=60;lat+=30){let group=[];for(let lon=-180;lon<=180;lon+=3){const a=lat*Math.PI/180,b=lon*Math.PI/180,p=transform({x:Math.cos(a)*Math.sin(b),y:-Math.sin(a),z:Math.cos(a)*Math.cos(b)});if(p.z>=0)group.push(project(p,radius));else if(group.length){line(group,'#57bcfa20');group=[];}}if(group.length)line(group,'#57bcfa20');}
   for(let lon=0;lon<180;lon+=30){let group=[];for(let lat=-90;lat<=270;lat+=3){const a=lat*Math.PI/180,b=lon*Math.PI/180,p=transform({x:Math.cos(a)*Math.sin(b),y:-Math.sin(a),z:Math.cos(a)*Math.cos(b)});if(p.z>=0)group.push(project(p,radius));else if(group.length){line(group,'#57bcfa20');group=[];}}if(group.length)line(group,'#57bcfa20');}
   sphere.map(p=>({...transform(p),land:p.land})).filter(p=>p.z>0).sort((a,b)=>a.z-b.z).forEach(p=>{const point=project(p,radius),size=Math.max(1.2,radius*.025)*point.scale;ctx.fillStyle=p.land?`rgba(81,207,232,${.2+p.z*.7})`:`rgba(42,112,166,${.08+p.z*.18})`;ctx.fillRect(point.x-size/2,point.y-size/2,size,size);});
   ctx.beginPath();ctx.arc(width/2,height/2,radius,0,Math.PI*2);ctx.strokeStyle='#5abaff80';ctx.lineWidth=1.5;ctx.stroke();
   const orbit=[];for(let angle=0;angle<=Math.PI*2+.05;angle+=.04){orbit.push(project(transform({x:Math.cos(angle)*1.34,y:Math.sin(angle)*.23,z:Math.sin(angle)*1.34}),radius));}line(orbit,'#75bdff33');
   for(const p of positions){const scale=Math.max(.78,Math.min(1.12,p.scale));p.node.style.left=p.x+'px';p.node.style.top=p.y+'px';p.node.style.transform=`translate(-50%,-50%) scale(${scale})`;p.node.style.zIndex=String(Math.round(p.z*10+30));p.node.style.opacity=p.z<-.4?'.78':'1';}
  }
  function tick(){if(disposed)return;if(animating&&!document.hidden){yaw+=.002;draw();}frame=requestAnimationFrame(tick);}
  function resize(){const box=stage.getBoundingClientRect();width=box.width;height=box.height;const ratio=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);draw();}
  canvas.addEventListener('pointerdown',event=>{dragging=true;lastX=event.clientX;lastY=event.clientY;canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!dragging)return;yaw+=(event.clientX-lastX)*.006;pitch=Math.max(-.65,Math.min(.65,pitch+(event.clientY-lastY)*.003));lastX=event.clientX;lastY=event.clientY;draw();});
  canvas.addEventListener('pointerup',()=>{dragging=false;});canvas.addEventListener('pointercancel',()=>{dragging=false;});
  const controls=document.querySelector('#globe-controls');controls.onclick=event=>{const button=event.target.closest('[data-globe-control]');if(!button)return;const type=button.dataset.globeControl;if(type==='left')yaw-=.3;if(type==='right')yaw+=.3;if(type==='reset'){yaw=-.4;pitch=.1;zoom=1;}if(type==='zoom-in')zoom=Math.min(1.2,zoom+.1);if(type==='zoom-out')zoom=Math.max(.7,zoom-.1);if(type==='next')viewPage++;if(type==='previous')viewPage=Math.max(0,viewPage-1);if(type==='animate'){animating=!animating&&!reduced;button.setAttribute('aria-pressed',String(animating));}draw();};
  const observer=new ResizeObserver(resize);observer.observe(stage);resize();if(!reduced)frame=requestAnimationFrame(tick);
  cleanup=()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.onclick=null;};
 }
 window.TeamGlobe={mount,dispose:()=>cleanup()};
})();
