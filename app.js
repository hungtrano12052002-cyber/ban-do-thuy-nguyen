let places=[], map, markers=[], markerGroup=null, currentUser=null, selectedId=null, supabaseClient=null, realtimeChannel=null, baseLayers={};
const defaultCenter=[20.96,106.69];
const STORE='thuynguyen_places_v5';
const demoAuth={admin:{pass:'admin123',role:'admin'},user:{pass:'user123',role:'user'}};
const fileCfg=window.APP_CONFIG||{};
let savedCloudCfg={};
try{savedCloudCfg=JSON.parse(localStorage.getItem('tn_cloud_config')||'{}')}catch(_){savedCloudCfg={}}
const cfg={...fileCfg,...savedCloudCfg};
const cloudEnabled=!!(cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&window.supabase?.createClient);

function initCloud(){
  if(!cloudEnabled)return;
  supabaseClient=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}
async function init(){
  map=L.map('map',{zoomControl:false,preferCanvas:true,zoomSnap:.5,zoomDelta:.5}).setView(defaultCenter,13);

  // V6.3 Premium Map: detailed street, topographic and satellite-hybrid basemaps.
  const esriStreet=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{
    maxZoom:20,attribution:'Tiles © Esri',keepBuffer:5,updateWhenIdle:false,crossOrigin:true
  });
  const esriTopo=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{
    maxZoom:19,attribution:'Tiles © Esri',keepBuffer:5,crossOrigin:true
  });
  const carto=L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
    subdomains:'abcd',maxZoom:20,attribution:'© OpenStreetMap © CARTO',keepBuffer:5,crossOrigin:true
  });
  const osm=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'© OpenStreetMap',keepBuffer:5,crossOrigin:true
  });
  const imagery=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
    maxZoom:20,attribution:'Imagery © Esri',keepBuffer:5,crossOrigin:true
  });
  const imageryLabels=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{
    maxZoom:19,opacity:.95,attribution:'Labels © Esri',pane:'overlayPane',crossOrigin:true
  });
  const transportLabels=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',{
    maxZoom:19,opacity:.9,attribution:'Transportation © Esri',pane:'overlayPane',crossOrigin:true
  });
  const satelliteHybrid=L.layerGroup([imagery,transportLabels,imageryLabels]);

  baseLayers={street:esriStreet,topo:esriTopo,light:carto,osm,satellite:satelliteHybrid,standard:esriStreet};
  baseLayers.standard.addTo(map);

  let activeBase=baseLayers.standard, tileErrors=0, fallbackIndex=0;
  const fallbackLayers=[carto,osm];
  function attachTileGuard(layer){
    if(!layer?.on)return;
    layer.on('tileload',()=>{tileErrors=0});
    layer.on('tileerror',()=>{
      if(layer!==activeBase)return;
      tileErrors++;
      if(tileErrors>=4 && fallbackIndex<fallbackLayers.length){
        const next=fallbackLayers[fallbackIndex++]; tileErrors=0;
        try{map.removeLayer(activeBase)}catch(_){}
        activeBase=next; next.addTo(map);
        toast('Đã tự chuyển sang nền bản đồ dự phòng.');
      }
    });
  }
  [esriStreet,esriTopo,carto,osm,imagery,imageryLabels,transportLabels].forEach(attachTileGuard);
  map.on('baselayerchange',e=>{activeBase=e.layer;tileErrors=0});

  L.control.zoom({position:'bottomright'}).addTo(map);
  L.control.scale({position:'bottomleft',metric:true,imperial:false,maxWidth:130}).addTo(map);
  const layerControl=L.control.layers({
    '🛣️ Đường phố chi tiết':esriStreet,
    '⛰️ Địa hình':esriTopo,
    '✨ Bản đồ sáng':carto,
    '🛰️ Vệ tinh + tên đường':satelliteHybrid,
    '🌐 OpenStreetMap':osm
  },null,{position:'bottomright',collapsed:true}).addTo(map);

  // Quick map-style selector, easier to use on phones than the Leaflet layer menu.
  const Quick=L.Control.extend({
    options:{position:'topright'},
    onAdd(){
      const box=L.DomUtil.create('div','map-style-chips');
      box.innerHTML='<button data-style="street" class="active">Phố</button><button data-style="topo">Địa hình</button><button data-style="satellite">Vệ tinh</button>';
      L.DomEvent.disableClickPropagation(box);L.DomEvent.disableScrollPropagation(box);
      box.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
        const key=btn.dataset.style, next=baseLayers[key]; if(!next)return;
        Object.values(baseLayers).forEach(l=>{if(l&&l!==next&&l!==baseLayers.standard&&map.hasLayer(l))try{map.removeLayer(l)}catch(_){}});
        // explicitly remove known base layers including standard when switching
        [esriStreet,esriTopo,carto,osm,satelliteHybrid].forEach(l=>{if(l!==next&&map.hasLayer(l))map.removeLayer(l)});
        if(!map.hasLayer(next))next.addTo(map); activeBase=next;
        box.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn));
      }));
      return box;
    }
  });
  map.addControl(new Quick());

  const Legend=L.Control.extend({
    options:{position:'bottomleft'},
    onAdd(){const d=L.DomUtil.create('div','map-legend');d.innerHTML='<span><i class="legend-pin active"></i>Đang hoạt động</span><span><i class="legend-pin inactive"></i>Ngừng/không hoạt động</span>';return d;}
  });
  map.addControl(new Legend());

  setTimeout(()=>map.invalidateSize(true),250);
  window.addEventListener('resize',()=>setTimeout(()=>map.invalidateSize(false),100));
  markerGroup=window.L.markerClusterGroup?L.markerClusterGroup({
    showCoverageOnHover:false,maxClusterRadius:52,spiderfyOnMaxZoom:true,disableClusteringAtZoom:18,
    spiderfyDistanceMultiplier:1.25,animate:true,zoomToBoundsOnClick:true
  }):L.layerGroup();
  markerGroup.addTo(map);
  if(cloudEnabled&&currentUser?.cloud){await loadCloudPlaces();subscribeRealtime();}
  else loadLocalPlaces();
  renderAll();updateCloudBadge();
}

