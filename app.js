let places=[], map, markers=[], markerCluster=null, currentUser=null, selectedId=null, supabaseClient=null, realtimeChannel=null, baseLayers={}, currentBase='street', tileFailures=0;
const defaultCenter=[20.96,106.69];
const STORE='thuynguyen_places_v68';
const SEARCH_FIELDS=['name','category','wardBlock','officer','ownerName','ownerPhone','managerName','managerPhone','managerAddress','scale','legal','status'];
const demoAuth={admin:{pass:'admin123',role:'admin'},user:{pass:'user123',role:'user'}};
const cfg=window.APP_CONFIG||{};
const cloudEnabled=!!(cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&window.supabase?.createClient);


/* ===== V6.8.4 CATEGORY HOTFIX =====
   Keep this helper global and declared before every editor/normalization call. */
function inferCategory(name=''){
  const n=String(name||'').toLowerCase();
  if(/khách sạn|hotel/.test(n)) return 'Khách sạn';
  if(/homestay|home stay/.test(n)) return 'Homestay';
  if(/lán/.test(n)) return 'Lán trọ';
  if(/nhà cho thuê/.test(n)) return 'Nhà cho thuê';
  if(/nhà trọ|\btrọ\b/.test(n)) return 'Nhà trọ';
  return 'Cơ sở lưu trú khác';
}
window.inferCategory=inferCategory;

function initCloud(){
  if(!cloudEnabled)return;
  supabaseClient=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}
async function init(){
  map=L.map('map',{zoomControl:false,preferCanvas:true}).setView(defaultCenter,12);
  const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap',crossOrigin:true});
  const esriStreet=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,attribution:'Tiles © Esri',crossOrigin:true});
  const imagery=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,attribution:'Imagery © Esri',crossOrigin:true});
  const labels=L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,pane:'overlayPane',crossOrigin:true});
  baseLayers.street=esriStreet; baseLayers.osm=osm; baseLayers.satellite=imagery; baseLayers.hybrid=L.layerGroup([imagery,labels]);
  [osm,esriStreet,imagery,labels].forEach(layer=>layer.on('tileerror',()=>{tileFailures++; if(tileFailures===10) autoFallbackMap();}));
  baseLayers.street.addTo(map); L.control.zoom({position:'bottomright'}).addTo(map); L.control.scale({position:'bottomleft',imperial:false,maxWidth:130}).addTo(map);
  markerCluster=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:48,spiderfyOnMaxZoom:true,disableClusteringAtZoom:17}); map.addLayer(markerCluster);
  L.control.layers({'Chi tiết đường phố':baseLayers.street,'OpenStreetMap':baseLayers.osm,'Vệ tinh':baseLayers.satellite,'Vệ tinh + nhãn':baseLayers.hybrid},null,{position:'bottomright',collapsed:true}).addTo(map);
  map.on('zoomend',()=>renderMarkers());
  if(cloudEnabled&&currentUser?.cloud){await loadCloudPlaces();subscribeRealtime();}
  else loadLocalPlaces();
  renderAll();
  updateCloudBadge();
}
function loadLocalPlaces(){
  const saved=localStorage.getItem(STORE)||localStorage.getItem('thuynguyen_places_v4');
  if(saved){try{places=JSON.parse(saved)}catch(e){places=[]}}
  if(!places.length)places=JSON.parse(JSON.stringify(window.INITIAL_PLACES||[]));
  normalizePlaces();
}
async function loadCloudPlaces(){
  const {data,error}=await supabaseClient.from('places').select('id,data').order('updated_at',{ascending:false});
  if(error){toast('Không tải được dữ liệu cloud: '+error.message);loadLocalPlaces();return;}
  places=(data||[]).map(r=>({...r.data,id:r.id}));
  if(!places.length)places=JSON.parse(JSON.stringify(window.INITIAL_PLACES||[]));
  normalizePlaces();
}
function subscribeRealtime(){
  if(!supabaseClient)return;
  if(realtimeChannel)supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel=supabaseClient.channel('places-live').on('postgres_changes',{event:'*',schema:'public',table:'places'},async()=>{await loadCloudPlaces();renderAll();toast('Dữ liệu vừa được đồng bộ từ máy khác.');}).subscribe();
}
function normalizePlaces(){places=places.map((x,i)=>{let lat=numOrNull(x.lat),lng=numOrNull(x.lng);if((lat===null||lng===null)&&x.mapsUrl){const m=String(x.mapsUrl).match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)||String(x.mapsUrl).match(/[?&](?:query|destination)=(-?\d+(?:\.\d+)?)(?:%2C|,)(-?\d+(?:\.\d+)?)/i);if(m){lat=Number(m[1]);lng=Number(m[2])}}return {...x,id:String(x.id??Date.now()+i),images:Array.isArray(x.images)?x.images:[],category:x.category||inferCategory(x.name),lat,lng}})
/* inferCategory is defined globally near the top (V6.8.4). */}
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
function updateCloudBadge(){const e=$('cloudStatus');if(!e)return;e.textContent=currentUser?.cloud?'☁ ONLINE':'◉ LOCAL';e.title=currentUser?.cloud?'Đang đồng bộ Supabase':'Đang dùng dữ liệu trên thiết bị'}

