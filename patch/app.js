/* ==================== Open3DMap: scanuri 3D + ghidaj GPS ==================== */
const O3M={scans:[],cur:null,view:null,lib:null,show:true,dirty:false,loading:false};
function o3mToast(t,ms){
  const el=$("o3mt");if(!el)return;el.textContent=t;el.classList.add("on");
  clearTimeout(O3M.tt);O3M.tt=setTimeout(()=>el.classList.remove("on"),ms||3200);
}
function o3mFeats(j){
  if(!j)return[];
  if(Array.isArray(j))return j;
  if(Array.isArray(j.features))return j.features;
  if(j.geometry)return[j];
  return[];
}
function o3mNorm(f){
  const g=f&&(f.geometry||f),c=g&&g.coordinates;
  if(!Array.isArray(c)||c.length<2)return null;
  const lon=+c[0],lat=+c[1];
  if(!isFinite(lat)||!isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||(lat===0&&lon===0))return null;
  const p=f.properties||{},tags=Array.isArray(p.tags)?p.tags:[];
  return{id:String(f.id||lat+","+lon),lon,lat,
    name:p.title||p.name||tags[0]||("Scan "+String(f.id||"").slice(0,6)),
    folder:p.folder||"3D",
    desc:[p.description,p.device_model,String(p.timestamp||"").slice(0,10),
          tags.join(", "),p.privacy&&p.privacy.license].filter(Boolean).join(" · "),
    splat:p.splat_file_url||p.splat||null};
}
async function o3mLoad(force){
  if(O3M.loading)return O3M.scans.length;O3M.loading=1;
  const q=(location.search.match(/[?&]o3m=([^&]+)/)||[])[1],src=[];
  if(q)src.push(decodeURIComponent(q));
  src.push("scans.splatjson","data/scans.splatjson","scans.json");
  for(const u of src){
    try{
      const r=await fetch(u,{cache:force?"reload":"default"});
      if(!r.ok)continue;
      const arr=o3mFeats(await r.json()).map(o3mNorm).filter(Boolean);
      if(arr.length){O3M.scans=arr;O3M.dirty=true;O3M.loading=0;o3mSync();return arr.length}
    }catch(e){}
  }
  O3M.loading=0;o3mSync();return O3M.scans.length;
}
function o3mVis(){
  if(!gm||!gmReady)return;
  ["o3m-c","o3m-n","o3m-p","o3m-t"].forEach(id=>{
    if(gm.getLayer(id))try{gm.setLayoutProperty(id,"visibility",O3M.show?"visible":"none")}catch(e){}
  });
}
function o3mLayers(){
  if(!gm||!gmReady||gm.getSource("o3m"))return;
  const ff=(gm.getStyle().layers.find(l=>l.type==="symbol"&&l.layout&&l.layout["text-font"])||{layout:{}}).layout["text-font"]||["Noto Sans Regular"];
  gm.addSource("o3m",{type:"geojson",data:EMPTY,cluster:true,clusterRadius:46,clusterMaxZoom:12});
  const NC=["!",["has","point_count"]];
  gm.addLayer({id:"o3m-c",type:"circle",source:"o3m",filter:["has","point_count"],paint:{"circle-color":"#6b4dff","circle-opacity":.94,"circle-radius":["step",["get","point_count"],17,10,22,50,27],"circle-stroke-color":"#fff","circle-stroke-width":2.5}});
  gm.addLayer({id:"o3m-n",type:"symbol",source:"o3m",filter:["has","point_count"],layout:{"text-field":["get","point_count_abbreviated"],"text-font":ff,"text-size":13,"text-allow-overlap":true},paint:{"text-color":"#fff"}});
  gm.addLayer({id:"o3m-p",type:"circle",source:"o3m",filter:NC,paint:{"circle-radius":["interpolate",["linear"],["zoom"],6,6,16,12],"circle-color":"#6b4dff","circle-stroke-color":"#fff","circle-stroke-width":2.5}});
  gm.addLayer({id:"o3m-t",type:"symbol",source:"o3m",filter:NC,minzoom:13,layout:{"text-field":["get","n"],"text-font":ff,"text-size":11.5,"text-anchor":"top","text-offset":[0,1.2],"text-optional":true,"text-max-width":9},paint:{"text-color":"#1c1c1e","text-halo-color":"#fff","text-halo-width":1.6}});
  gm.on("click","o3m-p",e=>{
    const k=e.features&&e.features[0]&&e.features[0].properties.k;
    const s=O3M.scans.find(x=>x.id===k);if(s)o3mCard(s);
  });
  gm.on("click","o3m-c",e=>{
    try{gm.easeTo({center:e.features[0].geometry.coordinates,zoom:gm.getZoom()+2.2,duration:600})}catch(_){}
  });
}
function o3mSync(){
  const b=$("o3mb");if(b)b.hidden=!M()||!!nav.on;
  if(!gm||!gmReady)return;
  if(!O3M.scans.length)return;
  try{o3mLayers()}catch(e){return}
  if(!gm.getSource("o3m"))return;
  if(O3M.dirty){
    O3M.dirty=false;
    gm.getSource("o3m").setData({type:"FeatureCollection",
      features:O3M.scans.map(s=>pt([s.lon,s.lat],{k:s.id,n:s.name}))});
  }
  o3mVis();
}
function o3mCard(s){
  O3M.cur=s;closePc();
  $("o3mn").textContent=s.name;
  $("o3ms").textContent=(s.desc?s.desc+" · ":"")+(start?km(hav(start,s))+" de la tine":(s.lat.toFixed(5)+", "+s.lon.toFixed(5)));
  $("o3mgo").hidden=!s.splat;
  const ex=$("o3mex");ex.hidden=!s.splat;if(s.splat)ex.href=s.splat;
  $("o3mp").classList.add("on");
  if(gm)gm.easeTo({center:[s.lon,s.lat],zoom:Math.max(gm.getZoom(),15),offset:[0,-40],duration:600});
}
$("o3mcx").onclick=()=>$("o3mp").classList.remove("on");
$("o3mb").onclick=async()=>{
  if(!O3M.scans.length){
    const n=await o3mLoad(true);
    o3mToast(n?n+" puncte Open3DMap încărcate.":"Nu am găsit scans.splatjson lângă pagină.");
    return;
  }
  O3M.show=!O3M.show;
  $("o3mb").classList.toggle("off",!O3M.show);
  o3mVis();
};
$("o3ma").onclick=()=>{
  const s=O3M.cur,m=M();if(!s||!m)return;
  const i=m.pts.push({name:s.name,lat:s.lat,lon:s.lon,desc:s.desc||"Open3DMap",folder:s.folder||"3D"})-1;
  m.sel.add(i);save();render();changed();
  $("o3mp").classList.remove("on");
  o3mToast("„"+s.name+"” adăugat în traseu.");
};
$("o3mnv").onclick=()=>{
  const s=O3M.cur,m=M();if(!s||!m)return;
  if(![...m.sel].some(i=>m.pts[i]&&m.pts[i].lat===s.lat&&m.pts[i].lon===s.lon)){
    o3mToast("Adaugă întâi punctul la traseu.");return;
  }
  if(!m.last||!m.last.route[1]){o3mToast("Traseul încă se calculează…");return}
  nav.forceFb=1;
  const b=document.querySelector("#links .go");
  if(!b){o3mToast("Pornește din bara de jos.");return}
  $("o3mp").classList.remove("on");b.click();
};