function loadLocalPlaces(){
  const saved=localStorage.getItem(STORE)||localStorage.getItem('thuynguyen_places_v4');
  if(saved){try{places=JSON.parse(saved)}catch(e){places=[]}}
  if(!places.length)places=structuredClone(window.INITIAL_PLACES||[]);
  normalizePlaces();
}
async function loadCloudPlaces(){
  const {data,error}=await supabaseClient.from('places').select('id,data').order('updated_at',{ascending:false});
  if(error){toast('Không tải được dữ liệu cloud: '+error.message);loadLocalPlaces();return;}
  places=(data||[]).map(r=>({...r.data,id:r.id}));
  if(!places.length)places=structuredClone(window.INITIAL_PLACES||[]);
  normalizePlaces();
}
function subscribeRealtime(){
  if(!supabaseClient)return;
  if(realtimeChannel)supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel=supabaseClient.channel('places-live').on('postgres_changes',{event:'*',schema:'public',table:'places'},async()=>{await loadCloudPlaces();renderAll();toast('Dữ liệu vừa được đồng bộ từ máy khác.');}).subscribe();
}
function normalizePlaces(){places=places.map((x,i)=>({...x,id:String(x.id??Date.now()+i),images:Array.isArray(x.images)?x.images:[],lat:numOrNull(x.lat),lng:numOrNull(x.lng)}))}
function numOrNull(v){if(v===''||v===null||v===undefined)return null;const n=Number(v);return Number.isFinite(n)?n:null}
function persist(){if(!cloudEnabled||!currentUser?.cloud)localStorage.setItem(STORE,JSON.stringify(places))}

async function login(){
  const u=$('user').value.trim(),p=$('pass').value;
  if(cloudEnabled&&u.includes('@')){
    const {data,error}=await supabaseClient.auth.signInWithPassword({email:u,password:p});
    if(error)return toast('Đăng nhập cloud thất bại: '+error.message);
    const role=await getCloudRole(data.user.id);
    currentUser={name:data.user.email,role,cloud:true,id:data.user.id};
    enterApp();return;
  }
  const a=demoAuth[u];
  if(a&&a.pass===p){currentUser={name:u,role:a.role,cloud:false};sessionStorage.setItem('demo_user',u);enterApp()}
  else toast(cloudEnabled?'Dùng email Supabase hoặc tài khoản demo hợp lệ.':'Sai tài khoản hoặc mật khẩu');
}
async function getCloudRole(uid){
  const {data}=await supabaseClient.from('profiles').select('role').eq('id',uid).maybeSingle();
  return data?.role==='admin'?'admin':'user';
}
function enterApp(){
  $('login').classList.add('hidden');$('app').classList.remove('hidden');$('role').textContent=currentUser.role.toUpperCase();document.body.dataset.role=currentUser.role;
  if(!map)init(); else {loadCurrentMode().then(()=>{renderAll();updateCloudBadge()})}
}
async function loadCurrentMode(){if(cloudEnabled&&currentUser?.cloud){await loadCloudPlaces();subscribeRealtime()}else loadLocalPlaces()}
async function logout(){
  if(currentUser?.cloud&&supabaseClient)await supabaseClient.auth.signOut();
  sessionStorage.clear();location.reload();
}
function updateCloudBadge(){const e=$('cloudStatus');if(!e)return;e.textContent=currentUser?.cloud?'☁ CLOUD':'◉ LOCAL';e.title=currentUser?.cloud?'Đang đồng bộ Supabase':'Đang dùng dữ liệu trên thiết bị';const r=$('role');if(r&&currentUser&&!currentUser.cloud)r.textContent=(currentUser.role||'USER').toUpperCase()+' LOCAL'}

