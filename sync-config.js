/* Public connection settings only. Auth passwords/tokens are managed by Supabase. */
(function(){
 try {
  const saved=JSON.parse(localStorage.getItem('tn_connection_v790')||'null');
  if(saved?.SUPABASE_URL&&saved?.SUPABASE_ANON_KEY)window.APP_CONFIG={...window.APP_CONFIG,...saved};
 } catch(_){}
})();