/* ---- viewer 3D, încărcat doar la cerere ---- */
function o3mImp(u,ms){
  return Promise.race([import(u),new Promise((_,rj)=>setTimeout(()=>rj(new Error("timeout")),ms||25000))]);
}
$("o3mgo").onclick=async()=>{
  const s=O3M.cur;if(!s||!s.splat)return;
  const box=$("o3mv"),lab=$("o3ml");
  box.classList.add("on");lab.hidden=false;lab.textContent="Se încarcă 3D… 0%";
  try{
    if(!O3M.lib){
      try{O3M.lib=await o3mImp("https://unpkg.com/@mkkellogg/gaussian-splats-3d@0.4.7/build/gaussian-splats-3d.module.js")}
      catch(e){O3M.lib=await o3mImp("https://esm.sh/@mkkellogg/gaussian-splats-3d@0.4.7?deps=three@0.169.0")}
    }
    const V=O3M.lib.Viewer;
    O3M.view=new V({rootElement:box,cameraUp:[0,-1,0],useBuiltInControls:true,
      sharedMemoryForWorkers:false,sphericalHarmonicsDegree:0});
    await O3M.view.addSplatScene(s.splat,{showLoadingUI:true,progressiveLoad:true,
      onProgress:p=>{if(p!=null)lab.textContent="Se încarcă 3D… "+Math.round(p*100)+"%"}});
    lab.hidden=true;O3M.view.start();
  }catch(e){
    lab.textContent="Nu pot deschide scanul: "+(e&&e.message?e.message:e);
    try{O3M.view&&O3M.view.dispose&&O3M.view.dispose()}catch(_){}
    O3M.view=null;
  }
};
$("o3mx").onclick=()=>{
  $("o3mv").classList.remove("on");
  try{O3M.view&&O3M.view.stop&&O3M.view.stop()}catch(e){}
  try{O3M.view&&O3M.view.dispose&&O3M.view.dispose()}catch(e){}
  O3M.view=null;
};