function normSearch(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function filtered(){
 const q=normSearch($('search')?.value||''),st=$('statusFilter')?.value||'',field=$('searchField')?.value||'all';
 return places.filter(x=>{const active=isActive(x.status);if(st&&(st==='active'?!active:active))return false;if(!q)return true;const hay=field==='all'?SEARCH_FIELDS.map(k=>x[k]).join(' '):x[field];return normSearch(hay).includes(q)});
}
function isActive(s=''){return !/không hoạt động|ngừng|thu hồi|đóng cửa/i.test(s)}
function renderAll(){renderStats();renderList();renderMarkers()}
function renderStats(){const visible=filtered(),active=visible.filter(x=>isActive(x.status)).length,geo=visible.filter(validGeo).length;$('stats').innerHTML=`<div><b>${visible.length}</b><span>Cơ sở</span></div><div><b>${active}</b><span>Hoạt động</span></div><div><b>${geo}</b><span>Có tọa độ</span></div>`}
let listQuery='';
function setListQuery(v){listQuery=normSearch(v);renderList()}
function renderList(){
 const base=filtered();
 const arr=listQuery?base.filter(x=>normSearch([x.name,x.wardBlock,x.ownerName,x.managerName,x.officer,x.ownerPhone,x.managerPhone].join(' ')).includes(listQuery)):base;
 const list=$('list');
 const search=`<div class="list-search"><span>🔎</span><input value="${escAttr(listQuery)}" placeholder="Tìm nhanh trong danh sách…" oninput="setListQuery(this.value)"><button onclick="setListQuery('')">×</button></div><div class="list-count">${arr.length} / ${base.length} cơ sở</div>`;
 const rows=arr.length?arr.map(x=>`<div class="item ${selectedId===x.id?'selected':''}" onclick="openListPlace('${escJs(x.id)}')"><div class="item-head"><b>${esc(x.name)}</b><span class="dot ${isActive(x.status)?'on':'off'}"></span></div><small>${esc(x.wardBlock||'Chưa có TDP')} · ${esc(x.officer||'Chưa phân công')}</small><span class="badge ${isActive(x.status)?'':'off'}">${esc(x.status||'Chưa rõ')}</span></div>`).join(''):`<div class="empty">Không có kết quả phù hợp.</div>`;
 list.innerHTML=search+rows;
}
function openListPlace(id){const x=places.find(p=>String(p.id)===String(id));if(!x)return;selectedId=x.id;renderList();showDetail(x);if(innerWidth<=760)document.body.dataset.mobiletab='list'}
function markerIcon(active,name,selected=false){const show=map&&map.getZoom()>=16;const cls=selected?' selected':'';return L.divIcon({className:'pin-wrap',html:`<div class="v63-marker${cls}"><span class="map-pin ${active?'on':'off'}"><i>⌂</i></span>${show?`<b>${esc(name)}</b>`:''}</div>`,iconSize:[show?210:38,48],iconAnchor:[19,43]})}
function renderMarkers(){if(!map)return;if(markerCluster)markerCluster.clearLayers();markers=[];filtered().forEach(x=>{if(validGeo(x)){const m=L.marker([x.lat,x.lng],{icon:markerIcon(isActive(x.status),x.name,String(selectedId)===String(x.id)),riseOnHover:true,title:x.name});m.bindTooltip(`<div class="map-tip"><b>${esc(x.name)}</b><span>${esc(x.category||'Cơ sở')}</span><small>${esc(x.wardBlock||'Chưa có TDP')}</small></div>`,{direction:'top',offset:[0,-34],opacity:.98});m.on('click',()=>{selectedId=x.id;renderMarkers();showDetail(x)});if(markerCluster)markerCluster.addLayer(m);else m.addTo(map);markers.push(m)}});updateMapNotice()}
function updateMapNotice(){const e=$('mapNotice');if(!e)return;const total=filtered().length,geo=filtered().filter(validGeo).length;e.innerHTML=geo?`<b>${geo}</b> điểm đang hiển thị trên bản đồ${geo<total?` · <b>${total-geo}</b> điểm chưa có tọa độ`:''}`:`<b>Chưa có điểm nào có tọa độ.</b> Dữ liệu hiện có ${total} cơ sở nhưng link Google Maps rút gọn chưa cung cấp lat/lng.`;e.classList.toggle('warn',geo<total)}
function setBaseMap(name){if(!map||!baseLayers[name])return;Object.values(baseLayers).forEach(l=>{try{if(map.hasLayer(l))map.removeLayer(l)}catch(e){}});currentBase=name;tileFailures=0;baseLayers[name].addTo(map);toast(name==='hybrid'?'Vệ tinh + tên đường':name==='satellite'?'Ảnh vệ tinh':name==='osm'?'OpenStreetMap':'Bản đồ đường phố chi tiết')}
function toggleBaseMap(){setBaseMap(currentBase==='hybrid'?'street':'hybrid')}
function openMapLayers(){$('modalCard').innerHTML=`<button class="close" onclick="closeModal()">×</button><h2>Kiểu bản đồ</h2><p class="overview-note">Chọn lớp nền phù hợp. “Vệ tinh + nhãn” giúp đối chiếu vị trí với thực địa rõ nhất.</p><div class="map-layer-grid"><button onclick="setBaseMap('street');closeModal()"><strong>🗺️ Đường phố chi tiết</strong><small>Rõ đường, khu dân cư và địa danh</small></button><button onclick="setBaseMap('hybrid');closeModal()"><strong>🛰️ Vệ tinh + nhãn</strong><small>Ảnh thực tế kèm tên địa danh</small></button><button onclick="setBaseMap('satellite');closeModal()"><strong>🌍 Vệ tinh</strong><small>Ảnh nền thực địa sạch</small></button><button onclick="setBaseMap('osm');closeModal()"><strong>▦ OpenStreetMap</strong><small>Lớp bản đồ dự phòng</small></button></div>`;$('modal').classList.remove('hidden')}
function autoFallbackMap(){if(currentBase==='street'){setBaseMap('osm');toast('Nguồn bản đồ chi tiết tải chậm — đã chuyển dự phòng.')}else if(currentBase==='osm'){setBaseMap('satellite');toast('Đã thử chuyển sang ảnh vệ tinh.')}}
function showUnlocated(){const arr=filtered().filter(x=>!validGeo(x));if(!arr.length)return toast('Tất cả điểm đã có tọa độ.');showMobileTab('list');toast(`${arr.length} cơ sở chưa có tọa độ. Mở từng cơ sở > Sửa để đặt vị trí.`)}
function validGeo(x){return Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lng))&&Number(x.lat)!==0&&Number(x.lng)!==0}
function fitAll(){const pts=filtered().filter(validGeo).map(x=>[x.lat,x.lng]);if(pts.length)map.fitBounds(pts,{padding:[40,40],maxZoom:16});else toast('Chưa có cơ sở nào có tọa độ.')}
function focusPlace(id){const x=places.find(p=>String(p.id)===String(id));if(!x)return;selectedId=x.id;renderList();if(validGeo(x))map.flyTo([x.lat,x.lng],18,{duration:.7});showDetail(x)}
function showDetail(x){
 selectedId=x.id;renderList();const d=$('detail');d.classList.remove('hidden');const imgs=(x.images||[]).slice(0,8).map(src=>`<img src="${escAttr(src)}" alt="Ảnh cơ sở" loading="lazy">`).join('');
 d.innerHTML=`<button class="close" onclick="dclose()">×</button><div class="detail-title"><h2>${esc(x.name)}</h2><span class="badge ${isActive(x.status)?'':'off'}">${esc(x.status||'Chưa rõ')}</span></div>${imgs?`<div class="gallery">${imgs}</div>`:''}${row('TDP / khu vực',x.wardBlock)}${row('Chủ cơ sở',x.ownerName)}${row('Số điện thoại',phoneLink(x.ownerPhone))}${row('Người quản lý',x.managerName)}${row('SĐT quản lý',phoneLink(x.managerPhone))}${row('Địa chỉ quản lý',x.managerAddress)}${row('Cán bộ phụ trách',x.officer)}${row('Quy mô',x.scale)}${row('Pháp lý',x.legal)}${row('Tọa độ',validGeo(x)?`${x.lat}, ${x.lng}`:'Chưa có')}<div class="actions mobile-actions"><a class="route-a" href="${escAttr(directionUrl(x))}" target="_blank" rel="noopener">🧭 Chỉ đường</a>${x.mapsUrl?`<a href="${escAttr(x.mapsUrl)}" target="_blank" rel="noopener">📍 Google Maps</a>`:''}<a class="secondary-a" href="${escAttr(googleImageUrl(x))}" target="_blank" rel="noopener">🖼️ Ảnh Google</a>${validGeo(x)?`<a class="secondary-a" href="${escAttr(streetViewUrl(x))}" target="_blank" rel="noopener">👁 Street View</a>`:''}<button class="secondary" onclick="sharePlace('${escJs(x.id)}')">↗️ Chia sẻ</button>${x.lodgerListUrl?`<a class="secondary-a" href="${escAttr(x.lodgerListUrl)}" target="_blank" rel="noopener">📋 Danh sách</a>`:''}<button class="direct-edit admin-only" onclick="openEditor('${escJs(x.id)}')">✏️ Chỉnh sửa trực tiếp</button></div>`;
}
function row(a,b){return `<div class="row"><label>${esc(a)}</label><div>${b&&String(b).startsWith('<a ')?b:esc(b||'—')}</div></div>`}
function phoneLink(v){if(!v)return '—';const p=String(v).replace(/\D/g,'');return `<a class="phone" href="tel:${p}">${esc(formatPhone(v))}</a>`}
function formatPhone(v){let s=String(v).trim();if(/^\d{9}$/.test(s))s='0'+s;return s}
function dclose(){selectedId=null;$('detail').classList.add('hidden');renderList()}

