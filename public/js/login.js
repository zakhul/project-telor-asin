let portal = 'customer';
const nextParam = new URLSearchParams(location.search).get('next');

// Mencegah pengalihan ke halaman admin dari login pelanggan (dan sebaliknya)
function safeNext() {
  if (!nextParam || !nextParam.startsWith('/') || nextParam.startsWith('//') || nextParam.startsWith('/admin')) return '/';
  return nextParam;
}
function goAfterLogin(user) {
  location.href = user.role === 'admin' ? '/admin.html' : safeNext();
}
function showMsg(t) { $('msg').textContent = t; }

// Jika sudah login, langsung arahkan
(async () => {
  const me = await currentUser();
  if (me) goAfterLogin(me);
})();

document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
  portal = btn.dataset.portal;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
  $('register-box').classList.toggle('hidden', portal === 'admin');
  showMsg('');
}));

$('btn-show-reg').onclick = () => $('form-register').classList.toggle('hidden');

$('form-login').onsubmit = async e => {
  e.preventDefault();
  showMsg('');
  const f = e.target;
  try {
    const { user } = await api('/api/auth/login', {
      method: 'POST',
      body: { email: f.email.value, password: f.password.value, portal },
    });
    goAfterLogin(user);
  } catch (err) {
    showMsg(err.message);
  }
};

$('form-register').onsubmit = async e => {
  e.preventDefault();
  showMsg('');
  const body = Object.fromEntries(new FormData(e.target));
  try {
    await api('/api/auth/register', { method: 'POST', body });
    location.href = safeNext();
  } catch (err) {
    showMsg(err.message);
  }
};