function filtered(){
 const q=($('search')?.value||'').toLowerCase().trim(),st=$('statusFilter')?.value||'';
 return places.filter(x=>{const active=isActive(x.status);return (!st||(st==='active'?active:!active))&&(!q||Object.values(x).join(' ').toLowerCase().includes(q))});
}
function isActive(s=''){return !/không hoạt động|ngừng|thu hồi|đóng cửa/i.test(s)}
function renderAll(){renderStats();renderList();renderMarkers()}
function renderStats(){const visible=filtered(),active=visible.filter(x=>isActive(x.status)).length,geo=visible.filter(validGeo).length;$('stats').innerHTML=`<div><b>${visible.length}</b><span>Cơ sở</span></div><div><b>${active}</b><span>Hoạt động</span></div><div><b>${geo}</b><span>Có tọa độ</span></div>`}
function renderList(){const arr=filtered(),list=$('list');list.innerHTML=arr.length?arr.map(x=>`<div class="item ${selectedId===x.id?'selected':''}" onclick="focusPlace('${escJs(x.id)}')"><div class="item-head"><b>${esc(x.name)}</b><span class="dot ${isActive(x.status)?'on':'off'}"></span></div><small>${esc(x.wardBlock||'Chưa có TDP')} · ${esc(x.officer||'Chưa phân công')}</small><span class="badge ${isActive(x.status)?'':'off'}">${esc(x.status||'Chưa rõ')}</span></div>`).join(''):`<div class="empty">Không có kết quả phù hợp.</div>`}
function markerIcon(active,selected=false){return L.divIcon({className:'pin-wrap',html:`<div class="gpin ${active?'on':'off'} ${selected?'selected':''}"><span></span></div>`,iconSize:[38,46],iconAnchor:[19,44],tooltipAnchor:[0,-40]})}
function renderMarkers(){if(!map)return;if(markerGroup)markerGroup.clearLayers();markers=[];filtered().forEach(x=>{if(validGeo(x)){const m=L.marker([x.lat,x.lng],{icon:markerIcon(isActive(x.status),String(selectedId)===String(x.id)),title:x.name,placeId:String(x.id)}).bindTooltip(`<b>${esc(x.name)}</b><br><small>${esc(x.wardBlock||'')}</small>`,{direction:'top',offset:[0,-14],className:'place-tooltip'});m.on('click',()=>{selectedId=x.id;renderMarkers();showDetail(x);if(innerWidth<=760)showMobileTab('map')});markerGroup.addLayer(m);markers.push(m)}})}
function validGeo(x){return Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lng))&&Number(x.lat)!==0&&Number(x.lng)!==0}
function fitAll(){const pts=filtered().filter(validGeo).map(x=>[x.lat,x.lng]);if(pts.length)map.fitBounds(pts,{padding:[40,40],maxZoom:16});else toast('Chưa có cơ sở nào có tọa độ.')}
function focusPlace(id){const x=places.find(p=>String(p.id)===String(id));if(!x)return;selectedId=x.id;renderList();if(validGeo(x)){map.flyTo([x.lat,x.lng],18,{duration:.65});if(markerGroup?.zoomToShowLayer){const m=markers.find(mm=>String(mm.options.title)===String(x.name));if(m)markerGroup.zoomToShowLayer(m)}}showDetail(x)}
function showDetail(x){
 selectedId=x.id;renderList();const d=$('detail');d.classList.remove('hidden');const imgs=(x.images||[]).slice(0,8).map(src=>`<img src="${escAttr(src)}" alt="Ảnh cơ sở" loading="lazy">`).join('');
 d.innerHTML=`<button class="close" onclick="dclose()">×</button><div class="detail-title"><h2>${esc(x.name)}</h2><span class="badge ${isActive(x.status)?'':'off'}">${esc(x.status||'Chưa rõ')}</span></div>${imgs?`<div class="gallery">${imgs}</div>`:''}${row('TDP / khu vực',x.wardBlock)}${row('Chủ cơ sở',x.ownerName)}${row('Số điện thoại',phoneLink(x.ownerPhone))}${row('Người quản lý',x.managerName)}${row('SĐT quản lý',phoneLink(x.managerPhone))}${row('Địa chỉ quản lý',x.managerAddress)}${row('Cán bộ phụ trách',x.officer)}${row('Quy mô',x.scale)}${row('Pháp lý',x.legal)}${row('Tọa độ',validGeo(x)?`${x.lat}, ${x.lng}`:'Chưa có')}${!validGeo(x)&&x.mapsUrl?'<div class="geo-note">📌 Chưa có tọa độ. ADMIN Cloud có thể bấm “Tự lấy tọa độ” để giải mã link Google Maps và tạo marker.</div>':''}<div class="actions mobile-actions"><a class="route-a" href="${escAttr(directionUrl(x))}" target="_blank" rel="noopener">🧭 Chỉ đường</a>${x.mapsUrl?`<a href="${escAttr(x.mapsUrl)}" target="_blank" rel="noopener">📍 Google Maps</a>`:''}<a class="secondary-a" href="${escAttr(googleImageUrl(x))}" target="_blank" rel="noopener">🖼️ Ảnh Google</a>${validGeo(x)?`<a class="secondary-a" href="${escAttr(streetViewUrl(x))}" target="_blank" rel="noopener">👁 Street View</a>`:''}<button class="secondary" onclick="sharePlace('${escJs(x.id)}')">↗️ Chia sẻ</button>${!validGeo(x)&&x.mapsUrl&&currentUser?.cloud&&currentUser?.role==='admin'?`<button class="secondary admin-only" onclick="resolveOneCoordinate('${escJs(x.id)}')">📌 Tự lấy tọa độ</button>`:''}${x.lodgerListUrl?`<a class="secondary-a" href="${escAttr(x.lodgerListUrl)}" target="_blank" rel="noopener">📋 Danh sách</a>`:''}<button class="secondary admin-only" onclick="openEditor('${escJs(x.id)}')">✏️ Sửa</button></div>`;
}
function row(a,b){return `<div class="row"><label>${esc(a)}</label><div>${b&&String(b).startsWith('<a ')?b:esc(b||'—')}</div></div>`}
function phoneLink(v){if(!v)return '—';const p=String(v).replace(/\D/g,'');return `<a class="phone" href="tel:${p}">${esc(formatPhone(v))}</a>`}
function formatPhone(v){let s=String(v).trim();if(/^\d{9}$/.test(s))s='0'+s;return s}
function dclose(){selectedId=null;$('detail').classList.add('hidden');renderList();renderMarkers()}