/* ---- ghidaj GPS care nu se blochează ---- */
navLeg=async function(a){
  const t=nav.tgt;if(!t)throw new Error("fără țintă");
  const forced=nav.forceFb;nav.forceFb=0;
  let from=a||nav.pos||start;
  if(!from){const ok=await getLoc(true);from=(ok&&start)?start:null}
  if(!from)throw new Error("fără poziție");
  if(!forced&&navigator.onLine!==false){
    try{
      const c=new AbortController(),to=setTimeout(()=>c.abort(),9000);
      const r=await fetch("https://router.project-osrm.org/route/v1/driving/"+
        from.lon+","+from.lat+";"+t.lon+","+t.lat+"?overview=full&geometries=geojson&steps=true",
        {signal:c.signal});
      clearTimeout(to);
      const j=await r.json();
      if(j.code==="Ok"&&j.routes&&j.routes[0]){
        const R=j.routes[0];
        nav.geo=R.geometry.coordinates.map(c=>[c[1],c[0]]);
        nav.steps=R.legs[0].steps;nav.si=nav.steps.length>1?1:0;
        nav.said={};nav.off=0;nav.t=Date.now();nav.fb=0;nav.fbgeo=null;nav.pi=-1;
        if(gm&&gmReady){gm.getSource("nrt").setData(rtData());gm.getSource("ndone").setData(EMPTY)}
        return;
      }
    }catch(e){}
  }
  const dist=hav(from,t);
  nav.fbgeo=[[from.lat,from.lon],[t.lat,t.lon]];
  nav.geo=nav.fbgeo;
  nav.steps=[
    {maneuver:{type:"depart",modifier:"straight",location:[from.lon,from.lat]},name:"",distance:0,duration:0},
    {maneuver:{type:"turn",modifier:"straight",location:[t.lon,t.lat]},name:t.name||"",distance:dist,duration:dist/11},
    {maneuver:{type:"arrive",modifier:"straight",location:[t.lon,t.lat]},name:"",distance:0,duration:0}
  ];
  nav.si=1;nav.said={};nav.off=0;nav.t=Date.now();nav.fb=1;nav.pi=-1;
  if(gm&&gmReady){gm.getSource("nrt").setData(rtData());gm.getSource("ndone").setData(EMPTY)}
  o3mToast("Ghidaj direct: "+(dist>=1000?(dist/1000).toFixed(1)+" km":Math.round(dist/10)*10+" m")+" până la "+t.name);
};
const _snapTo=snapTo;
snapTo=function(p,geo){
  if(nav.fb&&geo===nav.fbgeo)return null;
  return _snapTo(p,geo);
};
const _startNav=startNav;
startNav=function(){
  if(!start){o3mToast("Setează întâi locația ta.");openSheet("v-loc");getLoc(false);return}
  nav.forceFb=0;
  return _startNav.apply(this,arguments);
};

/* ---- sincronizare UI ---- */
new MutationObserver(()=>{
  const b=$("o3mb");if(b)b.hidden=!M()||!!nav.on;
  if(nav.on)$("o3mp").classList.remove("on");
}).observe($("nv"),{attributes:true,attributeFilter:["hidden"]});

const _drawMap=drawMap;
drawMap=function(m,r){
  const x=_drawMap.apply(this,arguments);
  try{o3mSync()}catch(e){}
  return x;
};
const _initMap=initMap;
initMap=function(){
  const x=_initMap.apply(this,arguments);
  try{
    if(gm&&!gm.__o3mS){
      gm.__o3mS=1;
      gm.on("style.load",()=>{O3M.dirty=true;setTimeout(()=>{try{o3mSync()}catch(e){}},0)});
    }
  }catch(e){}
  return x;
};
const _render=render;
render=function(){
  const x=_render.apply(this,arguments);
  try{o3mSync()}catch(e){}
  return x;
};

setTimeout(()=>{o3mLoad()},1000);
