const $ = s => document.querySelector(s);

const KEY = '567_forever_demo_v1';
const PASSWORD = '567alwaystogether';

let unlocked = false;
let currentName = null;
let selectedImages = [];
let data;

try {
  data = JSON.parse(localStorage.getItem(KEY)) || {
    posts: [],
    messages: []
  };
} catch {
  data = { posts: [], messages: [] };
}

const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    alert('瀏覽器儲存空間不足，請減少照片大小或數量。');
    return false;
  }
};

const toast = msg => {
  const box = $('#toast');
  box.textContent = msg;
  box.style.display = 'block';
  setTimeout(() => box.style.display = 'none', 4000);
};

const el = (tag, cls = '', value) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (value !== undefined) n.textContent = value;
  return n;
};

const today = () => new Date().toLocaleDateString('en-CA');

const time = s => new Date(s).toLocaleString('zh-TW', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

function enter() {
  window.scrollTo(0, 0);
  unlocked = true;
  currentName = $('#identity').value;

  $('#homeScreen').hidden = true;
  $('#authSection').hidden = true;
  $('#privateArea').hidden = false;

  $('#hello').textContent = `${currentName} ♡（本機展示模式）`;

  renderPosts();
  renderMessages();
}

function leave() {
  unlocked = false;
  currentName = null;

  $('#privateArea').hidden = true;
  $('#homeScreen').hidden = false;
  $('#authSection').hidden = true;

  $('#password').value = '';
  $('#identity').value = '';
  $('#loginStatus').textContent = '';
}

$('#loginForm').addEventListener('submit', e => {
  e.preventDefault();

  if (
    $('#identity').value &&
    $('#password').value === PASSWORD
  ) {
    enter();
  } else {
    $('#loginStatus').textContent = '密碼不正確，請再試一次。';
  }
});

$('#logout').onclick = leave;
$('#backHome').onclick = leave;

$('#memoryBtn').onclick = () => {
  $('#homeScreen').hidden = true;
  $('#authSection').hidden = false;
  $('#privateArea').hidden = true;
  $('#password').focus();
  window.scrollTo(0, 0);
};

$('#newPost').onclick = () => $('#postDialog').showModal();

$('#closeDialog').onclick = () => $('#postDialog').close();

$('#memoryDate').value = today();

document.querySelectorAll('.tab').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => {
      x.classList.toggle('active', x === t);
    });

    $('#postsTab').hidden = t.dataset.tab !== 'posts';
    $('#chatTab').hidden = t.dataset.tab !== 'chat';
  };
});

$('#photos').onchange = () => {
  selectedImages = [];
  $('#previews').replaceChildren();

  for (const f of $('#photos').files) {
    const url = URL.createObjectURL(f);
    const im = el('img');
    im.src = url;
    $('#previews').append(im);
    selectedImages.push(f);
  }
};

function renderPosts() {
  const root = $('#postList');
  root.replaceChildren();

  if (!data.posts.length) {
    root.append(
      el('p', 'empty', '還沒有回憶，快來新增第一篇 ♡')
    );
    return;
  }

  for (const post of [...data.posts].reverse()) {
    const card = el('article', 'post-card');
    const stack = el('div', 'photo-stack');

    for (const src of post.photos) {
      const im = el('img');
      im.src = src;
      im.alt = post.title;
      stack.append(im);
    }

    card.append(
      stack,
      el('h3', '', post.title)
    );

    if (post.caption) {
      card.append(el('p', '', post.caption));
    }

    card.append(
      el(
        'div',
        'meta',
        `${post.author || '567'} · ${post.memoryDate} · 發布於 ${time(post.createdAt)}`
      )
    );

    root.append(card);
  }
}

const fileToDataURL = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

$('#postForm').onsubmit = async e => {
  e.preventDefault();
  if (!unlocked) return;

  const files = [...$('#photos').files];

  if (!files.length || files.length > 12) {
    return toast('請選擇 1–12 張照片');
  }

  if (files.some(f =>
    !f.type.startsWith('image/') ||
    f.size > 2 * 1024 * 1024
  )) {
    return toast('測試模式每張照片最多 2 MB');
  }

  const btn = $('#submitPost');
  btn.disabled = true;

  $('#postStatus').textContent = '正在儲存本機測試資料…';

  try {
    const photos = await Promise.all(files.map(fileToDataURL));

    data.posts.push({
      title: $('#title').value.trim(),
      caption: $('#caption').value.trim(),
      memoryDate: $('#memoryDate').value,
      createdAt: new Date().toISOString(),
      author: currentName,
      photos
    });

    if (!save()) {
      data.posts.pop();
      return;
    }

    $('#postDialog').close();
    $('#postForm').reset();
    $('#previews').replaceChildren();
    $('#memoryDate').value = today();

    renderPosts();
    toast('已儲存在這個瀏覽器 ♡');

  } catch (err) {
    $('#postStatus').textContent = '儲存失敗：' + err.message;
  } finally {
    btn.disabled = false;
  }
};

function renderMessages() {
  const root = $('#messageList');
  root.replaceChildren();

  for (const msg of data.messages) {
    const bubble = el(
      'div',
      'bubble' + (msg.author === currentName ? ' mine' : '')
    );

    bubble.append(
      el('small', '', `${msg.author || '567'} · ${time(msg.createdAt)}`),
      el('p', '', msg.body)
    );

    root.append(bubble);
  }

  root.scrollTop = root.scrollHeight;
}

$('#messageForm').onsubmit = e => {
  e.preventDefault();
  if (!unlocked) return;

  const input = $('#messageInput');
  const body = input.value.trim();

  if (!body) return;

  data.messages.push({
    body,
    author: currentName,
    createdAt: new Date().toISOString()
  });

  if (!save()) {
    data.messages.pop();
    return;
  }

  input.value = '';
  renderMessages();
};
(async () => {
  if (!location.hash.includes('access_token=')) return;

  const { createClient } = await import(
    'https://esm.sh/@supabase/supabase-js@2'
  );
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('./config.js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const params = new URLSearchParams(location.hash.slice(1));
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token')
  });

  if (sessionError) {
    alert('重設連結已失效，請重新寄送。');
    return;
  }

  history.replaceState(null, '', location.pathname);

  const password = prompt('請輸入要設定的新密碼（至少 6 個字元）：');
  if (!password) return;

  const { error } = await supabase.auth.updateUser({ password });

  alert(error ? '設定失敗：' + error.message : '密碼設定成功！');
  await supabase.auth.signOut();
})();
