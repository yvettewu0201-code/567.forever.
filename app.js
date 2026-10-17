import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Three existing Supabase accounts; no password or secret key is stored in this file.
const ACCOUNTS = {
  'Yvette': 'yvettewu0201@gmail.com',
  '小兮': 'fayma1127@gmail.com',
  '沁': 'chinjui414414@gmail.com'
};
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);
const el = (tag, cls = '', value) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (value !== undefined) n.textContent = value;
  return n;
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const time = s => new Date(s).toLocaleString('zh-TW', {dateStyle:'medium', timeStyle:'short'});
const toast = msg => {
  const n = $('#toast'); n.textContent = msg; n.style.display = 'block';
  clearTimeout(toast.timer); toast.timer = setTimeout(() => n.style.display = 'none', 4000);
};
let currentUser = null;
let member = null;
let channels = [];
let previewUrls = [];
let loginBusy = false;
let loadingPosts = false;
let reloadPosts = false;

function showHome() {
  $('#homeScreen').hidden = false;
  $('#authSection').hidden = true;
  $('#privateArea').hidden = true;
  window.scrollTo(0,0);
}
function showLogin() {
  $('#homeScreen').hidden = true;
  $('#authSection').hidden = false;
  $('#privateArea').hidden = true;
  window.scrollTo(0,0);
}
function showPrivate() {
  $('#homeScreen').hidden = true;
  $('#authSection').hidden = true;
  $('#privateArea').hidden = false;
  $('#hello').textContent = `${member.display_name} ♡`;
  window.scrollTo(0,0);
}
async function cleanupChannels() {
  const old = channels; channels = [];
  await Promise.all(old.map(c => db.removeChannel(c)));
}
async function activateSession(user) {
  currentUser = user;
  const {data, error} = await db.from('members')
    .select('id,display_name').eq('id',user.id).maybeSingle();
  if (error || !data) {
    currentUser = null; member = null;
    $('#loginStatus').textContent = '此帳號尚未列入三人名單，請確認 Supabase members 資料。';
    await db.auth.signOut();
    showLogin();
    return;
  }
  member = data;
  $('#identity').value = data.display_name;
  showPrivate();
  await Promise.all([loadPosts(), loadMessages()]);
  await cleanupChannels();
  const channel = db.channel('567-cloud-updates')
    .on('postgres_changes', {event:'*',schema:'public',table:'posts'}, () => loadPosts())
    .on('postgres_changes', {event:'*',schema:'public',table:'post_photos'}, () => loadPosts())
    .on('postgres_changes', {event:'*',schema:'public',table:'messages'}, () => loadMessages())
    .subscribe();
  channels.push(channel);
}

$('#memoryBtn').onclick = async () => {
  const {data:{session}} = await db.auth.getSession();
  if (session?.user) await activateSession(session.user);
  else showLogin();
};
$('#backHome').onclick = showHome;
$('#logout').onclick = async () => {
  await cleanupChannels();
  await db.auth.signOut();
  currentUser = null; member = null;
  $('#password').value = '';
  $('#identity').value = '';
  $('#loginStatus').textContent = '';
  showHome();
};
$('#loginForm').onsubmit = async e => {
  e.preventDefault();
  if (loginBusy) return;
  const name = $('#identity').value;
  const password = $('#password').value;
  if (!ACCOUNTS[name] || !password) return;
  loginBusy = true;
  const button = $('#loginForm button[type="submit"]');
  button.disabled = true;
  $('#loginStatus').textContent = '正在登入…';
  try {
    const {data,error} = await db.auth.signInWithPassword({email:ACCOUNTS[name],password});
    if (error) throw error;
    if (!data.user) throw new Error('登入未成功');
    if (data.user.email?.toLowerCase() !== ACCOUNTS[name]) {
      await db.auth.signOut();
      throw new Error('選擇的名字與登入帳號不一致');
    }
    $('#password').value = '';
    $('#loginStatus').textContent = '';
    await activateSession(data.user);
  } catch (err) {
    $('#loginStatus').textContent = '登入失敗：' + (err.message === 'Invalid login credentials' ? '這個帳號尚未設定相同的密碼，或密碼不正確。' : err.message);
  } finally {
    loginBusy = false;
    button.disabled = false;
  }
};

