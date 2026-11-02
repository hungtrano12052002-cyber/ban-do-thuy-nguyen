'use strict';
/* V7.9.0: one cloud dataset, revision-checked edits, private resident/document media. */
const TN_VERSION='7.9.0',TN_BUCKET='tn-private-media';
const tnSync={revisions:new Map(),generation:0,promise:null,again:false,error:'',last:0};
let tnEditor=null,tnMediaBusy=0,tnSaving=false;
const tnCopy=x=>JSON.parse(JSON.stringify(x));
const tnId=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const tnError=e=>String(e?.message||e||'Lỗi không xác định');
function tnFriendly(e){const m=tnError(e);if(/SYNC_CONFLICT|duplicate key/i.test(m))return 'Cơ sở đã được sửa trên thiết bị khác. Nội dung bạn nhập vẫn ở đây. Xuất bản nháp trước, rồi mở lại cơ sở để đối chiếu.';if(/tn_save_place|revision.*does not exist|schema cache/i.test(m))return 'Máy chủ chưa được nâng cấp. Cần chạy file SUPABASE_V790_DONG_BO_VA_ANH.sql trong dự án đang dùng.';if(/Bucket not found/i.test(m))return 'Chưa có kho ảnh riêng. Cần chạy file SQL nâng cấp V7.9.0.';if(/row-level|permission|WRITE_DENIED/i.test(m))return 'Tài khoản chưa có quyền đối với cơ sở hoặc ảnh này. Kiểm tra phân quyền TDP trên máy chủ.';return m;}
function tnCanEdit(p){return !!currentUser?.accessVerified&&(v770IsAdmin()||(!!currentUser.canEdit&&v755AllowedTdp(p)));}
function tnScope(){return places.filter(p=>v770IsAdmin()||v755AllowedTdp(p));}
// Fix the final legacy filter which used IDs absent from index.html.
filtered=function(){let arr=tnScope();const q=normSearch($('search')?.value||''),field=$('searchField')?.value||'all',status=$('statusFilter')?.value||'';
 if(q)arr=arr.filter(p=>normSearch(field==='all'?[...SEARCH_FIELDS.map(k=>p[k]||''),v72AllResidentSearch(p)].join(' '):p[field]).includes(q));
 if(status)arr=arr.filter(p=>status==='active'?isActive(p.status):!isActive(p.status));return arr;};
loadCloudPlaces=async function(){
 if(!currentUser?.cloud||!supabaseClient)return false;
 if(tnSync.promise){tnSync.again=true;return tnSync.promise;}
 const uid=currentUser.id,client=supabaseClient;
 tnSync.promise=(async()=>{let result=false;
  do {tnSync.again=false;const generation=tnSync.generation;
   try {const rows=[],size=500;
    for(let offset=0;;offset+=size){const {data,error}=await client.from('places').select('id,data,revision').order('id',{ascending:true}).range(offset,offset+size-1);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<size)break;}
    if(!currentUser?.cloud||currentUser.id!==uid)return false;
    if(generation!==tnSync.generation){tnSync.again=true;continue;}
    places=rows.map(r=>({...r.data,id:String(r.id)}));normalizePlaces();tnSync.revisions=new Map(rows.map(r=>[String(r.id),r.revision]));tnSync.last=Date.now();tnSync.error='';v781SyncState='ok';v781LastSync=new Date();result=true;
   }catch(e){tnSync.error=tnFriendly(e);v781SyncState='error';result=false;}
  }while(tnSync.again&&currentUser?.id===uid);
  updateCloudBadge();return result;
 })();
 try{return await tnSync.promise;}finally{tnSync.promise=null;}
};
subscribeRealtime=function(){if(!supabaseClient||!currentUser?.cloud)return;if(realtimeChannel)supabaseClient.removeChannel(realtimeChannel);
 realtimeChannel=supabaseClient.channel(`tn-places-${currentUser.id}`).on('postgres_changes',{event:'*',schema:'public',table:'places'},()=>v781Refresh()).subscribe(s=>{if(s==='SUBSCRIBED')v781Refresh();});};
