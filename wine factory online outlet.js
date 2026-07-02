// Single-file Wine Outlet demo: server + frontend in one file
// Usage: npm install express cookie-parser uuid
//        ADMIN_PASSWORD=yourpass AGE_LIMIT=21 node server.js

const express = require('express');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin-secret';
const AGE_LIMIT = parseInt(process.env.AGE_LIMIT || '21', 10);
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(cookieParser());

// In-memory sample wines (keeps state only while server runs)
let wines = [
  { id: uuidv4(), name: 'Ruby Reserve Cabernet', type: 'Red', age: 3, price: 1200, description: 'Bold red with notes of cherry.' },
  { id: uuidv4(), name: 'Golden Valley Chardonnay', type: 'White', age: 2, price: 950, description: 'Crisp white, citrus aroma.' },
  { id: uuidv4(), name: 'Sunset Rosé', type: 'Rosé', age: 1, price: 700, description: 'Light and floral.' }
];

// API: list wines
app.get('/api/wines', (req, res) => {
  res.json(wines);
});

// API: admin add wine (header x-admin-password or body.adminPassword)
app.post('/api/admin/wines', (req, res) => {
  const pw = req.headers['x-admin-password'] || req.body.adminPassword;
  if (!pw || pw !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: invalid admin password' });
  }
  const { name, type, age, price, description } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'Missing required fields: name and price' });
  const newWine = { id: uuidv4(), name, type: type || 'Table Wine', age: age || null, price: Number(price), description: description || '' };
  wines.push(newWine);
  res.status(201).json(newWine);
});

// API: age verification (dateOfBirth YYYY-MM-DD OR ageConfirmed boolean)
app.post('/api/verify-age', (req, res) => {
  const { dateOfBirth, ageConfirmed } = req.body;
  if (ageConfirmed === true) {
    res.cookie('ageVerified', 'true', { maxAge: 1000 * 60 * 60 * 24 * 30 });
    return res.json({ ok: true, verified: true, reason: 'confirmed' });
  }
  if (!dateOfBirth) return res.status(400).json({ error: 'Provide dateOfBirth (YYYY-MM-DD) or ageConfirmed' });
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return res.status(400).json({ error: 'Invalid dateOfBirth format' });
  const now = new Date();
  let ageYears = now.getFullYear() - dob.getFullYear();
  const hasBirthdayHappened = (now.getMonth() > dob.getMonth()) || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hasBirthdayHappened) ageYears -= 1;
  if (ageYears >= AGE_LIMIT) {
    res.cookie('ageVerified', 'true', { maxAge: 1000 * 60 * 60 * 24 * 30 });
    return res.json({ ok: true, verified: true, age: ageYears });
  } else {
    res.cookie('ageVerified', 'false', { maxAge: 1000 * 60 * 60 * 24 * 30 });
    return res.json({ ok: false, verified: false, age: ageYears });
  }
});

// API: checkout requires ageVerified cookie true
app.post('/api/checkout', (req, res) => {
  const ageVerified = req.cookies.ageVerified === 'true';
  if (!ageVerified) return res.status(403).json({ error: 'Age verification required to checkout' });
  const { cart } = req.body;
  if (!Array.isArray(cart) || cart.length === 0) return res.status(400).json({ error: 'Cart is empty or invalid' });
  const total = cart.reduce((s, item) => s + (Number(item.price || 0) * (item.quantity || 1)), 0);
  // Demo: no persistence or payments
  return res.json({ ok: true, message: 'Order placed (demo)', total });
});

