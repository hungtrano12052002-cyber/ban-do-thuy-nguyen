let places=[], map, markers=[], currentUser=null, selectedId=null, supabaseClient=null, realtimeChannel=null;
const defaultCenter=[20.96,106.69];
const STORE='thuynguyen_places_v5';
const demoAuth={admin:{pass:'admin123',role:'admin'},user:{pass:'user123',role:'user'}};
const cfg=window.APP_CONFIG||{};
const cloudEnabled=!!(cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&window.supabase?.createClient);

function initCloud(){
  if(!cloudEnabled)return;
  supabaseClient=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}
async function init(){
  map=L.map('map',{zoomControl:true}).setView(defaultCenter,12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  if(cloudEnabled&&currentUser?.cloud){await loadCloudPlaces();subscribeRealtime();}
  else loadLocalPlaces();
  renderAll();
  updateCloudBadge();
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
function updateCloudBadge(){const e=$('cloudStatus');if(!e)return;e.textContent=currentUser?.cloud?'☁ ONLINE':'◉ LOCAL';e.title=currentUser?.cloud?'Đang đồng bộ Supabase':'Đang dùng dữ liệu trên thiết bị'}

function filtered(){
 const q=($('search')?.value||'').toLowerCase().trim(),st=$('statusFilter')?.value||'';
 return places.filter(x=>{const active=isActive(x.status);return (!st||(st==='active'?active:!active))&&(!q||Object.values(x).join(' ').toLowerCase().includes(q))});
}
function isActive(s=''){return !/không hoạt động|ngừng|thu hồi|đóng cửa/i.test(s)}
function renderAll(){renderStats();renderList();renderMarkers()}
function renderStats(){const visible=filtered(),active=visible.filter(x=>isActive(x.status)).length,geo=visible.filter(validGeo).length;$('stats').innerHTML=`<div><b>${visible.length}</b><span>Cơ sở</span></div><div><b>${active}</b><span>Hoạt động</span></div><div><b>${geo}</b><span>Có tọa độ</span></div>`}
function renderList(){const arr=filtered(),list=$('list');list.innerHTML=arr.length?arr.map(x=>`<div class="item ${selectedId===x.id?'selected':''}" onclick="focusPlace('${escJs(x.id)}')"><div class="item-head"><b>${esc(x.name)}</b><span class="dot ${isActive(x.status)?'on':'off'}"></span></div><small>${esc(x.wardBlock||'Chưa có TDP')} · ${esc(x.officer||'Chưa phân công')}</small><span class="badge ${isActive(x.status)?'':'off'}">${esc(x.status||'Chưa rõ')}</span></div>`).join(''):`<div class="empty">Không có kết quả phù hợp.</div>`}
function markerIcon(active){return L.divIcon({className:'pin-wrap',html:`<span class="map-pin ${active?'on':'off'}"></span>`,iconSize:[22,22],iconAnchor:[11,11]})}
function renderMarkers(){if(!map)return;markers.forEach(m=>map.removeLayer(m));markers=[];filtered().forEach(x=>{if(validGeo(x)){const m=L.marker([x.lat,x.lng],{icon:markerIcon(isActive(x.status))}).addTo(map).bindTooltip(x.name);m.on('click',()=>showDetail(x));markers.push(m)}})}
function validGeo(x){return Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lng))&&Number(x.lat)!==0&&Number(x.lng)!==0}
function fitAll(){const pts=filtered().filter(validGeo).map(x=>[x.lat,x.lng]);if(pts.length)map.fitBounds(pts,{padding:[40,40],maxZoom:16});else toast('Chưa có cơ sở nào có tọa độ.')}
function focusPlace(id){const x=places.find(p=>String(p.id)===String(id));if(!x)return;selectedId=x.id;renderList();if(validGeo(x))map.setView([x.lat,x.lng],16);showDetail(x)}
function showDetail(x){
 selectedId=x.id;renderList();const d=$('detail');d.classList.remove('hidden');const imgs=(x.images||[]).slice(0,8).map(src=>`<img src="${escAttr(src)}" alt="Ảnh cơ sở" loading="lazy">`).join('');
 d.innerHTML=`<button class="close" onclick="dclose()">×</button><div class="detail-title"><h2>${esc(x.name)}</h2><span class="badge ${isActive(x.status)?'':'off'}">${esc(x.status||'Chưa rõ')}</span></div>${imgs?`<div class="gallery">${imgs}</div>`:''}${row('TDP / khu vực',x.wardBlock)}${row('Chủ cơ sở',x.ownerName)}${row('Số điện thoại',phoneLink(x.ownerPhone))}${row('Người quản lý',x.managerName)}${row('SĐT quản lý',phoneLink(x.managerPhone))}${row('Địa chỉ quản lý',x.managerAddress)}${row('Cán bộ phụ trách',x.officer)}${row('Quy mô',x.scale)}${row('Pháp lý',x.legal)}${row('Tọa độ',validGeo(x)?`${x.lat}, ${x.lng}`:'Chưa có')}<div class="actions mobile-actions"><a class="route-a" href="${escAttr(directionUrl(x))}" target="_blank" rel="noopener">🧭 Chỉ đường</a>${x.mapsUrl?`<a href="${escAttr(x.mapsUrl)}" target="_blank" rel="noopener">📍 Google Maps</a>`:''}<a class="secondary-a" href="${escAttr(googleImageUrl(x))}" target="_blank" rel="noopener">🖼️ Ảnh Google</a>${validGeo(x)?`<a class="secondary-a" href="${escAttr(streetViewUrl(x))}" target="_blank" rel="noopener">👁 Street View</a>`:''}<button class="secondary" onclick="sharePlace('${escJs(x.id)}')">↗️ Chia sẻ</button>${x.lodgerListUrl?`<a class="secondary-a" href="${escAttr(x.lodgerListUrl)}" target="_blank" rel="noopener">📋 Danh sách</a>`:''}<button class="secondary admin-only" onclick="openEditor('${escJs(x.id)}')">✏️ Sửa</button></div>`;
}
function row(a,b){return `<div class="row"><label>${esc(a)}</label><div>${b&&String(b).startsWith('<a ')?b:esc(b||'—')}</div></div>`}
function phoneLink(v){if(!v)return '—';const p=String(v).replace(/\D/g,'');return `<a class="phone" href="tel:${p}">${esc(formatPhone(v))}</a>`}
function formatPhone(v){let s=String(v).trim();if(/^\d{9}$/.test(s))s='0'+s;return s}
function dclose(){selectedId=null;$('detail').classList.add('hidden');renderList()}

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
async function resetData(){if(!confirm('Khôi phục dữ liệu gốc sẽ xóa các thay đổi cục bộ. Tiếp tục?'))return;localStorage.removeItem(STORE);places=structuredClone(window.INITIAL_PLACES||[]);normalizePlaces();closeModal();dclose();renderAll();toast('Đã khôi phục dữ liệu gốc.')}