updateCloudBadge=function(){const el=$('cloudStatus');if(!el)return;el.textContent=!currentUser?.cloud?'◉ CHỈ LƯU TRÊN MÁY':navigator.onLine===false?'⚠ MẤT MẠNG':tnSync.error?'⚠ LỖI ĐỒNG BỘ':tnSync.last?'☁ ĐÃ ĐỒNG BỘ':'☁ ĐANG KẾT NỐI';el.title=!currentUser?.cloud?'Bấm để cấu hình dữ liệu dùng chung':tnSync.error||`Dự án: ${new URL(cfg.SUPABASE_URL).hostname} · Lần tải: ${tnSync.last?new Date(tnSync.last).toLocaleString('vi-VN'):'chưa tải'}`;el.onclick=tnOpenSync;el.style.cursor='pointer';};
// Replace boot's old role-only restoration with the verified access resolver.
window.removeEventListener('load',boot);
window.addEventListener('load',async()=>{
 initCloud();tnInstallSyncButtons();
 $('loginHint').textContent=cloudEnabled?'Đăng nhập email để dùng chung dữ liệu. Tài khoản admin cục bộ chỉ lưu trên máy.':'Chưa cấu hình đồng bộ. Bấm “Kết nối web và điện thoại” bên dưới.';
 try{await globalThis.restoreSession();}catch(e){toast(tnFriendly(e));}
});
const tnOldLogin=login;
login=async function(){if($('user')?.value.includes('@')&&!cloudEnabled)return toast('Chưa cấu hình máy chủ. Bấm “Kết nối web và điện thoại” để nhập khóa công khai.');return tnOldLogin();};
const tnOldEnter=enterApp;
enterApp=function(){tnSync.generation++;tnSync.last=0;tnSync.error='';places=[];tnSync.revisions.clear();tnOldEnter();setTimeout(()=>{tnInstallSyncButtons();updateCloudBadge();},300);};
window.addEventListener('offline',updateCloudBadge);
function tnInstallSyncButtons(){const card=document.querySelector('.login-card');if(card&&!$('tnConnect'))card.insertAdjacentHTML('beforeend','<button type="button" id="tnConnect" onclick="tnOpenSync()">☁ Kết nối web và điện thoại</button>');const actions=document.querySelector('.head-actions');if(actions&&!$('tnSyncButton'))actions.insertAdjacentHTML('afterbegin','<button id="tnSyncButton" onclick="tnOpenSync()">☁ Đồng bộ</button>');}
function tnOpenSync(){
 if($('placeForm'))return toast('Hãy lưu, xuất bản nháp hoặc đóng phần chỉnh sửa trước khi mở cấu hình.');
 const project=String(cfg.SUPABASE_URL||'');
 $('modalCard').innerHTML=`<div class="modal-head"><h2>☁ Đồng bộ web và điện thoại · ${TN_VERSION}</h2><button onclick="closeModal()">×</button></div>
 <p>Cả hai thiết bị phải dùng cùng dự án và đăng nhập bằng email được cấp quyền. Tài khoản <b>admin cục bộ</b> lưu riêng trên từng máy.</p>
 <form onsubmit="tnSaveConnection(event)"><label>Địa chỉ dự án Supabase<input id="tnUrl" type="url" required value="${escAttr(project)}" placeholder="https://…supabase.co"></label><label>Khóa publishable hoặc anon công khai<input id="tnKey" required value="${escAttr(cfg.SUPABASE_ANON_KEY||'')}" autocomplete="off" spellcheck="false"></label><p>Không nhập secret key hoặc service_role. Lưu cấu hình sẽ tải lại ứng dụng.</p><button type="submit" class="primary">Lưu kết nối</button></form>
 <div class="tn-actions"><button onclick="tnCheckConnection()">Kiểm tra kết nối</button><button onclick="tnRefreshNow()">Tải dữ liệu mới nhất</button><button onclick="tnExportDevice()">Sao lưu dữ liệu trên máy này</button><button onclick="tnChooseImport()">Chuyển bản sao lưu lên dữ liệu chung</button></div><div id="tnDiagnosis" class="tn-note">${esc(currentUser?.cloud?`Đã đăng nhập: ${currentUser.name}`:'Chưa đăng nhập dữ liệu dùng chung.')}${tnSync.error?'<br>'+esc(tnSync.error):''}</div>
 <p>Ảnh người cư trú và giấy tờ được lưu trong kho riêng, chỉ tài khoản có quyền mới xem được. Dữ liệu LOCAL cũ cần sao lưu trên từng máy rồi chuyển lên dữ liệu chung.</p>`;
 $('modal').classList.remove('hidden');
}
function tnValidateConnection(url,key){
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Dùng địa chỉ gốc HTTPS của dự án Supabase.');
 if(key.startsWith('sb_secret_'))throw Error('Không dùng secret key. Hãy lấy publishable key.');
 if(key.startsWith('eyJ')){let p;try{p=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch(_){throw Error('Khóa anon không hợp lệ.');}if(p.role!=='anon')throw Error('Chỉ dùng anon key công khai.');}
 else if(!key.startsWith('sb_publishable_'))throw Error('Hãy nhập publishable key hoặc anon key của dự án.');
 return {SUPABASE_URL:u.origin,SUPABASE_ANON_KEY:key};
}
function tnSaveConnection(e){e.preventDefault();try{const c=tnValidateConnection($('tnUrl').value.trim(),$('tnKey').value.trim());localStorage.setItem('tn_connection_v790',JSON.stringify(c));location.reload();}catch(err){toast(tnError(err));}}
async function tnCheckConnection(){const out=$('tnDiagnosis');if(!cloudEnabled)return out.textContent='Thiếu URL/khóa công khai hoặc chưa tải được thư viện kết nối. Hãy lưu cấu hình và mở lại.';if(!currentUser?.cloud)return out.textContent='Đã nhận cấu hình. Hãy đăng xuất tài khoản cục bộ và đăng nhập bằng email Supabase.';out.textContent='Đang kiểm tra…';const ok=await loadCloudPlaces();if(!$('tnDiagnosis'))return;out.textContent=ok?`Kết nối thành công. Dự án: ${new URL(cfg.SUPABASE_URL).hostname}. ${places.length} cơ sở trong phạm vi được cấp quyền. Kho ảnh: ${TN_BUCKET}.`:tnSync.error;}
async function tnRefreshNow(){if(!currentUser?.cloud)return toast('Cần đăng nhập email để tải dữ liệu dùng chung.');if(await loadCloudPlaces()){renderAll();toast('Đã tải danh sách mới nhất.');}else toast(tnSync.error);}
// IndexedDB keeps image bytes out of localStorage's small quota.
let tnDBPromise;
function tnDB(){if(!tnDBPromise)tnDBPromise=new Promise((resolve,reject)=>{const q=indexedDB.open('tn_media_v790',1);q.onupgradeneeded=()=>q.result.createObjectStore('media');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});return tnDBPromise;}
async function tnBlobPut(key,blob){const db=await tnDB();return new Promise((resolve,reject)=>{const t=db.transaction('media','readwrite');t.objectStore('media').put(blob,key);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Không đủ dung lượng lưu ảnh.'));});}
async function tnBlobGet(key){const db=await tnDB();return new Promise((resolve,reject)=>{const q=db.transaction('media').objectStore('media').get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
async function tnPrepareImage(file,kind){
 if(!file.type.startsWith('image/')||file.size>20*1024*1024)throw Error('Chọn ảnh dưới 20 MB.');
 const url=URL.createObjectURL(file);try{const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Không đọc được định dạng ảnh. Hãy chọn JPG, PNG hoặc WebP.'));i.src=url;});
 const max=kind==='document'?2400:1200,s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
 return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Không nén được ảnh.')),'image/jpeg',kind==='document'?.92:.85));
 }finally{URL.revokeObjectURL(url);}
}
const tnMediaCache=new Map();
async function tnMediaURL(m){if(!m)return '';if(m.inline&&/^data:image\/(jpeg|png|webp);base64,/i.test(m.inline))return m.inline;
 if(m.path){if(m.bucket!==TN_BUCKET||!currentUser?.cloud)throw Error('Cần đăng nhập dữ liệu chung để xem ảnh.');const key=currentUser.id+'|'+m.path,cached=tnMediaCache.get(key);if(cached&&cached.expires>Date.now())return cached.url;
 const {data,error}=await supabaseClient.storage.from(TN_BUCKET).createSignedUrl(m.path,600);if(error)throw error;tnMediaCache.set(key,{url:data.signedUrl,expires:Date.now()+540000});return data.signedUrl;}
 if(m.localId){const b=await tnBlobGet(m.localId);if(!b)throw Error('Ảnh chỉ có trên thiết bị gốc.');return fileToDataUrl(b);}return '';}
function tnMediaImage(m,label='Ảnh'){return `<button type="button" class="tn-thumb" data-media="${escAttr(JSON.stringify(m))}" onclick="tnOpenMedia(this)"><img data-tn-media="${escAttr(JSON.stringify(m))}" alt="${escAttr(label)}"><span>${esc(m.type||m.name||label)}</span></button>`;}
async function tnHydrateMedia(root=document){await Promise.all([...root.querySelectorAll('img[data-tn-media]')].filter(el=>!el.dataset.loading).map(async el=>{el.dataset.loading='1';try{el.src=await tnMediaURL(JSON.parse(el.dataset.tnMedia));}catch(e){el.alt='Chưa tải được ảnh';el.closest('.tn-thumb')?.setAttribute('title',tnFriendly(e));}}));}
async function tnOpenMedia(button){try{const m=JSON.parse(button.dataset.media),url=await tnMediaURL(m);const dialog=document.createElement('dialog');dialog.className='tn-lightbox';const img=new Image();img.src=url;img.alt=m.name||'Ảnh';const close=document.createElement('button');close.textContent='Đóng ảnh';close.onclick=()=>dialog.close();dialog.append(close,img);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();}catch(e){toast(tnFriendly(e));}}
async function tnUploadMedia(media,placeId,kind){
 const out=[];for(const source of media||[]){const m={...source};if(m.path){out.push(m);continue;}const blob=m.inline?await(await fetch(m.inline)).blob():await tnBlobGet(m.localId);if(!blob)throw Error(`Không tìm thấy ảnh ${m.name||''} trên máy. Hãy chọn lại ảnh.`);
 const path=`${placeId}/${kind}/${m.id||tnId()}.jpg`;const {error}=await supabaseClient.storage.from(TN_BUCKET).upload(path,blob,{contentType:'image/jpeg',upsert:false});
 if(error){if(!/already exists|duplicate/i.test(tnError(error)))throw error;/* A retry uses the same immutable attachment ID. */}
 out.push({id:m.id||tnId(),name:m.name||'Ảnh',type:m.type||'',bucket:TN_BUCKET,path});}return out;
}
// Keep resident IDs, photos and extension fields on edit, rather than dropping unknown fields.
v72ResidentArray=function(p){return (Array.isArray(p?.residents)?p.residents:[]).filter(r=>r&&[r.name,r.cccd,r.phone,r.birthYear,r.hometown,r.arrival,r.departure].some(v=>String(v||'').trim())).map(r=>({...r,name:String(r.name||'').trim(),birthYear:String(r.birthYear||'').trim(),cccd:String(r.cccd||'').trim(),phone:String(r.phone||'').trim(),status:r.status||'Đang cư trú',photos:Array.isArray(r.photos)?r.photos:[]}));};
v781Residents=function(p){const rows=v72ResidentArray(p),key=r=>[normSearch(r.name),String(r.cccd||'').trim(),String(r.phone||'').trim()].join('|'),seen=new Set(rows.map(key));for(const line of v7ResidentLines(p)){const [name,phone='',cccd='']=line.split('|').map(s=>s.trim());const r={name,phone,cccd,status:'Đang cư trú'};if(!seen.has(key(r))){rows.push(r);seen.add(key(r));}}return rows;};
const tnOldRow=v72ResidentRow;
v72ResidentRow=function(r={}){const id=r.id||tnId();return tnOldRow(r).replace('class="v72-resident-row"',`class="v72-resident-row" data-resident-id="${escAttr(id)}" data-original="${escAttr(JSON.stringify({...r,id}))}"`).replace('<button type="button" class="danger v72-remove"',`<div class="tn-resident-media v72-wide"><b>Ảnh người cư trú</b><div class="tn-media-list">${(r.photos||[]).map(m=>tnEditableMedia(m)).join('')}</div><label class="tn-file">Chọn ảnh<input type="file" accept="image/*" multiple onchange="tnAddMedia(event,'portrait')"></label><label class="tn-file">Chụp ảnh<input type="file" accept="image/*" capture="user" onchange="tnAddMedia(event,'portrait')"></label></div><button type="button" class="danger v72-remove"`);};
function tnEditableMedia(m){return `<div class="tn-media-item" data-attachment="${escAttr(JSON.stringify(m))}">${tnMediaImage(m)}<button type="button" class="tn-remove" onclick="this.parentElement.remove()">Bỏ ảnh</button></div>`;}
v72CollectResidents=function(){return [...document.querySelectorAll('#v72ResidentRows .v72-resident-row')].map(row=>{const r=JSON.parse(row.dataset.original||'{}');r.id=row.dataset.residentId;row.querySelectorAll('[data-r]').forEach(el=>r[el.dataset.r]=el.value.trim());r.photos=tnCollectMedia(row.querySelector('.tn-media-list'));return r;}).filter(r=>[r.name,r.cccd,r.phone,r.birthYear,r.hometown,r.arrival,r.departure].some(Boolean));};
function tnCollectMedia(box){return [...(box?.querySelectorAll('.tn-media-item')||[])].map(el=>JSON.parse(el.dataset.attachment));}
async function tnAddMedia(e,kind){const input=e.target,host=input.closest(kind==='portrait'?'.tn-resident-media':'.tn-doc-editor'),box=host.querySelector('.tn-media-list');const limit=kind==='portrait'?6:30;tnMediaBusy++;
 try{for(const file of [...input.files]){if(box.children.length>=limit)throw Error(`Tối đa ${limit} ảnh trong mục này.`);const blob=await tnPrepareImage(file,kind),id=tnId();await tnBlobPut(id,blob);if(!box.isConnected)return;const m={id,localId:id,name:file.name,type:kind==='document'?(host.querySelector('select')?.value||'Giấy tờ khác'):'Ảnh người cư trú'};box.insertAdjacentHTML('beforeend',tnEditableMedia(m));}await tnHydrateMedia(box);}
 catch(err){toast(tnFriendly(err));}finally{tnMediaBusy--;input.value='';}}
const tnOldAddRow=v72AddResidentRow;
v72AddResidentRow=function(){tnOldAddRow();tnHydrateMedia($('v72ResidentRows'));};
const tnOldEditor=openEditor;
openEditor=function(id=null){const old=id===null?null:places.find(p=>String(p.id)===String(id));if(old&&!tnCanEdit(old)||!old&&!v770IsAdmin())return toast('Bạn chưa có quyền sửa cơ sở này.');tnOldEditor(id);if(!$('placeForm'))return;
 tnEditor={id:id===null?null:String(id),base:old?tnCopy(old):null,revision:old?tnSync.revisions.get(String(id)):null,userId:currentUser?.id,cloud:!!currentUser?.cloud};
 const section=document.createElement('section');section.className='tn-doc-editor';section.innerHTML=`<h3>Ảnh giấy tờ của cơ sở</h3><p>Đăng ký kinh doanh, giấy chứng nhận quyền sử dụng đất, hồ sơ PCCC và giấy tờ khác.</p><select aria-label="Loại giấy tờ"><option>Đăng ký kinh doanh</option><option>Giấy chứng nhận quyền sử dụng đất / sổ đỏ</option><option>Hồ sơ PCCC</option><option>Giấy tờ khác</option></select><label class="tn-file">Chọn ảnh giấy tờ<input type="file" accept="image/*" multiple onchange="tnAddMedia(event,'document')"></label><label class="tn-file">Chụp giấy tờ<input type="file" accept="image/*" capture="environment" onchange="tnAddMedia(event,'document')"></label><div class="tn-media-list">${(old?.documents||[]).map(tnEditableMedia).join('')}</div>`;
 $('placeForm').querySelector('.form-actions').before(section);$('placeForm').querySelector('.form-actions').insertAdjacentHTML('afterbegin','<button type="button" onclick="tnExportDraft()">Xuất bản nháp</button>');
 const msg=document.createElement('p');msg.className='tn-note';msg.textContent=currentUser.cloud?'Dữ liệu và ảnh sẽ được gửi lên máy chủ khi bấm Lưu.':'Đang lưu riêng trên máy này. Đăng nhập email để dùng chung dữ liệu.';$('placeForm').prepend(msg);tnHydrateMedia($('placeForm'));
};
function tnReadPlace(id){const base=tnEditor?.base||{};const obj={...base,id:String(id)};for(const k of ['name','category','wardBlock','ownerName','ownerPhone','managerName','managerPhone','managerAddress','officer','scale','status','legal','mapsUrl','lodgerListUrl','residentsText'])obj[k]=$('f_'+k)?.value.trim()||'';obj.category=obj.category||inferCategory(obj.name);obj.lat=numOrNull($('f_lat').value);obj.lng=numOrNull($('f_lng').value);obj.residents=v72CollectResidents();obj.documents=tnCollectMedia(document.querySelector('.tn-doc-editor .tn-media-list'));obj.images=[...document.querySelectorAll('#imagePreview img')].map(el=>el.src);return obj;}
async function tnWriteCloud(obj,revision){
 const {data,error}=await supabaseClient.rpc('tn_save_place',{p_id:String(obj.id),p_data:obj,p_expected_revision:revision??null});if(error)throw error;if(!data?.id||data.revision==null)throw Error('Máy chủ không xác nhận bản ghi.');return data;
}
savePlace=async function(e,id){e.preventDefault();if(tnSaving)return;if(tnMediaBusy)return toast('Đang xử lý ảnh. Chờ ảnh xuất hiện rồi bấm Lưu.');if(!tnEditor||tnEditor.userId!==currentUser?.id||tnEditor.cloud!==!!currentUser?.cloud)return toast('Phiên đăng nhập đã thay đổi. Xuất bản nháp rồi mở lại cơ sở.');
 const obj=tnReadPlace(id);if(!obj.name)return toast('Hãy nhập tên cơ sở.');if(!tnCanEdit(tnEditor.base||obj))return toast('Bạn không có quyền sửa cơ sở này.');
 const sheet=obj.lodgerListUrl;if(sheet&&!safeHttpUrl(sheet))return toast('Link Google Trang tính phải bắt đầu bằng https://.');
 tnSaving=true;const form=$('placeForm'),btn=e.submitter;form.inert=true;if(btn){btn.disabled=true;btn.textContent='Đang lưu…';}
 try{if(currentUser.cloud){if(navigator.onLine===false)throw Error('Đang mất mạng. Nội dung nhập vẫn giữ nguyên; có thể xuất bản nháp và lưu lại khi có mạng.');if(tnEditor.base&&tnEditor.revision==null)throw Error('Chưa tải được phiên bản từ máy chủ. Xuất bản nháp rồi tải lại danh sách.');
  obj.images=await uploadNewImages(id);for(const r of obj.residents)r.photos=await tnUploadMedia(r.photos,id,'residents');obj.documents=await tnUploadMedia(obj.documents,id,'documents');
  const saved=await tnWriteCloud(obj,tnEditor.revision);tnSync.generation++;tnSync.revisions.set(String(id),saved.revision);const i=places.findIndex(p=>String(p.id)===String(id));if(i<0)places.unshift(saved.data);else places[i]=saved.data;tnSync.error='';tnSync.last=Date.now();toast('Đã lưu lên dữ liệu chung. Thiết bị còn lại sẽ cập nhật khi có mạng.');
 }else{const i=places.findIndex(p=>String(p.id)===String(id)),next=places.slice();if(i<0)next.unshift(obj);else next[i]=obj;localStorage.setItem(STORE,JSON.stringify(next));places=next;toast('Đã lưu trên máy này. Chưa đồng bộ sang thiết bị khác.');}
 tnSaving=false;closeModal();renderAll();focusPlace(id);if(currentUser.cloud)v781Refresh();
 }catch(err){const message=tnFriendly(err);toast('Chưa lưu: '+message);let box=$('tnSaveError');if(!box){box=document.createElement('p');box.id='tnSaveError';box.className='tn-error';form.prepend(box);}box.textContent=message;}
 finally{tnSaving=false;form.inert=false;if(btn){btn.disabled=false;btn.textContent='Lưu';}}
};
// Show private media on both desktop detail and the mobile resident list.
const tnOldDetail=showDetail;
showDetail=function(p){tnOldDetail(p);if(!p||!(v770IsAdmin()||v755AllowedTdp(p)))return;const detail=$('detail');if(!detail)return;detail.querySelector('.tn-private-detail')?.remove();const has=(p.documents||[]).length||v72ResidentArray(p).some(r=>r.photos.length);if(!has)return;
 detail.insertAdjacentHTML('beforeend',`<section class="tn-private-detail"><h3>Ảnh người cư trú</h3>${v72ResidentArray(p).filter(r=>r.photos.length).map(r=>`<div><b>${esc(r.name)}</b><div class="tn-media-list">${r.photos.map(m=>tnMediaImage(m,r.name)).join('')}</div></div>`).join('')||'<p>Chưa có ảnh người cư trú.</p>'}<h3>Giấy tờ cơ sở</h3><div class="tn-media-list">${(p.documents||[]).map(m=>tnMediaImage(m,'Giấy tờ')).join('')||'<p>Chưa có ảnh giấy tờ.</p>'}</div></section>`);tnHydrateMedia(detail);};
const tnOldRenderResidents=v753RenderResidents;
v753RenderResidents=function(rows){tnOldRenderResidents(rows);const box=$('v753ResidentTable');if(!box)return;const cards=box.querySelectorAll('.v780-resident-cards > button');rows.forEach((r,i)=>{if(cards[i]&&r.photos?.length)cards[i].insertAdjacentHTML('afterbegin',`<img class="tn-avatar" data-tn-media="${escAttr(JSON.stringify(r.photos[0]))}" alt="${escAttr(r.name)}">`);});tnHydrateMedia(box);};
// A shared list must not inherit unrelated map/list search filters.
const tnOldOpenResidents=v781OpenResidents;
v753OpenResidents=function(){const s=$('search'),st=$('statusFilter'),q=s?.value,status=st?.value;if(s)s.value='';if(st)st.value='';try{tnOldOpenResidents();}finally{if(s)s.value=q;if(st)st.value=status;}if(currentUser?.cloud)v781Refresh();};
v781RefreshResidentView=function(){if(!$('v753ResidentTable')||$('modal')?.classList.contains('hidden'))return;const ids=['v753rq','v780rs','v780tdp','v780place'],values=ids.map(id=>$(id)?.value||'');const s=$('search'),st=$('statusFilter'),q=s?.value,status=st?.value;if(s)s.value='';if(st)st.value='';try{tnOldOpenResidents();}finally{if(s)s.value=q;if(st)st.value=status;}ids.forEach((id,i)=>{if($(id))$(id).value=values[i];});v753FilterResidents();};
// Export includes IndexedDB image bytes, so migration/backup does not lose local photos.
function tnDownload(data,name){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
async function tnPortableMedia(m){if(!m.localId)return m;const b=await tnBlobGet(m.localId);if(!b)throw Error('Không tìm thấy ảnh cục bộ để sao lưu.');const out={...m,inline:await fileToDataUrl(b)};delete out.localId;return out;}
async function tnPortablePlaces(rows){const out=tnCopy(rows);for(const p of out){p.documents=await Promise.all((p.documents||[]).map(tnPortableMedia));for(const r of p.residents||[])r.photos=await Promise.all((r.photos||[]).map(tnPortableMedia));}return out;}
async function tnExportDraft(){if(tnMediaBusy)return toast('Chờ xử lý xong ảnh.');try{const id=String($('placeForm')?.getAttribute('onsubmit')?.match(/savePlace\(event,'([^']+)'/)[1]||tnId());tnDownload({version:TN_VERSION,draft:true,places:await tnPortablePlaces([tnReadPlace(id)])},'Ban_nhap_co_so.json');}catch(e){toast(tnFriendly(e));}}
async function tnExportDevice(){try{const raw=localStorage.getItem(STORE)||localStorage.getItem('thuynguyen_places_v4');const rows=raw?JSON.parse(raw):currentUser?.cloud?[]:places;tnDownload({version:TN_VERSION,source:'LOCAL',exportedAt:new Date().toISOString(),places:await tnPortablePlaces(rows)},'Sao_luu_du_lieu_may.json');toast('Đã xuất dữ liệu LOCAL của thiết bị này.');}catch(e){toast(tnFriendly(e));}}
let tnImportRows=[],tnImportPreview=[];
function tnChooseImport(){if(!currentUser?.cloud)return toast('Hãy đăng nhập email trước khi chuyển dữ liệu.');const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>100*1024*1024)throw Error('Bản sao lưu vượt 100 MB. Chia thành các file nhỏ hơn.');const parsed=JSON.parse(await file.text()),rows=Array.isArray(parsed)?parsed:parsed.places;if(!Array.isArray(rows)||rows.some(p=>!p||!p.id||typeof p.name!=='string'))throw Error('File không đúng định dạng sao lưu cơ sở.');tnImportRows=rows;if(!await loadCloudPlaces())throw Error(tnSync.error);tnShowImportPreview();}catch(e){toast(tnFriendly(e));}};input.click();}
function tnResidentIdentity(r){return r.cccd?'cccd:'+String(r.cccd).trim():[normSearch(r.name),r.birthYear||'',r.phone||''].join('|');}
function tnMergeLocal(cloud,local){
 if(!cloud)return {data:tnCopy(local),added:v781Residents(local).length,conflicts:0,isNew:true};
 const out=tnCopy(cloud);out.residents=v72ResidentArray(cloud);let added=0,conflicts=0;
 for(const incoming of v781Residents(local)){
  const key=tnResidentIdentity(incoming),same=v781Residents(out).find(r=>tnResidentIdentity(r)===key||(r.id&&r.id===incoming.id));
  if(same){const differs=['name','birthYear','cccd','phone','hometown','arrival','departure','status'].some(k=>same[k]&&incoming[k]&&String(same[k])!==String(incoming[k]));if(differs){conflicts++;continue;}
   const target=out.residents.find(r=>tnResidentIdentity(r)===tnResidentIdentity(same));if(target){for(const k of ['birthYear','cccd','phone','hometown','arrival','departure'])if(!target[k]&&incoming[k])target[k]=incoming[k];const media=new Map((target.photos||[]).map(m=>[m.id||m.path||m.localId,m]));for(const m of incoming.photos||[])media.set(m.id||m.path||m.localId,m);target.photos=[...media.values()];}continue;
  }
  // Ambiguous names without ID documents need manual reconciliation, not guessing.
  if(v781Residents(out).some(r=>normSearch(r.name)===normSearch(incoming.name)&&(!r.cccd||!incoming.cccd))){conflicts++;continue;}
  out.residents.push({...incoming,id:incoming.id||tnId()});added++;
 }
 const docs=new Map((out.documents||[]).map(m=>[m.id||m.path||m.localId,m]));for(const m of local.documents||[])docs.set(m.id||m.path||m.localId,m);out.documents=[...docs.values()];return {data:out,added,conflicts,isNew:false};
}
function tnShowImportPreview(){tnImportPreview=tnImportRows.map(local=>{const cloud=places.find(p=>String(p.id)===String(local.id)),allowed=cloud?tnCanEdit(cloud):v770IsAdmin();return {local,cloud,allowed,...tnMergeLocal(cloud,local),revision:cloud?tnSync.revisions.get(String(cloud.id)):null};});
 $('modalCard').innerHTML=`<div class="modal-head"><h2>Đối chiếu bản sao lưu</h2><button onclick="closeModal()">×</button></div><p>Chỉ bổ sung người còn thiếu, thông tin trống và ảnh. Giữ thông tin cơ sở đang có trên máy chủ. Người có thông tin khác nhau hoặc khó xác định được bỏ qua để đối chiếu thủ công. Bản sao lưu gốc vẫn được giữ nguyên.</p><div class="tn-import-list">${tnImportPreview.map((p,i)=>`<label><input type="checkbox" data-import-index="${i}" ${p.allowed?'':'disabled'}><span><b>${esc(p.local.name)}</b> · ${p.isNew?'Thêm cơ sở mới':`Bổ sung ${p.added} người`} · ${p.conflicts} trường hợp cần đối chiếu${!p.allowed?' · Không có quyền':''}</span></label>`).join('')}</div><button class="primary" onclick="tnRunImport(this)">Chuyển các cơ sở đã chọn</button><pre id="tnImportLog" class="tn-note"></pre>`;}
async function tnLocalizeImported(rows){for(const p of rows){const lists=[p.documents||[],...(p.residents||[]).map(r=>r.photos||[])];for(const list of lists)for(let i=0;i<list.length;i++){const m=list[i];if(m.inline){if(!/^data:image\/(jpeg|png|webp);base64,/i.test(m.inline))throw Error('Ảnh trong sao lưu không hợp lệ.');const blob=await(await fetch(m.inline)).blob(),safe=await tnPrepareImage(new File([blob],m.name||'photo.jpg',{type:blob.type}),list===p.documents?'document':'portrait');const id=m.id||tnId();await tnBlobPut(id,safe);list[i]={id,localId:id,name:m.name||'Ảnh',type:m.type||''};}}}return rows;}
async function tnRunImport(button){const selected=[...document.querySelectorAll('[data-import-index]:checked')].map(el=>tnImportPreview[Number(el.dataset.importIndex)]);if(!selected.length)return toast('Chọn ít nhất một cơ sở.');button.disabled=true;let success=0,failed=0;const log=$('tnImportLog');
 try{for(const item of selected){try{const obj=(await tnLocalizeImported([tnCopy(item.data)]))[0];for(const r of obj.residents||[])r.photos=await tnUploadMedia(r.photos,obj.id,'residents');obj.documents=await tnUploadMedia(obj.documents,obj.id,'documents');const saved=await tnWriteCloud(obj,item.revision);tnSync.revisions.set(String(obj.id),saved.revision);item.revision=saved.revision;success++;log.textContent+=`✓ ${obj.name}: đã chuyển; ${item.conflicts} trường hợp cần đối chiếu\n`;}catch(e){failed++;log.textContent+=`✕ ${item.local.name}: ${tnFriendly(e)}\n`;}}
 tnSync.generation++;if(await loadCloudPlaces())renderAll();log.textContent+=`Hoàn tất: ${success} thành công, ${failed} chưa chuyển. Các trường hợp cần đối chiếu vẫn nằm trong bản sao lưu.`;
 }finally{button.disabled=false;}}
// Existing generic import must not silently replace cloud with a local-only array.
const tnLegacyImport=importJson;
importJson=async function(e){if(currentUser?.cloud){e.target.value='';return toast('Dùng Đồng bộ → Chuyển bản sao lưu để đối chiếu và chuyển lên máy chủ.');}try{const file=e.target.files[0];if(!file)return;const parsed=JSON.parse(await file.text()),rows=Array.isArray(parsed)?parsed:parsed.places;if(!Array.isArray(rows))throw Error('Không có danh sách cơ sở.');await tnLocalizeImported(rows);localStorage.setItem(STORE,JSON.stringify(rows));places=rows;normalizePlaces();renderAll();toast('Đã nhập dữ liệu trên máy này.');}catch(err){toast(tnFriendly(err));}finally{e.target.value='';}};
// Never let the legacy seed button overwrite records already in the shared database.
seedCloud=function(){tnOpenSync();toast('Dùng chuyển bản sao lưu để bổ sung dữ liệu mà không ghi đè cơ sở hiện có.');};
// Coordinate resolution must patch GPS only; never write an old resident list back.
v763StoreGps=async function(place,r){const patch={lat:Number(r.lat),lng:Number(r.lng),coordinateSource:r.source||'google-map-link',coordinateUpdatedAt:new Date().toISOString(),...(r.finalUrl?{resolvedMapsUrl:r.finalUrl}:{})};if(currentUser?.cloud){
 const {data,error}=await supabaseClient.rpc('tn_patch_gps',{p_id:String(place.id),p_patch:patch});if(error)throw error;tnSync.generation++;Object.assign(place,data.data);const i=places.findIndex(p=>String(p.id)===String(place.id));if(i>=0)places[i]=data.data;tnSync.revisions.set(String(place.id),data.revision);
 }else{Object.assign(place,patch);persist();}};
v67SaveResolved=v763StoreGps;
const tnOldReset=resetData;resetData=function(){if(currentUser?.cloud)return toast('Không khôi phục dữ liệu mẫu trong chế độ dữ liệu chung.');return tnOldReset();};
exportJson=async function(){try{tnDownload({version:TN_VERSION,source:currentUser?.cloud?'CLOUD':'LOCAL',project:currentUser?.cloud?cfg.SUPABASE_URL:null,exportedAt:new Date().toISOString(),places:await tnPortablePlaces(tnScope())},'Sao_luu_ban_do_Thuy_Nguyen.json');}catch(e){toast(tnFriendly(e));}};
// Prevent modal replacement while the save is in progress.
const tnClose=closeModal;closeModal=function(){if(tnSaving)return toast('Đang lưu, vui lòng chờ.');return tnClose();};