// Serve single-page app inline
app.get('/', (req, res) => {
  res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Wine Factory Outlet (Demo)</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body { font-family: Arial, sans-serif; margin:0; padding:0; background:#fafafa;}
    header { background: #6a2c70; color: white; padding: 16px; display:flex; justify-content:space-between; align-items:center;}
    main { display: grid; grid-template-columns: 1fr 320px; gap: 20px; padding: 20px; }
    #wine-list { display:flex; flex-direction:column; gap:12px;}
    .wine { border:1px solid #ddd; padding:12px; background:white; border-radius:6px;}
    button { background:#6a2c70; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; }
    button:disabled { opacity:0.6; cursor:not-allowed; }
    .modal { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6); }
    .modal-content { background:white; padding:20px; border-radius:6px; min-width:320px; }
    .error { color: red; margin-top:8px; }
    #age-modal.hidden { display:none; }
    form input, form button { display:block; margin:8px 0; padding:8px; width:100%; box-sizing:border-box; }
  </style>
</head>
<body>
  <header>
    <h1>Wine Factory Outlet</h1>
    <div id="age-status"></div>
  </header>

  <main>
    <section id="wines">
      <h2>Available Wines</h2>
      <div id="wine-list">Loading wines...</div>
    </section>

    <aside>
      <section id="cart">
        <h2>Cart</h2>
        <div id="cart-contents">Cart is empty</div>
        <div id="cart-total"></div>
        <button id="checkout-btn">Checkout</button>
      </section>

      <section id="admin" style="margin-top:20px;">
        <h3>Admin: Add Wine</h3>
        <form id="add-wine-form">
          <input name="name" placeholder="Name" required />
          <input name="type" placeholder="Type" />
          <input name="age" placeholder="Age (years)" />
          <input name="price" placeholder="Price (INR)" required />
          <input name="description" placeholder="Description" />
          <input name="adminPassword" placeholder="Admin password" />
          <button type="submit">Add Wine</button>
        </form>
        <div id="admin-msg"></div>
      </section>
    </aside>
  </main>

  <div id="age-modal" class="modal">
    <div class="modal-content">
      <h3>Age Verification</h3>
      <p>Please confirm you're of legal drinking age (minimum ${AGE_LIMIT}).</p>
      <label>Enter date of birth: <input type="date" id="dob" /></label>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button id="verify-dob">Verify DOB</button>
        <button id="confirm-21">I confirm I am ${AGE_LIMIT}+</button>
      </div>
      <div id="age-error" class="error"></div>
    </div>
  </div>

  <script>
    (function () {
      const ageModal = document.getElementById('age-modal');
      const dobInput = document.getElementById('dob');
      const verifyDobBtn = document.getElementById('verify-dob');
      const confirm21Btn = document.getElementById('confirm-21');
      const ageError = document.getElementById('age-error');
      const ageStatus = document.getElementById('age-status');

      let cart = [];

      function readCookie(name) {
        const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
        return m ? m.pop() : '';
      }
      function showAgeModal() { ageModal.classList.remove('hidden'); }
      function hideAgeModal() { ageModal.classList.add('hidden'); }
      function setAgeStatus(text) { ageStatus.textContent = text; }

      const cookieVerified = readCookie('ageVerified');
      if (cookieVerified === 'true') {
        setAgeStatus('Age verified');
        hideAgeModal();
      } else {
        setAgeStatus('Age not verified');
        showAgeModal();
      }

      async function loadWines() {
        const res = await fetch('/api/wines');
        const wines = await res.json();
        const list = document.getElementById('wine-list');
        list.innerHTML = '';
        wines.forEach(w => {
          const div = document.createElement('div');
          div.className = 'wine';
          div.innerHTML = '<strong>' + w.name + '</strong> <em>(' + (w.type||'') + ')</em>' +
            '<div>' + (w.description || '') + '</div>' +
            '<div>Age: ' + (w.age || 'N/A') + ' year(s)</div>' +
            '<div>Price: ₹' + w.price + '</div>' +
            '<div><button data-id="' + w.id + '" data-name="' + (w.name) + '" data-price="' + w.price + '">Add to cart</button></div>';
          list.appendChild(div);
        });
        document.querySelectorAll('.wine button').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.dataset.id, name = btn.dataset.name, price = Number(btn.dataset.price);
            const existing = cart.find(it => it.id === id);
            if (existing) existing.quantity += 1; else cart.push({ id, name, price, quantity: 1 });
            renderCart();
          });
        });
      }

      function renderCart() {
        const cDiv = document.getElementById('cart-contents');
        if (cart.length === 0) {
          cDiv.textContent = 'Cart is empty';
          document.getElementById('cart-total').textContent = '';
          return;
        }
        cDiv.innerHTML = cart.map(it => '<div>' + it.name + ' x' + it.quantity + ' - ₹' + (it.price * it.quantity) + '</div>').join('');
        const total = cart.reduce((s, it) => s + it.price * it.quantity, 0);
        document.getElementById('cart-total').textContent = 'Total: ₹' + total;
      }

      document.getElementById('checkout-btn').addEventListener('click', async () => {
        const cv = readCookie('ageVerified');
        if (cv !== 'true') {
          alert('You must verify your age before checkout.');
          showAgeModal();
          return;
        }
        const res = await fetch('/api/checkout', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ cart }) });
        if (res.ok) {
          const body = await res.json();
          alert('Success: ' + (body.message || 'Order placed') + ' Total: ₹' + body.total);
          cart = []; renderCart();
        } else {
          const err = await res.json();
          alert('Checkout failed: ' + (err.error || 'Unknown'));
        }
      });

      verifyDobBtn.addEventListener('click', async () => {
        ageError.textContent = '';
        const dob = dobInput.value;
        if (!dob) { ageError.textContent = 'Please pick your date of birth.'; return; }
        try {
          const res = await fetch('/api/verify-age', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ dateOfBirth: dob }) });
          const data = await res.json();
          if (data.verified) { hideAgeModal(); setAgeStatus('Age verified'); alert('Age verified. You may shop.'); }
          else { ageError.textContent = 'Not old enough. Age calculated: ' + (data.age || 'N/A'); setAgeStatus('Age not verified'); }
        } catch (e) { ageError.textContent = 'Verification failed.'; }
      });

      confirm21Btn.addEventListener('click', async () => {
        const ok = confirm('Do you confirm that you are at least ${AGE_LIMIT} years old?');
        if (!ok) return;
        try {
          const res = await fetch('/api/verify-age', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ageConfirmed: true }) });
          const data = await res.json();
          if (data.verified) { hideAgeModal(); setAgeStatus('Age verified (self-confirmed)'); alert('Thanks — age confirmed.'); }
          else ageError.textContent = 'Verification failed.';
        } catch (e) { ageError.textContent = 'Verification error.'; }
      });

      document.getElementById('add-wine-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target; const form = new FormData(f);
        const payload = { name: form.get('name'), type: form.get('type'), age: form.get('age') ? Number(form.get('age')) : null, price: form.get('price'), description: form.get('description') };
        const adminPassword = form.get('adminPassword');
        try {
          const res = await fetch('/api/admin/wines', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword || '' }, body: JSON.stringify(payload) });
          const data = await res.json();
          if (res.ok) { document.getElementById('admin-msg').textContent = 'Wine added: ' + data.name; f.reset(); loadWines(); }
          else { document.getElementById('admin-msg').textContent = 'Error: ' + (data.error || 'unknown'); }
        } catch (err) { document.getElementById('admin-msg').textContent = 'Request failed'; }
      });

      loadWines(); renderCart();
    })();
  </script>
</body>
</html>`);
});

// Start server
app.listen(PORT, () => {
  console.log(\`Wine outlet single-file app listening on port \${PORT}\`);
  console.log(\`Default age limit is \${AGE_LIMIT}. Set AGE_LIMIT and ADMIN_PASSWORD env vars to override.\`);
});