function directionUrl(x){const dest=validGeo(x)?`${x.lat},${x.lng}`:[x.name,x.wardBlock,'Thủy Nguyên Hải Phòng'].filter(Boolean).join(', ');return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`}
function googleImageUrl(x){const q=[x.name,x.wardBlock,'Thủy Nguyên Hải Phòng'].filter(Boolean).join(' ');return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`}
function streetViewUrl(x){return validGeo(x)?`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${x.lat},${x.lng}`:x.mapsUrl||directionUrl(x)}
async function sharePlace(id){const x=places.find(p=>String(p.id)===String(id));if(!x)return;const url=x.mapsUrl||directionUrl(x),text=[x.name,x.wardBlock].filter(Boolean).join(' · ');try{if(navigator.share)await navigator.share({title:x.name,text,url});else{await navigator.clipboard.writeText(url);toast('Đã sao chép link vị trí.')}}catch(e){}}
function locateMe(){if(!navigator.geolocation)return toast('Thiết bị không hỗ trợ định vị.');toast('Đang lấy vị trí hiện tại…');navigator.geolocation.getCurrentPosition(pos=>{const {latitude,longitude}=pos.coords;map.setView([latitude,longitude],16);if(window.__meMarker)map.removeLayer(window.__meMarker);window.__meMarker=L.circleMarker([latitude,longitude],{radius:9,weight:3,fillOpacity:.9}).addTo(map).bindPopup('Vị trí hiện tại của bạn').openPopup();if(innerWidth<=760)showMobileTab('map')},()=>toast('Không lấy được vị trí. Hãy bật quyền Vị trí cho ứng dụng.'),{enableHighAccuracy:true,timeout:10000,maximumAge:30000})}
function showMobileTab(tab){document.body.dataset.mobiletab=tab;setTimeout(()=>map&&map.invalidateSize(),120)}
function isIos(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true}
function installPwa(){if(isStandalone())return toast('Ứng dụng đã được cài trên màn hình chính.');if(window.__deferredPrompt){window.__deferredPrompt.prompt();window.__deferredPrompt.userChoice.finally(()=>window.__deferredPrompt=null);return}openInstallHelp()}
function openInstallHelp(){const ios=isIos();$('modalCard').innerHTML=`<div class="modal-head"><h2>📱 Cài ứng dụng trên điện thoại</h2><button onclick="closeModal()">×</button></div><div class="install-help"><div class="install-logo"><img src="icons/icon-192.png"><div><b>Bản đồ số Thủy Nguyên</b><span>Mobile V5 · Cloud Sync</span></div></div>${ios?`<ol><li>Mở địa chỉ ứng dụng bằng <b>Safari</b>.</li><li>Nhấn nút <b>Chia sẻ</b>.</li><li>Chọn <b>Thêm vào Màn hình chính</b>.</li><li>Nhấn <b>Thêm</b>.</li></ol>`:`<ol><li>Mở ứng dụng bằng Chrome/Edge.</li><li>Nhấn <b>Cài đặt ứng dụng</b> hoặc <b>Add to Home screen</b>.</li><li>Xác nhận cài đặt.</li></ol>`}<div class="install-note"><b>V5:</b> Khi cấu hình Supabase, mọi thiết bị đăng nhập sẽ dùng chung dữ liệu và ảnh.</div><button class="primary install-full" onclick="closeModal()">Đã hiểu</button></div>`;$('modal').classList.remove('hidden')}
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