function openEditor(id=null){
 if(currentUser.role!=='admin')return toast('Chỉ ADMIN được chỉnh sửa dữ liệu.');
 const x=id!==null?places.find(p=>String(p.id)===String(id)):null;
 const p=x?structuredClone(x):{id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name:'',mapsUrl:'',lodgerListUrl:'',ownerName:'',ownerPhone:'',wardBlock:'',managerName:'',managerPhone:'',managerAddress:'',officer:'',scale:'',legal:'',status:'Vẫn Hoạt động',lat:null,lng:null,images:[]};
 $('modalCard').innerHTML=`<div class="modal-head"><h2>${x?'Sửa cơ sở':'Thêm cơ sở'}</h2><button onclick="closeModal()">×</button></div><form id="placeForm" onsubmit="savePlace(event,'${escJs(p.id)}')"><div class="form-grid">${field('Tên cơ sở','f_name',p.name,true)}${field('TDP / khu vực','f_wardBlock',p.wardBlock)}${field('Chủ cơ sở','f_ownerName',p.ownerName)}${field('SĐT chủ cơ sở','f_ownerPhone',p.ownerPhone,'','tel')}${field('Người quản lý','f_managerName',p.managerName)}${field('SĐT quản lý','f_managerPhone',p.managerPhone,'','tel')}${field('Địa chỉ quản lý','f_managerAddress',p.managerAddress,false,'text','wide')}${field('Cán bộ phụ trách','f_officer',p.officer)}${field('Quy mô','f_scale',p.scale)}${field('Tình trạng','f_status',p.status)}${field('Pháp lý','f_legal',p.legal,false,'text','wide')}${field('Link Google Maps','f_mapsUrl',p.mapsUrl,false,'url','wide')}${field('Link danh sách lưu trú','f_lodgerListUrl',p.lodgerListUrl,false,'url','wide')}${field('Vĩ độ (lat)','f_lat',p.lat??'',false,'number')}${field('Kinh độ (lng)','f_lng',p.lng??'',false,'number')}</div><div class="coord-tools"><button type="button" onclick="coordsFromLink()">📌 Tách tọa độ từ link</button><button type="button" onclick="pickMapCenter()">🎯 Lấy tâm bản đồ hiện tại</button></div><div class="image-editor"><label>Ảnh cơ sở <small>${currentUser.cloud?'(sẽ tải lên cloud khi lưu)':'(lưu trên thiết bị)'}</small></label><input id="f_images" type="file" accept="image/*" multiple onchange="previewImages(event)"><div id="imagePreview" class="gallery edit-gallery">${(p.images||[]).map(src=>`<div class="img-box" data-existing="1"><img src="${escAttr(src)}"><button type="button" onclick="this.parentElement.remove()">×</button></div>`).join('')}</div></div><div class="form-actions">${x?`<button type="button" class="danger" onclick="deletePlace('${escJs(p.id)}')">Xóa</button>`:''}<span></span><button type="button" class="ghost" onclick="closeModal()">Hủy</button><button class="primary" type="submit">Lưu</button></div></form>`;
 $('modal').classList.remove('hidden');
}
function field(label,id,val,required=false,type='text',cls=''){return `<label class="field ${cls}"><span>${label}</span><input id="${id}" type="${type}" ${type==='number'?'step="any"':''} value="${escAttr(val??'')}" ${required?'required':''}></label>`}
function coordsFromLink(){const url=$('f_mapsUrl').value.trim();if(!url)return toast('Hãy dán link Google Maps trước.');const c=parseCoords(url);if(!c)return toast('Link rút gọn không chứa tọa độ. Hãy mở link và dán URL đầy đủ hoặc nhập tọa độ.');$('f_lat').value=c[0];$('f_lng').value=c[1];toast('Đã lấy tọa độ từ link.')}
function parseCoords(url){const pats=[/@(-?\d+\.\d+),(-?\d+\.\d+)/,/query=(-?\d+\.\d+)%?2?C?(-?\d+\.\d+)/,/q=(-?\d+\.\d+),(-?\d+\.\d+)/,/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/];for(const p of pats){const m=url.match(p);if(m)return [Number(m[1]),Number(m[2])]}return null}
function pickMapCenter(){const c=map.getCenter();$('f_lat').value=c.lat.toFixed(6);$('f_lng').value=c.lng.toFixed(6);toast('Đã lấy tọa độ tâm bản đồ.')}
async function previewImages(e){const files=[...e.target.files].slice(0,8);for(const f of files){if(f.size>6_000_000){toast('Bỏ qua ảnh lớn hơn 6 MB.');continue}const data=await fileToDataUrl(f);const div=document.createElement('div');div.className='img-box';div._file=f;div.innerHTML=`<img src="${data}"><button type="button" onclick="this.parentElement.remove()">×</button>`;$('imagePreview').appendChild(div)}}
function fileToDataUrl(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)})}
async function uploadNewImages(placeId){
 const boxes=[...document.querySelectorAll('#imagePreview .img-box')],urls=[];
 for(const box of boxes){
   if(box.dataset.existing==='1'){urls.push(box.querySelector('img').src);continue}
   if(!box._file){urls.push(box.querySelector('img').src);continue}
   const f=box._file,ext=(f.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase(),path=`${placeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
   const {error}=await supabaseClient.storage.from(cfg.STORAGE_BUCKET||'place-images').upload(path,f,{cacheControl:'3600',upsert:false,contentType:f.type||undefined});
   if(error)throw error;
   const {data}=supabaseClient.storage.from(cfg.STORAGE_BUCKET||'place-images').getPublicUrl(path);urls.push(data.publicUrl);
 }
 return urls;
}
async function savePlace(e,id){
 e.preventDefault();
 const btn=e.submitter;if(btn){btn.disabled=true;btn.textContent='Đang lưu…'}
 try{
   const old=places.find(p=>String(p.id)===String(id));
   const images=currentUser.cloud?await uploadNewImages(id):[...document.querySelectorAll('#imagePreview img')].map(i=>i.src);
   const obj={...(old||{}),id:String(id),name:$('f_name').value.trim(),wardBlock:$('f_wardBlock').value.trim(),ownerName:$('f_ownerName').value.trim(),ownerPhone:$('f_ownerPhone').value.trim(),managerName:$('f_managerName').value.trim(),managerPhone:$('f_managerPhone').value.trim(),managerAddress:$('f_managerAddress').value.trim(),officer:$('f_officer').value.trim(),scale:$('f_scale').value.trim(),status:$('f_status').value.trim(),legal:$('f_legal').value.trim(),mapsUrl:$('f_mapsUrl').value.trim(),lodgerListUrl:$('f_lodgerListUrl').value.trim(),lat:numOrNull($('f_lat').value),lng:numOrNull($('f_lng').value),images};
   if(currentUser.cloud){
     const {error}=await supabaseClient.from('places').upsert({id:String(id),data:obj,updated_at:new Date().toISOString(),updated_by:currentUser.id});if(error)throw error;
     await loadCloudPlaces();toast('Đã lưu và đồng bộ lên cloud.');
   }else{if(old)Object.assign(old,obj);else places.unshift(obj);persist();toast('Đã lưu dữ liệu trên thiết bị này.')}
   closeModal();renderAll();focusPlace(id);
 }catch(err){toast('Lưu thất bại: '+(err.message||err))}finally{if(btn){btn.disabled=false;btn.textContent='Lưu'}}
}
async function deletePlace(id){
 if(!confirm(currentUser.cloud?'Xóa cơ sở này khỏi dữ liệu dùng chung?':'Xóa cơ sở này khỏi dữ liệu cục bộ?'))return;
 if(currentUser.cloud){const {error}=await supabaseClient.from('places').delete().eq('id',String(id));if(error)return toast('Xóa thất bại: '+error.message);await loadCloudPlaces();toast('Đã xóa và đồng bộ.')}else{places=places.filter(p=>String(p.id)!==String(id));persist();toast('Đã xóa cơ sở.')}
 closeModal();dclose();renderAll();
}

function openCloudSetup(){
 const d=$('modalCard');
 const curUrl=cfg.SUPABASE_URL||'';
 const hasKey=!!cfg.SUPABASE_ANON_KEY;
 d.innerHTML=`<div class="modal-head"><h2>☁ Kết nối Supabase Cloud</h2><button onclick="closeModal()">×</button></div>
 <div class="cloud-setup">
  <p>Nhập <b>Project URL</b> và <b>Publishable key / anon key</b>. Không dùng service_role hoặc secret key.</p>
  <label>Project URL<input id="cloud_url" value="${escAttr(curUrl)}" placeholder="https://xxxxx.supabase.co"></label>
  <label>Publishable / anon key<input id="cloud_key" type="password" value="" placeholder="${hasKey?'Đang có key — để trống nếu không muốn đổi':'sb_publishable_... hoặc anon JWT'}"></label>
  <div class="form-actions"><span></span><button type="button" class="ghost" onclick="closeModal()">Hủy</button><button class="primary" onclick="saveCloudSetup()">Lưu & khởi động lại</button></div>
  <p class="data-hint">Sau khi lưu, ứng dụng sẽ tải lại. Hãy đăng nhập bằng <b>email Supabase</b>, không dùng tài khoản demo <b>admin</b>.</p>
 </div>`;
 $('modal').classList.remove('hidden');
}
function saveCloudSetup(){
 const url=($('cloud_url')?.value||'').trim().replace(/\/$/,'');
 const key=($('cloud_key')?.value||'').trim();
 if(!url||!/^https:\/\/.+\.supabase\.co$/i.test(url))return toast('Project URL chưa đúng.');
 const oldKey=cfg.SUPABASE_ANON_KEY||'';
 const finalKey=key||oldKey;
 if(!finalKey)return toast('Hãy nhập Publishable/anon key.');
 localStorage.setItem('tn_cloud_config',JSON.stringify({SUPABASE_URL:url,SUPABASE_ANON_KEY:finalKey}));
 location.reload();
}
function clearCloudSetup(){if(confirm('Xóa cấu hình Cloud đã lưu trên trình duyệt này?')){localStorage.removeItem('tn_cloud_config');location.reload();}}
function openDataMenu(){
 if(currentUser.role!=='admin')return;
 const missingGeo=places.filter(x=>!validGeo(x)&&x.mapsUrl).length, noLink=places.filter(x=>!validGeo(x)&&!x.mapsUrl).length;
 $('modalCard').innerHTML=`<div class="modal-head"><h2>Dữ liệu & đồng bộ</h2><button onclick="closeModal()">×</button></div><div class="data-menu"><p>${currentUser.cloud?'Bạn đang dùng dữ liệu cloud. Thay đổi sẽ đồng bộ giữa các thiết bị đã đăng nhập.':'Bạn đang ở chế độ LOCAL. Dữ liệu chỉ nằm trên thiết bị này.'}</p><div class="geo-summary"><b>📍 Tọa độ V6.2</b><span>${places.filter(validGeo).length} đã có · ${missingGeo} có link chờ xử lý · ${noLink} chưa có link</span></div>${currentUser.cloud?`<button class="primary" onclick="resolveAllCoordinates()">📌 Tự lấy tọa độ từ Google Maps (${missingGeo})</button><button onclick="seedCloud()">☁️ Đưa dữ liệu gốc lên cloud</button><button onclick="refreshCloud()">↻ Đồng bộ lại từ cloud</button>`:`<button class="primary" onclick="openCloudSetup()">☁ Kết nối Supabase Cloud</button>`}<button onclick="exportJson()">⬇️ Xuất dữ liệu JSON</button>${!currentUser.cloud?`<button onclick="$('importFile').click();closeModal()">⬆️ Nhập dữ liệu JSON</button><button class="danger" onclick="resetData()">↺ Khôi phục dữ liệu gốc</button>`:''}<p class="data-hint">Tự lấy tọa độ cần đăng nhập tài khoản ADMIN Cloud và triển khai Edge Function <b>resolve-map-link</b> đi kèm gói V6.2.</p></div>`;$('modal').classList.remove('hidden')
}
async function seedCloud(){
 if(!currentUser.cloud||currentUser.role!=='admin')return;
 if(!confirm('Đưa toàn bộ dữ liệu hiện đang hiển thị lên cloud? Các ID trùng sẽ được cập nhật.'))return;
 const rows=places.map(x=>({id:String(x.id),data:x,updated_at:new Date().toISOString(),updated_by:currentUser.id}));
 const chunk=100;for(let i=0;i<rows.length;i+=chunk){const {error}=await supabaseClient.from('places').upsert(rows.slice(i,i+chunk));if(error)return toast('Đồng bộ thất bại: '+error.message)}
 toast(`Đã đồng bộ ${rows.length} cơ sở lên cloud.`);closeModal();await loadCloudPlaces();renderAll();
}
async function refreshCloud(){closeModal();await loadCloudPlaces();renderAll();toast('Đã tải dữ liệu mới nhất từ cloud.')}
function exportJson(){const blob=new Blob([JSON.stringify(places,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`thuy-nguyen-data-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast('Đã xuất dữ liệu JSON.')}
async function importJson(e){const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!Array.isArray(data))throw 0;places=data;normalizePlaces();persist();renderAll();toast(`Đã nhập ${places.length} cơ sở.`)}catch{toast('File JSON không hợp lệ.')}e.target.value=''}
async function resetData(){if(!confirm('Khôi phục dữ liệu gốc sẽ xóa các thay đổi cục bộ. Tiếp tục?'))return;localStorage.removeItem(STORE);places=structuredClone(window.INITIAL_PLACES||[]);normalizePlaces();closeModal();dclose();renderAll();toast('Đã khôi phục dữ liệu gốc.')}