document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active',x === t));
  $('#postsTab').hidden = t.dataset.tab !== 'posts';
  $('#chatTab').hidden = t.dataset.tab !== 'chat';
});
$('#newPost').onclick = () => $('#postDialog').showModal();
$('#closeDialog').onclick = () => $('#postDialog').close();
$('#memoryDate').value = today();
$('#photos').onchange = () => {
  previewUrls.forEach(URL.revokeObjectURL);
  previewUrls = [];
  $('#previews').replaceChildren();
  for (const f of $('#photos').files) {
    const url = URL.createObjectURL(f);
    previewUrls.push(url);
    const img = el('img'); img.src = url; img.alt = f.name;
    $('#previews').append(img);
  }
};
async function signedUrl(path) {
  const {data,error} = await db.storage.from('memories').createSignedUrl(path,3600);
  if (error) return null;
  return data.signedUrl;
}
async function loadPosts() {
  if (!member) return;
  if (loadingPosts) { reloadPosts = true; return; }
  loadingPosts = true;
  try {
    const {data,error} = await db.from('posts')
      .select('id,title,caption,memory_date,created_at,author_id,members(display_name),post_photos(storage_path,sort_order)')
      .order('created_at',{ascending:false});
    if (!member) return;
    const root = $('#postList'); root.replaceChildren();
    if (error) throw error;
    if (!data?.length) {
      root.append(el('p','empty','還沒有回憶，快來新增第一篇 ♡'));
      return;
    }
    for (const post of data) {
      const card = el('article','post-card');
      const stack = el('div','photo-stack');
      const photos = [...(post.post_photos || [])].sort((a,b) => a.sort_order-b.sort_order);
      for (const photo of photos) {
        const url = await signedUrl(photo.storage_path);
        if (url) {
          const img = el('img'); img.src = url; img.alt = post.title; img.loading = 'lazy';
          stack.append(img);
        }
      }
      card.append(stack,el('h3','',post.title));
      if (post.caption) card.append(el('p','',post.caption));
      card.append(el('div','meta',`${post.members?.display_name || '我們'} · ${post.memory_date} · 發布於 ${time(post.created_at)}`));
      root.append(card);
    }
  } catch (err) {
    $('#postList').replaceChildren(el('p','empty','無法讀取回憶：' + err.message));
  } finally {
    loadingPosts = false;
    if (reloadPosts) {reloadPosts = false; void loadPosts();}
  }
}
$('#postForm').onsubmit = async e => {
  e.preventDefault();
  if (!member || !currentUser) return;
  const files = [...$('#photos').files];
  if (files.length < 1 || files.length > 12) return toast('每篇請選擇 1–12 張照片');
  const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
  if (files.some(f => !allowed.includes(f.type) || f.size > 10*1024*1024))
    return toast('只支援 JPG、PNG、WebP、GIF，每張最多 10 MB');
  const btn = $('#submitPost'); btn.disabled = true;
  $('#postStatus').textContent = '正在建立回憶…';
  try {
    const {data:post,error:postError} = await db.from('posts').insert({
      author_id:currentUser.id,
      title:$('#title').value.trim(),
      caption:$('#caption').value.trim(),
      memory_date:$('#memoryDate').value
    }).select('id').single();
    if (postError) throw postError;
    const records = [];
    for (let i=0;i<files.length;i++) {
      const file = files[i];
      const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
      const path = `${currentUser.id}/${post.id}/${crypto.randomUUID()}.${ext}`;
      const {error} = await db.storage.from('memories').upload(path,file,{contentType:file.type,upsert:false});
      if (error) throw error;
      records.push({post_id:post.id,storage_path:path,sort_order:i});
      $('#postStatus').textContent = `上傳照片 ${i+1}/${files.length}…`;
    }
    const {error:photoError} = await db.from('post_photos').insert(records);
    if (photoError) throw photoError;
    $('#postDialog').close(); $('#postForm').reset();
    $('#previews').replaceChildren();
    previewUrls.forEach(URL.revokeObjectURL); previewUrls = [];
    $('#memoryDate').value = today();
    $('#postStatus').textContent = '';
    toast('回憶已保存到雲端 ♡');
    await loadPosts();
  } catch (err) {
    $('#postStatus').textContent = '上傳失敗：' + err.message + '（若文章已建立，可能留下未完成的文章。）';
  } finally {btn.disabled = false;}
};
async function loadMessages() {
  if (!member) return;
  const {data,error} = await db.from('messages')
    .select('id,body,created_at,author_id,members(display_name)')
    .order('created_at',{ascending:false}).limit(300);
  if (!member) return;
  const root = $('#messageList'); root.replaceChildren();
  if (error) {root.append(el('p','', '無法讀取聊天：' + error.message));return;}
  for (const msg of (data || []).reverse()) {
    const bubble = el('div','bubble' + (msg.author_id === currentUser.id ? ' mine' : ''));
    bubble.append(el('small','',`${msg.members?.display_name || '朋友'} · ${time(msg.created_at)}`),el('p','',msg.body));
    root.append(bubble);
  }
  root.scrollTop = root.scrollHeight;
}
$('#messageForm').onsubmit = async e => {
  e.preventDefault();
  if (!member || !currentUser) return;
  const input = $('#messageInput');
  const body = input.value.trim();
  if (!body) return;
  const button = $('#messageForm button[type="submit"]'); button.disabled = true;
  try {
    const {error} = await db.from('messages').insert({author_id:currentUser.id,body});
    if (error) throw error;
    input.value = '';
    await loadMessages();
  } catch (err) {toast('訊息未送出：' + err.message);}
  finally {button.disabled = false;}
};
// Keep the landing page visible on refresh. A previously authenticated session
// is reused only when the user clicks the memory button.
showHome();