function openEditor(id=null){
 if(!currentUser||String(currentUser.role||'').toLowerCase()!=='admin')return toast('Bạn cần đăng nhập ADMIN để thêm/sửa cơ sở.');
 const x=id!==null?places.find(p=>String(p.id)===String(id)):null;
 const p=x?JSON.parse(JSON.stringify(x)):{id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name:'',mapsUrl:'',lodgerListUrl:'',ownerName:'',ownerPhone:'',wardBlock:'',managerName:'',managerPhone:'',managerAddress:'',officer:'',scale:'',legal:'',status:'Vẫn Hoạt động',lat:null,lng:null,images:[]};
 $('modalCard').innerHTML=`<div class="modal-head"><h2>${x?'Sửa cơ sở':'Thêm cơ sở'}</h2><button onclick="closeModal()">×</button></div><form id="placeForm" onsubmit="savePlace(event,'${escJs(p.id)}')"><div class="form-grid">${field('Tên cơ sở','f_name',p.name,true)}${field('Loại cơ sở','f_category',p.category||inferCategory(p.name))}${field('TDP / khu vực','f_wardBlock',p.wardBlock)}${field('Chủ cơ sở','f_ownerName',p.ownerName)}${field('SĐT chủ cơ sở','f_ownerPhone',p.ownerPhone,'','tel')}${field('Người quản lý','f_managerName',p.managerName)}${field('SĐT quản lý','f_managerPhone',p.managerPhone,'','tel')}${field('Địa chỉ quản lý','f_managerAddress',p.managerAddress,false,'text','wide')}${field('Cán bộ phụ trách','f_officer',p.officer)}${field('Quy mô','f_scale',p.scale)}${field('Tình trạng','f_status',p.status)}${field('Pháp lý','f_legal',p.legal,false,'text','wide')}${field('Link Google Maps','f_mapsUrl',p.mapsUrl,false,'url','wide')}${field('Link danh sách lưu trú','f_lodgerListUrl',p.lodgerListUrl,false,'url','wide')}${field('Vĩ độ (lat)','f_lat',p.lat??'',false,'number')}${field('Kinh độ (lng)','f_lng',p.lng??'',false,'number')}</div><div class="coord-tools"><button type="button" onclick="coordsFromLink()">📌 Tách tọa độ từ link</button><button type="button" onclick="pickMapCenter()">🎯 Lấy tâm bản đồ hiện tại</button></div><div class="image-editor"><label>Ảnh cơ sở <small>${currentUser.cloud?'(sẽ tải lên cloud khi lưu)':'(lưu trên thiết bị)'}</small></label><input id="f_images" type="file" accept="image/*" multiple onchange="previewImages(event)"><div id="imagePreview" class="gallery edit-gallery">${(p.images||[]).map(src=>`<div class="img-box" data-existing="1"><img src="${escAttr(src)}"><button type="button" onclick="this.parentElement.remove()">×</button></div>`).join('')}</div></div><div class="form-actions">${x?`<button type="button" class="danger" onclick="deletePlace('${escJs(p.id)}')">Xóa</button>`:''}<span></span><button type="button" class="ghost" onclick="closeModal()">Hủy</button><button class="primary" type="submit">Lưu</button></div></form>`;
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
   const obj={...(old||{}),id:String(id),name:$('f_name').value.trim(),category:$('f_category').value.trim()||inferCategory($('f_name').value),wardBlock:$('f_wardBlock').value.trim(),ownerName:$('f_ownerName').value.trim(),ownerPhone:$('f_ownerPhone').value.trim(),managerName:$('f_managerName').value.trim(),managerPhone:$('f_managerPhone').value.trim(),managerAddress:$('f_managerAddress').value.trim(),officer:$('f_officer').value.trim(),scale:$('f_scale').value.trim(),status:$('f_status').value.trim(),legal:$('f_legal').value.trim(),mapsUrl:$('f_mapsUrl').value.trim(),lodgerListUrl:$('f_lodgerListUrl').value.trim(),lat:numOrNull($('f_lat').value),lng:numOrNull($('f_lng').value),images};
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


function countBy(key,arr=places){const m=new Map();arr.forEach(x=>{const v=String(x[key]||'Chưa xác định').trim()||'Chưa xác định';m.set(v,(m.get(v)||0)+1)});return [...m.entries()].sort((a,b)=>b[1]-a[1])}
function chartColors(n){const base=['#1976d2','#26a69a','#ffb300','#ef5350','#7e57c2','#42a5f5','#66bb6a','#ffa726','#8d6e63','#78909c','#ec407a','#5c6bc0'];return Array.from({length:n},(_,i)=>base[i%base.length])}
function pieCanvas(id,title,rows){return `<div class="overview-card"><h3>${esc(title)}</h3><div class="chart-wrap"><canvas id="${id}"></canvas></div><div class="chart-summary">${rows.map(([n,v])=>`<span><b>${v}</b> ${esc(n)}</span>`).join('')}</div></div>`}
function openOverview(){
 const arr=filtered(),byType=countBy('category',arr),byTdp=countBy('wardBlock',arr),byOfficer=countBy('officer',arr),active=arr.filter(x=>isActive(x.status)).length;
 $('modalCard').innerHTML=`<div class="modal-head"><h2>📊 Tổng quan cơ sở</h2><button onclick="closeModal()">×</button></div><div class="overview-kpis"><div><b>${arr.length}</b><span>Tổng cơ sở</span></div><div><b>${active}</b><span>Đang hoạt động</span></div><div><b>${byType.length}</b><span>Loại cơ sở</span></div><div><b>${byTdp.length}</b><span>Tổ dân phố</span></div><div><b>${byOfficer.length}</b><span>Cán bộ phụ trách</span></div></div><p class="overview-note">Số liệu tổng quan theo bộ lọc/tìm kiếm đang áp dụng.</p><div class="overview-grid">${pieCanvas('chartType','Theo loại cơ sở',byType)}${pieCanvas('chartTdp','Theo tổ dân phố',byTdp)}${pieCanvas('chartOfficer','Theo cán bộ phụ trách',byOfficer)}</div>`;
 $('modal').classList.remove('hidden');requestAnimationFrame(()=>{makePie('chartType',byType);makePie('chartTdp',byTdp);makePie('chartOfficer',byOfficer)});
}
function makePie(id,rows){const el=$(id);if(!el||!window.Chart)return;new Chart(el,{type:'doughnut',data:{labels:rows.map(r=>r[0]),datasets:[{data:rows.map(r=>r[1]),backgroundColor:chartColors(rows.length),borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'48%',plugins:{legend:{position:'bottom',labels:{boxWidth:11,usePointStyle:true,font:{size:10}}},tooltip:{callbacks:{label:c=>`${c.label}: ${c.raw} cơ sở`}}}}})}

function openDataMenu(){
 if(currentUser.role!=='admin')return;
 $('modalCard').innerHTML=`<div class="modal-head"><h2>Dữ liệu & đồng bộ</h2><button onclick="closeModal()">×</button></div><div class="data-menu"><p>${currentUser.cloud?'Bạn đang dùng dữ liệu cloud. Thay đổi sẽ đồng bộ giữa các thiết bị đã đăng nhập.':'Bạn đang ở chế độ LOCAL. Dữ liệu chỉ nằm trên thiết bị này.'}</p>${currentUser.cloud?`<button onclick="seedCloud()">☁️ Đưa dữ liệu gốc lên cloud</button><button onclick="refreshCloud()">↻ Đồng bộ lại từ cloud</button>`:''}<button onclick="exportJson()">⬇️ Xuất dữ liệu JSON</button>${!currentUser.cloud?`<button onclick="$('importFile').click();closeModal()">⬆️ Nhập dữ liệu JSON</button><button class="danger" onclick="resetData()">↺ Khôi phục dữ liệu gốc</button>`:''}</div>`;$('modal').classList.remove('hidden')
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
async function resetData(){if(!confirm('Khôi phục dữ liệu gốc sẽ xóa các thay đổi cục bộ. Tiếp tục?'))return;localStorage.removeItem(STORE);places=JSON.parse(JSON.stringify(window.INITIAL_PLACES||[]));normalizePlaces();closeModal();dclose();renderAll();toast('Đã khôi phục dữ liệu gốc.')}

function directionUrl(x){const dest=validGeo(x)?`${x.lat},${x.lng}`:[x.name,x.wardBlock,'Thủy Nguyên Hải Phòng'].filter(Boolean).join(', ');return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`}
function googleImageUrl(x){const q=[x.name,x.wardBlock,'Thủy Nguyên Hải Phòng'].filter(Boolean).join(' ');return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`}
function streetViewUrl(x){return validGeo(x)?`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${x.lat},${x.lng}`:x.mapsUrl||directionUrl(x)}
async function sharePlace(id){const x=places.find(p=>String(p.id)===String(id));if(!x)return;const url=x.mapsUrl||directionUrl(x),text=[x.name,x.wardBlock].filter(Boolean).join(' · ');try{if(navigator.share)await navigator.share({title:x.name,text,url});else{await navigator.clipboard.writeText(url);toast('Đã sao chép link vị trí.')}}catch(e){}}
function locateMe(){if(!navigator.geolocation)return toast('Thiết bị không hỗ trợ định vị.');toast('Đang lấy vị trí hiện tại…');navigator.geolocation.getCurrentPosition(pos=>{const {latitude,longitude}=pos.coords;map.setView([latitude,longitude],16);if(window.__meMarker)map.removeLayer(window.__meMarker);window.__meMarker=L.circleMarker([latitude,longitude],{radius:9,weight:3,fillOpacity:.9}).addTo(map).bindPopup('Vị trí hiện tại của bạn').openPopup();if(innerWidth<=760)showMobileTab('map')},()=>toast('Không lấy được vị trí. Hãy bật quyền Vị trí cho ứng dụng.'),{enableHighAccuracy:true,timeout:10000,maximumAge:30000})}
function showMobileTab(tab){document.body.dataset.mobiletab=tab;setTimeout(()=>map&&map.invalidateSize(),120)}
function isIos(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true}
function installPwa(){if(isStandalone())return toast('Ứng dụng đã được cài trên màn hình chính.');if(window.__deferredPrompt){window.__deferredPrompt.prompt();window.__deferredPrompt.userChoice.finally(()=>window.__deferredPrompt=null);return}openInstallHelp()}
function openInstallHelp(){const ios=isIos();$('modalCard').innerHTML=`<div class="modal-head"><h2>📱 Cài ứng dụng trên điện thoại</h2><button onclick="closeModal()">×</button></div><div class="install-help"><div class="install-logo"><img src="icons/icon-192.png"><div><b>Bản đồ số Thủy Nguyên</b><span>Mobile V6 · Map Upgrade</span></div></div>${ios?`<ol><li>Mở địa chỉ ứng dụng bằng <b>Safari</b>.</li><li>Nhấn nút <b>Chia sẻ</b>.</li><li>Chọn <b>Thêm vào Màn hình chính</b>.</li><li>Nhấn <b>Thêm</b>.</li></ol>`:`<ol><li>Mở ứng dụng bằng Chrome/Edge.</li><li>Nhấn <b>Cài đặt ứng dụng</b> hoặc <b>Add to Home screen</b>.</li><li>Xác nhận cài đặt.</li></ol>`}<div class="install-note"><b>V6:</b> Khi cấu hình Supabase, mọi thiết bị đăng nhập sẽ dùng chung dữ liệu và ảnh.</div><button class="primary install-full" onclick="closeModal()">Đã hiểu</button></div>`;$('modal').classList.remove('hidden')}
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

/* ===== V6.4 REALITY MAP UPGRADE ===== */
function v64Popup(x){return `<div class="popup-title">${esc(x.name)}</div><div class="popup-meta">${esc(x.category||'Cơ sở')} · ${esc(x.wardBlock||'Chưa có TDP')}<br>${x.officer?`👮 ${esc(x.officer)}<br>`:''}${x.ownerPhone?`☎ ${esc(x.ownerPhone)}`:''}</div><div class="popup-actions"><button onclick="focusPlace('${escJs(x.id)}')">Chi tiết</button><a class="go" target="_blank" rel="noopener" href="${escAttr(directionUrl(x))}">🧭 Chỉ đường</a></div>`}
function v64Icon(x){const show=map&&map.getZoom()>=16;const active=isActive(x.status);const sel=String(selectedId)===String(x.id);return L.divIcon({className:'',html:`<div class="v64-marker ${active?'on':'off'} ${sel?'selected':''}"><span class="dot"><i>⌂</i></span>${show?`<span class="v64-label">${esc(x.name)}</span>`:''}</div>`,iconSize:[show?205:38,42],iconAnchor:[16,38],popupAnchor:[0,-35]})}
const _v63RenderMarkers=renderMarkers;
renderMarkers=function(){if(!map)return;if(markerCluster)markerCluster.clearLayers();markers=[];const rows=filtered();rows.forEach(x=>{if(validGeo(x)){const m=L.marker([Number(x.lat),Number(x.lng)],{icon:v64Icon(x),riseOnHover:true,title:x.name});m.bindPopup(v64Popup(x),{maxWidth:290});m.bindTooltip(esc(x.name),{direction:'top',offset:[0,-34]});m.on('click',()=>{selectedId=x.id;renderList()});markerCluster?markerCluster.addLayer(m):m.addTo(map);markers.push(m)}});updateMapNotice();v64Accuracy()}
function v64Accuracy(){const e=document.getElementById('mapAccuracy');if(!e)return;const total=filtered().length,geo=filtered().filter(validGeo).length;e.textContent=`📍 ${geo}/${total} điểm có tọa độ`}
let v64Picking=false,v64Cross=null,v64Bar=null;
function startPinPicker(){if(!map)return;closeModal();v64Picking=true;if(innerWidth<=760)showMobileTab('map');v64Cross=document.createElement('div');v64Cross.className='pin-crosshair';v64Cross.textContent='📍';document.querySelector('main').appendChild(v64Cross);v64Bar=document.createElement('div');v64Bar.className='pin-savebar';v64Bar.innerHTML='<button onclick="cancelPinPicker()">Hủy</button><button class="save" onclick="savePickedCenter()">✓ Chọn vị trí này</button>';document.querySelector('main').appendChild(v64Bar);toast('Di chuyển bản đồ để ghim nằm đúng vị trí cơ sở.')}
function cancelPinPicker(){v64Picking=false;v64Cross?.remove();v64Bar?.remove();v64Cross=v64Bar=null}
function savePickedCenter(){const c=map.getCenter();sessionStorage.setItem('v64picked',JSON.stringify({lat:c.lat,lng:c.lng}));cancelPinPicker();toast(`Đã chọn ${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}. Mở lại biểu mẫu để lưu.`)}
const _v64OpenEditor=openEditor;
openEditor=function(id){_v64OpenEditor(id);setTimeout(()=>{const tools=document.querySelector('.coord-tools');if(tools&&!document.getElementById('v64pickbtn')){const b=document.createElement('button');b.type='button';b.id='v64pickbtn';b.className='pick';b.textContent='🗺️ Chọn điểm trực tiếp trên bản đồ';b.onclick=startPinPicker;tools.appendChild(b)}const raw=sessionStorage.getItem('v64picked');if(raw){try{const c=JSON.parse(raw);if(document.getElementById('f_lat')){document.getElementById('f_lat').value=c.lat.toFixed(6);document.getElementById('f_lng').value=c.lng.toFixed(6);sessionStorage.removeItem('v64picked')}}catch(e){}}},30)}
function showUnlocated(){const rows=filtered().filter(x=>!validGeo(x));if(!rows.length)return toast('Tất cả cơ sở đang lọc đều đã có tọa độ.');const c=document.getElementById('modalCard');c.innerHTML=`<div class="modal-head"><h2>📍 Cơ sở chưa có tọa độ (${rows.length})</h2><button onclick="closeModal()">×</button></div><p>Chọn một cơ sở rồi dùng <b>Chọn điểm trực tiếp trên bản đồ</b> để đặt đúng vị trí thực tế.</p><div class="unlocated-list">${rows.slice(0,100).map(x=>`<button onclick="closeModal();openEditor('${escJs(x.id)}')"><b>${esc(x.name)}</b><small>${esc(x.wardBlock||'Chưa có TDP')}</small></button>`).join('')}</div>`;document.getElementById('modal').classList.remove('hidden')}
setTimeout(()=>{if(map){map.on('zoomend',()=>renderMarkers());v64Accuracy()}},800);

/* ===== V6.5 FIELD MAPPING WORKFLOW ===== */
let v65Queue=[],v65QueueIndex=0;
function openGeoManager(){
 const rows=filtered(), geo=rows.filter(validGeo).length, missing=rows.length-geo;
 $('modalCard').innerHTML=`<div class="modal-head"><h2>🧭 Quản lý vị trí V6.5</h2><button onclick="closeModal()">×</button></div>
 <div class="geo-summary"><div><b>${rows.length}</b><span>Tổng cơ sở</span></div><div><b>${geo}</b><span>Đã có vị trí</span></div><div><b>${missing}</b><span>Chưa định vị</span></div></div>
 <p class="overview-note">Chế độ thực địa giúp đặt tọa độ liên tục. Sau khi lưu một điểm, ứng dụng tự chuyển sang cơ sở tiếp theo.</p>
 <div class="geo-actions"><button class="primary" onclick="startGeoQueue()">📍 Bắt đầu định vị ${missing} điểm</button><button onclick="fitAll();closeModal()">🗺️ Xem toàn bộ điểm</button></div>
 <div class="unlocated-list">${rows.filter(x=>!validGeo(x)).slice(0,120).map(x=>`<button onclick="closeModal();focusPlace('${escJs(x.id)}');openEditor('${escJs(x.id)}')"><b>${esc(x.name)}</b><small>${esc(x.wardBlock||'Chưa có TDP')} · ${esc(x.officer||'Chưa phân công')}</small></button>`).join('')||'<div class="empty">Tất cả cơ sở đã có tọa độ.</div>'}</div>`;
 $('modal').classList.remove('hidden');
}
function startGeoQueue(){v65Queue=filtered().filter(x=>!validGeo(x)).map(x=>String(x.id));v65QueueIndex=0;closeModal();if(!v65Queue.length)return toast('Tất cả cơ sở đã có vị trí.');openGeoQueueItem()}
function openGeoQueueItem(){if(v65QueueIndex>=v65Queue.length){toast('Đã hoàn tất danh sách định vị.');return openGeoManager()}const id=v65Queue[v65QueueIndex],x=places.find(p=>String(p.id)===id);if(!x){v65QueueIndex++;return openGeoQueueItem()}selectedId=x.id;renderList();if(x.mapsUrl)window.open(x.mapsUrl,'_blank');openEditor(id);setTimeout(()=>{const h=document.querySelector('#modalCard h2');if(h)h.innerHTML=`📍 ${v65QueueIndex+1}/${v65Queue.length} · ${esc(x.name)}`;const tools=document.querySelector('.coord-tools');if(tools){const n=document.createElement('div');n.className='queue-help';n.innerHTML='Mở link Google Maps để đối chiếu → đưa tâm bản đồ tới đúng cơ sở → chọn <b>Chọn điểm trực tiếp trên bản đồ</b>.';tools.before(n)}},50)}
function nextGeoQueue(){v65QueueIndex++;openGeoQueueItem()}
function geoFromMyLocation(){if(!navigator.geolocation)return toast('Thiết bị không hỗ trợ GPS.');navigator.geolocation.getCurrentPosition(pos=>{const a=$('f_lat'),b=$('f_lng');if(a&&b){a.value=pos.coords.latitude.toFixed(6);b.value=pos.coords.longitude.toFixed(6);map.setView([pos.coords.latitude,pos.coords.longitude],19);toast('Đã lấy GPS hiện tại. Kiểm tra rồi bấm Lưu.')}},()=>toast('Không lấy được GPS. Hãy cấp quyền Vị trí.'),{enableHighAccuracy:true,timeout:12000})}
const _v65OpenEditor=openEditor;
openEditor=function(id){_v65OpenEditor(id);setTimeout(()=>{const tools=document.querySelector('.coord-tools');if(tools&&!document.getElementById('v65gps')){const b=document.createElement('button');b.type='button';b.id='v65gps';b.textContent='◎ Lấy GPS hiện tại';b.onclick=geoFromMyLocation;tools.appendChild(b)}},60)}
const _v65SavePlace=savePlace;
savePlace=async function(e,id){const wasQueue=v65Queue.length&&v65Queue.includes(String(id));await _v65SavePlace(e,id);if(wasQueue&&v65QueueIndex<v65Queue.length){setTimeout(()=>{if(!$('modal').classList.contains('hidden'))return;nextGeoQueue()},450)}}
function v65EnhanceToolbar(){const top=document.querySelector('.map-tools')||document.querySelector('.toolbar');if(top&&!document.getElementById('geoManagerBtn')){const b=document.createElement('button');b.id='geoManagerBtn';b.className='geo-manager-btn';b.innerHTML='🧭 <span>Định vị</span>';b.onclick=openGeoManager;top.appendChild(b)}}
setTimeout(v65EnhanceToolbar,900);

/* ===== V6.6 SMART MAP EXPERIENCE ===== */
let v66Mode='all',v66UserPos=null;
function v66QuickSearch(v){const s=$('search');if(s){s.value=v;renderAll()}const q=document.getElementById('mapQuickSearch');if(q&&q.value!==v)q.value=v}
function v66ClearSearch(){const q=$('mapQuickSearch'),s=$('search');if(q)q.value='';if(s)s.value='';renderAll()}
function v66Chip(btn,mode){v66Mode=mode;document.querySelectorAll('.v66-chips button').forEach(b=>b.classList.toggle('active',b===btn));if(mode==='active'){const f=$('statusFilter');if(f)f.value='active'}else{const f=$('statusFilter');if(f)f.value=''}renderAll()}
function v66Distance(a,b,c,d){const R=6371,to=x=>x*Math.PI/180,dy=to(c-a),dx=to(d-b),h=Math.sin(dy/2)**2+Math.cos(to(a))*Math.cos(to(c))*Math.sin(dx/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
const _v66Filtered=filtered;filtered=function(){let rows=_v66Filtered();if(v66Mode==='geo')rows=rows.filter(validGeo);if(v66Mode==='near'&&v66UserPos)rows=rows.filter(validGeo).map(x=>Object.assign({},x,{__distance:v66Distance(v66UserPos.lat,v66UserPos.lng,Number(x.lat),Number(x.lng))})).sort((a,b)=>a.__distance-b.__distance);return rows}
function v66NearMe(btn){if(!navigator.geolocation)return toast('Thiết bị không hỗ trợ định vị.');toast('Đang tìm các cơ sở gần bạn…');navigator.geolocation.getCurrentPosition(pos=>{v66UserPos={lat:pos.coords.latitude,lng:pos.coords.longitude};v66Mode='near';document.querySelectorAll('.v66-chips button').forEach(b=>b.classList.toggle('active',b===btn));const f=$('statusFilter');if(f)f.value='';map.setView([v66UserPos.lat,v66UserPos.lng],14);if(window.__meMarker)map.removeLayer(window.__meMarker);window.__meMarker=L.circleMarker([v66UserPos.lat,v66UserPos.lng],{radius:9,weight:3,fillOpacity:.9}).addTo(map).bindPopup('Vị trí hiện tại');renderAll();toast('Đã sắp xếp cơ sở theo khoảng cách.')},()=>toast('Không lấy được vị trí. Hãy bật quyền Vị trí.'),{enableHighAccuracy:true,timeout:12000,maximumAge:30000})}
const _v66RenderList=renderList;renderList=function(){const arr=filtered(),list=$('list');list.innerHTML=arr.length?arr.map(x=>`<div class="item ${selectedId===x.id?'selected':''}" onclick="focusPlace('${escJs(x.id)}')"><div class="item-head"><b>${esc(x.name)}</b><span class="dot ${isActive(x.status)?'on':'off'}"></span></div><small>${esc(x.category||'Cơ sở')} · ${esc(x.wardBlock||'Chưa có TDP')}</small><small>👮 ${esc(x.officer||'Chưa phân công')}</small>${Number.isFinite(x.__distance)?`<div class="v66-distance">⌖ ${x.__distance<1?Math.round(x.__distance*1000)+' m':x.__distance.toFixed(1)+' km'} từ bạn</div>`:''}<span class="badge ${isActive(x.status)?'':'off'}">${esc(x.status||'Chưa rõ')}</span></div>`).join(''):`<div class="empty">Không có kết quả phù hợp.</div>`}
function v66Sync(){const q=$('mapQuickSearch'),s=$('search');if(q&&s)q.value=s.value||''}
setTimeout(()=>{v66Sync();if(map){map.options.zoomSnap=.5;map.options.zoomDelta=.5}},1000);

/* ===== V6.7 AUTO GPS / BULK COORDINATE RESOLVER ===== */
let v67Resolving=false,v67Stop=false;
function v67GeoStats(){const total=places.length,geo=places.filter(validGeo).length;return {total,geo,missing:total-geo}}
function v67OpenResolver(){
 const s=v67GeoStats();
 $('modalCard').innerHTML=`<div class="modal-head"><h2>📌 Tự lấy tọa độ cơ sở</h2><button onclick="closeModal()">×</button></div><div class="v67-resolver"><div class="v67-kpis"><div><b>${s.total}</b><span>Tổng cơ sở</span></div><div><b>${s.geo}</b><span>Đã có tọa độ</span></div><div><b>${s.missing}</b><span>Chưa có</span></div></div><div class="v67-info">${currentUser?.cloud?'<b>Cloud Admin:</b> ứng dụng sẽ gọi Edge Function <code>resolve-map-link</code>, theo link Google Maps rút gọn và lưu tọa độ trở lại Supabase.':'<b>LOCAL:</b> ứng dụng chỉ có thể tách tọa độ từ URL đầy đủ. Để xử lý link <code>maps.app.goo.gl</code>, hãy cấu hình Supabase và đăng nhập Cloud Admin.'}</div><div id="v67Progress" class="v67-progress"><div><i style="width:0%"></i></div><span>Sẵn sàng</span></div><div id="v67Log" class="v67-log"></div><div class="v67-actions"><button onclick="v67ResolveDirectUrls()">⚡ Quét URL đầy đủ</button>${currentUser?.cloud?'<button class="primary" onclick="v67ResolveAll()">☁️ Lấy tọa độ các điểm còn thiếu</button>':''}<button class="danger" onclick="v67Stop=true">Dừng</button></div><p class="v67-note">Không tự đoán tọa độ. Điểm chỉ được lưu khi bộ phân giải trả về lat/lng hợp lệ.</p></div>`;
 $('modal').classList.remove('hidden');
}
function v67SetProgress(done,total,msg){const p=total?Math.round(done/total*100):0,root=$('v67Progress');if(!root)return;root.querySelector('i').style.width=p+'%';root.querySelector('span').textContent=`${done}/${total} · ${p}%${msg?' · '+msg:''}`}
function v67Log(msg,ok=true){const e=$('v67Log');if(!e)return;e.insertAdjacentHTML('afterbegin',`<div class="${ok?'ok':'bad'}">${ok?'✓':'!'} ${esc(msg)}</div>`)}
async function v67SaveResolved(x,lat,lng,finalUrl){x.lat=Number(lat);x.lng=Number(lng);if(finalUrl&&/google\./i.test(finalUrl))x.resolvedMapsUrl=finalUrl;x.coordinateSource='google-map-link';x.coordinateUpdatedAt=new Date().toISOString();if(currentUser?.cloud){const {error}=await supabaseClient.from('places').upsert({id:String(x.id),data:x,updated_at:new Date().toISOString(),updated_by:currentUser.id});if(error)throw error}else persist()}
function v67ResolveDirectUrls(){let n=0;places.forEach(x=>{if(validGeo(x)||!x.mapsUrl)return;const c=parseCoords(x.mapsUrl);if(c){x.lat=c[0];x.lng=c[1];x.coordinateSource='url';n++}});persist();renderAll();toast(n?`Đã lấy tọa độ cho ${n} cơ sở từ URL đầy đủ.`:'Không có URL đầy đủ mới chứa tọa độ.');v67OpenResolver()}
async function v67CallResolver(x){if(!supabaseClient)throw new Error('Chưa kết nối Supabase');const {data,error}=await supabaseClient.functions.invoke('resolve-map-link',{body:{url:x.mapsUrl}});if(error)throw error;if(!data?.ok||!Number.isFinite(Number(data.lat))||!Number.isFinite(Number(data.lng)))throw new Error(data?.error||'Không tìm thấy tọa độ');return data}
async function v67ResolveAll(){
 if(v67Resolving)return;if(!currentUser?.cloud||currentUser.role!=='admin')return toast('Cần đăng nhập Cloud Admin.');
 const todo=places.filter(x=>!validGeo(x)&&x.mapsUrl);if(!todo.length)return toast('Tất cả cơ sở có link đã có tọa độ.');
 if(!confirm(`Tự lấy tọa độ cho ${todo.length} cơ sở từ link Google Maps?`))return;
 v67Resolving=true;v67Stop=false;let ok=0,fail=0;v67SetProgress(0,todo.length,'Bắt đầu');
 for(let i=0;i<todo.length;i++){
   if(v67Stop){v67Log('Đã dừng theo yêu cầu.',false);break}
   const x=todo[i];try{const r=await v67CallResolver(x);await v67SaveResolved(x,r.lat,r.lng,r.finalUrl);ok++;v67Log(`${x.name} → ${Number(r.lat).toFixed(6)}, ${Number(r.lng).toFixed(6)}`)}catch(e){fail++;v67Log(`${x.name}: ${e.message||e}`,false)}
   v67SetProgress(i+1,todo.length,`Thành công ${ok} · Lỗi ${fail}`);await new Promise(r=>setTimeout(r,180));
 }
 v67Resolving=false;if(currentUser.cloud)await loadCloudPlaces();renderAll();toast(`Hoàn tất: ${ok} thành công, ${fail} chưa lấy được.`);
}
const _v67DataMenu=openDataMenu;openDataMenu=function(){_v67DataMenu();setTimeout(()=>{const m=document.querySelector('.data-menu');if(m&&!document.getElementById('v67ResolveBtn')){const b=document.createElement('button');b.id='v67ResolveBtn';b.className='primary';b.textContent='📌 Tự lấy tọa độ Google Maps';b.onclick=v67OpenResolver;m.prepend(b)}},20)};


/* ===== V6.7 AUTO COORDINATE RESOLVER ===== */
let v67ResolveRunning=false,v67ResolveStop=false;
function v67Unlocated(){return places.filter(x=>!validGeo(x)&&String(x.mapsUrl||'').trim())}
function v67ResolverReady(){return !!(currentUser?.cloud&&supabaseClient&&cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY)}
async function v67CallResolver(place){
 if(!v67ResolverReady())throw new Error('Cần đăng nhập Cloud Admin và cấu hình Supabase.');
 const {data,error}=await supabaseClient.functions.invoke('resolve-map-link',{body:{url:place.mapsUrl}});
 if(error)throw error;
 if(!data?.ok||!Number.isFinite(Number(data.lat))||!Number.isFinite(Number(data.lng)))throw new Error(data?.error||'Không tìm thấy tọa độ trong liên kết.');
 return {lat:Number(data.lat),lng:Number(data.lng),finalUrl:data.finalUrl||place.mapsUrl};
}
async function v67SaveResolved(place,res){
 const obj={...place,lat:res.lat,lng:res.lng,mapsUrl:res.finalUrl||place.mapsUrl};
 const {error}=await supabaseClient.from('places').upsert({id:String(place.id),data:obj,updated_at:new Date().toISOString(),updated_by:currentUser.id});
 if(error)throw error;
 Object.assign(place,obj);
}
function openAutoGps(){
 if(currentUser?.role!=='admin')return toast('Chỉ ADMIN được sử dụng chức năng này.');
 const todo=v67Unlocated(), geo=places.filter(validGeo).length;
 $('modalCard').innerHTML=`<div class="modal-head"><h2>📌 Tự lấy tọa độ Google Maps</h2><button onclick="closeModal()">×</button></div>
 <div class="v67-kpis"><div><b>${places.length}</b><span>Tổng cơ sở</span></div><div><b>${geo}</b><span>Đã có vị trí</span></div><div><b>${todo.length}</b><span>Cần xử lý</span></div></div>
 <div class="v67-info">V6.7 mở link Google Maps rút gọn ở phía máy chủ, đọc tọa độ đích và lưu <b>lat/lng</b> vào Supabase. Những link không giải được vẫn có thể định vị thủ công.</div>
 ${!v67ResolverReady()?`<div class="v67-warning"><b>Chưa sẵn sàng Cloud.</b><br>Hãy cấu hình <code>config.js</code>, đăng nhập Cloud Admin và triển khai Edge Function <code>resolve-map-link</code> có sẵn trong gói V6.7.</div>`:''}
 <div id="v67Progress" class="v67-progress"><div><i style="width:0%"></i></div><span>Chưa bắt đầu</span></div>
 <div id="v67Log" class="v67-log"></div>
 <div class="geo-actions"><button class="primary" ${v67ResolverReady()&&!v67ResolveRunning?'':'disabled'} onclick="v67ResolveAll()">▶ Lấy tọa độ ${todo.length} cơ sở</button><button onclick="v67ResolveStop=true">■ Dừng</button><button onclick="openGeoManager()">🧭 Định vị thủ công</button></div>`;
 $('modal').classList.remove('hidden');
}
function v67Progress(done,total,ok,fail,name,msg){
 const box=$('v67Progress'),log=$('v67Log');if(!box)return;
 const pc=total?Math.round(done*100/total):100;box.querySelector('i').style.width=pc+'%';box.querySelector('span').textContent=`${done}/${total} · Thành công ${ok} · Chưa lấy được ${fail}`;
 if(log&&name){const row=document.createElement('div');row.className=msg?'fail':'ok';row.textContent=(msg?'⚠ ':'✓ ')+name+(msg?' — '+msg:'');log.prepend(row)}
}
async function v67ResolveAll(){
 if(v67ResolveRunning)return;if(!v67ResolverReady())return openAutoGps();
 const todo=v67Unlocated();if(!todo.length)return toast('Tất cả cơ sở có link Google Maps đã có tọa độ.');
 v67ResolveRunning=true;v67ResolveStop=false;let ok=0,fail=0,done=0;v67Progress(0,todo.length,0,0);
 for(const place of todo){
  if(v67ResolveStop)break;
  try{const res=await v67CallResolver(place);await v67SaveResolved(place,res);ok++;v67Progress(++done,todo.length,ok,fail,place.name)}
  catch(e){fail++;v67Progress(++done,todo.length,ok,fail,place.name,String(e.message||e).slice(0,100))}
  await new Promise(r=>setTimeout(r,350));
 }
 v67ResolveRunning=false;renderAll();v64Accuracy();
 toast(v67ResolveStop?`Đã dừng. Lấy được ${ok} tọa độ.`:`Hoàn tất: ${ok} thành công, ${fail} chưa lấy được.`);
}
async function v67ResolveEditor(){
 const url=$('f_mapsUrl')?.value.trim();if(!url)return toast('Hãy nhập link Google Maps.');
 if(!v67ResolverReady())return toast('Cần đăng nhập Cloud Admin để tự giải link rút gọn.');
 const b=$('v67ResolveOne');if(b){b.disabled=true;b.textContent='Đang lấy…'}
 try{const res=await v67CallResolver({mapsUrl:url});$('f_lat').value=res.lat.toFixed(7);$('f_lng').value=res.lng.toFixed(7);$('f_mapsUrl').value=res.finalUrl||url;toast('Đã lấy tọa độ chính xác từ Google Maps.')}
 catch(e){toast('Chưa lấy được: '+(e.message||e))}finally{if(b){b.disabled=false;b.textContent='☁️ Tự lấy từ link rút gọn'}}
}
const _v67OpenEditor=openEditor;
openEditor=function(id=null){_v67OpenEditor(id);setTimeout(()=>{const tools=document.querySelector('.coord-tools');if(tools&&!$('v67ResolveOne')){const b=document.createElement('button');b.type='button';b.id='v67ResolveOne';b.textContent='☁️ Tự lấy từ link rút gọn';b.onclick=v67ResolveEditor;tools.prepend(b)}},30)};
const _v67OpenDataMenu=openDataMenu;
openDataMenu=function(){_v67OpenDataMenu();setTimeout(()=>{const dm=document.querySelector('.data-menu');if(dm&&!$('v67AutoGpsBtn')){const b=document.createElement('button');b.id='v67AutoGpsBtn';b.innerHTML='📌 Tự lấy tọa độ Google Maps';b.onclick=openAutoGps;dm.prepend(b)}},20)};
function v67Toolbar(){const top=document.querySelector('.toolbar');if(top&&!$('v67AutoGpsTop')){const b=document.createElement('button');b.id='v67AutoGpsTop';b.className='admin-only v67-auto-btn';b.title='Tự lấy tọa độ từ Google Maps';b.innerHTML='📌 <span>Auto GPS</span>';b.onclick=openAutoGps;top.appendChild(b)}}
setTimeout(v67Toolbar,1000);


/* ===== V6.8.1 POSITION EDITOR ===== */
async function v68ApplyGoogleLink(){
 const url=$('f_mapsUrl')?.value.trim(); if(!url)return toast('Hãy dán link Google Maps mới.');
 const direct=parseCoords(url);
 if(direct){$('f_lat').value=Number(direct[0]).toFixed(7);$('f_lng').value=Number(direct[1]).toFixed(7);v68PositionPreview();return toast('Đã cập nhật tọa độ từ link Google Maps. Bấm Lưu để hoàn tất.');}
 if(!v67ResolverReady())return toast('Link rút gọn cần đăng nhập Cloud Admin để lấy tọa độ.');
 const b=$('v68LinkBtn');if(b){b.disabled=true;b.textContent='⏳ Đang lấy vị trí…'}
 try{const res=await v67CallResolver({mapsUrl:url});$('f_lat').value=Number(res.lat).toFixed(7);$('f_lng').value=Number(res.lng).toFixed(7);if(res.finalUrl)$('f_mapsUrl').value=res.finalUrl;v68PositionPreview();toast('Đã nhận vị trí mới. Bấm Lưu để cập nhật cơ sở.');}
 catch(e){toast('Không lấy được vị trí: '+(e.message||e))}finally{if(b){b.disabled=false;b.textContent='🔗 Cập nhật từ link Google Maps'}}
}
function v68PositionPreview(){const e=$('v68PosPreview');if(!e)return;const lat=numOrNull($('f_lat')?.value),lng=numOrNull($('f_lng')?.value);e.innerHTML=(lat!==null&&lng!==null)?`<b>Vị trí sẽ lưu:</b> ${lat.toFixed(7)}, ${lng.toFixed(7)} <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener">Mở kiểm tra ↗</a>`:'Chưa có tọa độ hợp lệ.'}
function v68PickOnMap(){startPinPicker()}
const _v68OpenEditor=openEditor;
openEditor=function(id=null){_v68OpenEditor(id);setTimeout(()=>{
 const tools=document.querySelector('.coord-tools');if(!tools||$('v68PositionBox'))return;
 tools.style.display='none';
 const box=document.createElement('section');box.id='v68PositionBox';box.className='v68-position-box';
 box.innerHTML=`<div class="v68-position-title"><b>📍 Thay đổi vị trí cơ sở</b><small>Chọn một trong 3 cách dưới đây</small></div>
 <div class="v68-position-actions"><button type="button" id="v68LinkBtn" onclick="v68ApplyGoogleLink()">🔗 Cập nhật từ link Google Maps</button><button type="button" class="primary" onclick="v68PickOnMap()">🗺️ Chọn trực tiếp trên bản đồ</button><button type="button" onclick="document.getElementById('f_lat').focus()">⌨️ Nhập lat / lng</button></div>
 <div id="v68PosPreview" class="v68-position-preview"></div><div class="v68-help">Dán link Google Maps mới vào ô <b>Link Google Maps</b> phía trên. Với link rút gọn <code>maps.app.goo.gl</code>, Cloud Admin sẽ tự giải link. Sau khi vị trí đúng, bấm <b>Lưu</b>.</div>`;
 tools.parentNode.insertBefore(box,tools.nextSibling);v68PositionPreview();
 ['f_lat','f_lng'].forEach(k=>$(k)?.addEventListener('input',v68PositionPreview));
 },80)};


/* ===== V6.8.3 ADD BUTTON HOTFIX ===== */
(function(){
 function openAddSafely(ev){
   try{
     if(!currentUser){ toast('Phiên đăng nhập chưa sẵn sàng. Hãy đăng xuất rồi đăng nhập lại.'); return; }
     if(String(currentUser.role||'').trim().toLowerCase()!=='admin'){ toast('Tài khoản hiện tại không có quyền ADMIN.'); return; }
     openEditor(null);
   }catch(err){ console.error('ADD_PLACE_ERROR',err); toast('Không mở được form Thêm: '+(err?.message||err)); }
 }
 window.openAddSafely=openAddSafely;
 window.addEventListener('load',()=>{
   document.querySelectorAll('.admin-only').forEach(el=>{
     const text=(el.textContent||'').trim();
     if((text.includes('Thêm')||el.getAttribute('onclick')==='openEditor()') && el.tagName==='BUTTON'){
       el.setAttribute('onclick','');
       el.onclick=openAddSafely;
       el.style.pointerEvents='auto';
     }
   });
 });
})();

/* ===== V6.9.1 CROSS-DEVICE / CROSS-BROWSER ===== */
(function(){
 function refreshMap(){try{if(map&&map.invalidateSize)map.invalidateSize({pan:false});}catch(e){}}
 let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(refreshMap,160)});
 window.addEventListener('orientationchange',()=>setTimeout(refreshMap,300));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(refreshMap,120)});
 const oldShow=window.showMobileTab;
 if(typeof oldShow==='function')window.showMobileTab=function(tab){oldShow(tab);setTimeout(refreshMap,100)};
 // Prevent a list tap from being swallowed by nested links/buttons on touch browsers.
 document.addEventListener('click',function(e){const item=e.target.closest&&e.target.closest('.item');if(!item)return;if(e.target.closest('a,button,input,select,textarea'))e.stopPropagation()},true);
 // iOS/Safari visual viewport: keep bottom sheets above keyboard.
 if(window.visualViewport){window.visualViewport.addEventListener('resize',()=>{document.documentElement.style.setProperty('--vvh',window.visualViewport.height+'px');setTimeout(refreshMap,80)})}
 setTimeout(refreshMap,400);
})();