async function callCoordinateResolver(place){
 if(!supabaseClient||!currentUser?.cloud)throw new Error('Cần đăng nhập Cloud.');
 if(!place?.mapsUrl)throw new Error('Cơ sở chưa có link Google Maps.');
 const {data,error}=await supabaseClient.functions.invoke('resolve-map-link',{body:{url:place.mapsUrl}});
 if(error)throw new Error(error.message||'Không gọi được Edge Function resolve-map-link.');
 if(!data?.ok||!Number.isFinite(Number(data.lat))||!Number.isFinite(Number(data.lng)))throw new Error(data?.error||'Không tìm thấy tọa độ trong link Google Maps.');
 return {lat:Number(data.lat),lng:Number(data.lng),resolvedUrl:data.finalUrl||place.mapsUrl};
}
async function saveResolvedPlace(place,res){
 const updated={...place,lat:res.lat,lng:res.lng,mapsResolvedUrl:res.resolvedUrl,coordinateSource:'google_maps_link',coordinateUpdatedAt:new Date().toISOString()};
 const {error}=await supabaseClient.from('places').upsert({id:String(updated.id),data:updated,updated_at:new Date().toISOString(),updated_by:currentUser.id});
 if(error)throw error;
 Object.assign(place,updated);
 return updated;
}
async function resolveOneCoordinate(id){
 if(currentUser?.role!=='admin'||!currentUser?.cloud)return toast('Cần đăng nhập ADMIN Cloud để tự lấy tọa độ.');
 const x=places.find(p=>String(p.id)===String(id));if(!x||!x.mapsUrl)return toast('Cơ sở chưa có link Google Maps.');
 toast('Đang giải mã link Google Maps…');
 try{const r=await callCoordinateResolver(x);await saveResolvedPlace(x,r);renderAll();focusPlace(id);toast(`Đã lấy tọa độ: ${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}`)}catch(e){toast('Không lấy được tọa độ: '+(e.message||e))}
}
async function resolveAllCoordinates(){
 if(currentUser?.role!=='admin'||!currentUser?.cloud)return toast('Cần đăng nhập ADMIN Cloud.');
 const targets=places.filter(x=>!validGeo(x)&&x.mapsUrl);
 if(!targets.length)return toast('Tất cả cơ sở có link Google Maps đã có tọa độ.');
 if(!confirm(`V6.2 sẽ tự xử lý ${targets.length} link Google Maps và lưu tọa độ lên Cloud. Tiếp tục?`))return;
 $('modalCard').innerHTML=`<div class="modal-head"><h2>📍 Tự lấy tọa độ</h2></div><div class="geo-progress"><div class="progress-track"><div id="geoProgressBar"></div></div><b id="geoProgressText">0 / ${targets.length}</b><p id="geoProgressName">Đang chuẩn bị…</p><p class="data-hint">Có thể mất một lúc tùy số link. Không đóng trang cho tới khi hoàn tất.</p></div>`;
 let done=0,ok=0,fail=0;const failed=[];
 const update=(name)=>{done++;const pct=Math.round(done/targets.length*100);const bar=$('geoProgressBar'),txt=$('geoProgressText'),nm=$('geoProgressName');if(bar)bar.style.width=pct+'%';if(txt)txt.textContent=`${done} / ${targets.length} · thành công ${ok} · lỗi ${fail}`;if(nm)nm.textContent=name||''};
 let cursor=0;
 async function worker(){
   while(true){const i=cursor++;if(i>=targets.length)return;const x=targets[i];
     try{const r=await callCoordinateResolver(x);await saveResolvedPlace(x,r);ok++;update('✓ '+x.name)}
     catch(e){fail++;failed.push({id:x.id,name:x.name,error:e.message||String(e)});update('✕ '+x.name)}
   }
 }
 await Promise.all([worker(),worker(),worker()]);
 await loadCloudPlaces();renderAll();if(places.some(validGeo))fitAll();
 const failedHtml=failed.slice(0,30).map(f=>`<li><b>${esc(f.name)}</b><small>${esc(f.error)}</small></li>`).join('');
 $('modalCard').innerHTML=`<div class="modal-head"><h2>✅ Hoàn tất tọa độ V6.2</h2><button onclick="closeModal()">×</button></div><div class="geo-result"><div class="result-cards"><div><b>${ok}</b><span>Thành công</span></div><div><b>${fail}</b><span>Chưa xử lý</span></div><div><b>${places.filter(validGeo).length}</b><span>Marker hiện có</span></div></div><p>Những cơ sở lấy được tọa độ đã được lưu lên Supabase và sẽ tự xuất hiện thành marker trên mọi thiết bị.</p>${failed.length?`<details><summary>Xem ${failed.length} mục chưa xử lý</summary><ul class="failed-list">${failedHtml}</ul></details>`:''}<button class="primary install-full" onclick="closeModal();fitAll()">🗺️ Xem toàn bộ marker</button></div>`;
}

function directionUrl(x){const dest=validGeo(x)?`${x.lat},${x.lng}`:[x.name,x.wardBlock,'Thủy Nguyên Hải Phòng'].filter(Boolean).join(', ');return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving&dir_action=navigate`}
function openExactMap(id){const x=places.find(p=>String(p.id)===String(id));if(!x)return;window.open(x.mapsUrl||directionUrl(x),'_blank','noopener')} 
function googleImageUrl(x){const q=[x.name,x.wardBlock,'Thủy Nguyên Hải Phòng'].filter(Boolean).join(' ');return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`}
function streetViewUrl(x){return validGeo(x)?`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${x.lat},${x.lng}`:x.mapsUrl||directionUrl(x)}
async function sharePlace(id){const x=places.find(p=>String(p.id)===String(id));if(!x)return;const url=x.mapsUrl||directionUrl(x),text=[x.name,x.wardBlock].filter(Boolean).join(' · ');try{if(navigator.share)await navigator.share({title:x.name,text,url});else{await navigator.clipboard.writeText(url);toast('Đã sao chép link vị trí.')}}catch(e){}}
function locateMe(){if(!navigator.geolocation)return toast('Thiết bị không hỗ trợ định vị.');toast('Đang lấy vị trí hiện tại…');navigator.geolocation.getCurrentPosition(pos=>{const {latitude,longitude}=pos.coords;map.setView([latitude,longitude],16);if(window.__meMarker)map.removeLayer(window.__meMarker);window.__meMarker=L.circleMarker([latitude,longitude],{radius:9,weight:3,fillOpacity:.9}).addTo(map).bindPopup('Vị trí hiện tại của bạn').openPopup();if(innerWidth<=760)showMobileTab('map')},()=>toast('Không lấy được vị trí. Hãy bật quyền Vị trí cho ứng dụng.'),{enableHighAccuracy:true,timeout:10000,maximumAge:30000})}
function showMobileTab(tab){document.body.dataset.mobiletab=tab;setTimeout(()=>map&&map.invalidateSize(),120)}
function isIos(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true}
function installPwa(){if(isStandalone())return toast('Ứng dụng đã được cài trên màn hình chính.');if(window.__deferredPrompt){window.__deferredPrompt.prompt();window.__deferredPrompt.userChoice.finally(()=>window.__deferredPrompt=null);return}openInstallHelp()}
function openInstallHelp(){const ios=isIos();$('modalCard').innerHTML=`<div class="modal-head"><h2>📱 Cài ứng dụng trên điện thoại</h2><button onclick="closeModal()">×</button></div><div class="install-help"><div class="install-logo"><img src="icons/icon-192.png"><div><b>Bản đồ số Thủy Nguyên</b><span>Mobile V6.2 · Cloud Sync + Auto GPS</span></div></div>${ios?`<ol><li>Mở địa chỉ ứng dụng bằng <b>Safari</b>.</li><li>Nhấn nút <b>Chia sẻ</b>.</li><li>Chọn <b>Thêm vào Màn hình chính</b>.</li><li>Nhấn <b>Thêm</b>.</li></ol>`:`<ol><li>Mở ứng dụng bằng Chrome/Edge.</li><li>Nhấn <b>Cài đặt ứng dụng</b> hoặc <b>Add to Home screen</b>.</li><li>Xác nhận cài đặt.</li></ol>`}<div class="install-note"><b>V6.2:</b> Khi cấu hình Supabase, mọi thiết bị đăng nhập sẽ dùng chung dữ liệu và ảnh.</div><button class="primary install-full" onclick="closeModal()">Đã hiểu</button></div>`;$('modal').classList.remove('hidden')}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.__deferredPrompt=e});
if('serviceWorker' in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
function closeModal(){$('modal').classList.add('hidden');$('modalCard').innerHTML=''}
function modalBackdrop(e){if(e.target.id==='modal')closeModal()}
function toast(t){const e=$('toast');e.textContent=t;e.style.display='block';clearTimeout(window.__toast);window.__toast=setTimeout(()=>e.style.display='none',3000)}
function $(id){return document.getElementById(id)}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function escAttr(v){return esc(v).replace(/`/g,'&#096;')}
function escJs(v){return String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ')}

async function boot(){
 initCloud();
 if(cloudEnabled){
   $('loginHint').textContent='Cloud: đăng nhập bằng email Supabase · Demo cục bộ: admin / admin123';
   const {data}=await supabaseClient.auth.getSession();
   if(data.session){const role=await getCloudRole(data.session.user.id);currentUser={name:data.session.user.email,role,cloud:true,id:data.session.user.id};enterApp();return;}
 }
 const u=sessionStorage.getItem('demo_user');if(u&&demoAuth[u]){currentUser={name:u,role:demoAuth[u].role,cloud:false};enterApp()}
}
window.addEventListener('load',boot);
