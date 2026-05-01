// Cloudflare Pages Middleware - Smart CMS
// Handles dynamic content injection from KV and admin panel

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Admin routes
  if (path === '/admin' || path === '/admin/') {
    return handleAdmin(request, env);
  }

  if (path === '/admin/login') {
    return handleLogin(request, env);
  }

  if (path === '/admin/save') {
    return handleSave(request, env);
  }

  if (path === '/admin/logout') {
    return handleLogout(request, env);
  }

  // All other routes - serve static HTML with CMS injection
  return handleStaticWithCMS(request, env);
}

async function handleStaticWithCMS(request, env) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // Extensions that should be served as static assets (not processed by CMS)
    const staticExtensions = [
      '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
      '.ico', '.woff', '.woff2', '.ttf', '.eot', '.json', '.xml', '.txt',
      '.map', '.pdf', '.mp4', '.webm', '.ogg'
    ];

    const isStaticAsset = staticExtensions.some(ext => path.endsWith(ext));

    if (isStaticAsset) {
      // Serve static files via the ASSETS binding (direct static file serving)
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      } else if (env.ASSET_INDEX) {
        // Fallback: fetch from ASSET_INDEX
        const asset = await env.ASSET_INDEX.get(path);
        if (!asset) {
          return new Response('Not found', { status: 404 });
        }
        const contentType = getContentType(path);
        return new Response(asset, { headers: { 'Content-Type': contentType } });
      } else {
        return new Response('Static assets not available', { status: 500 });
      }
    }

    // For HTML pages: fetch the original index.html from assets, then inject CMS data
    let response;
    if (env.ASSETS) {
      response = await env.ASSETS.fetch(request);
    } else if (env.ASSET_INDEX) {
      const asset = await env.ASSET_INDEX.get('/index.html');
      if (!asset) {
        return new Response('Not found: index.html missing', { status: 404 });
      }
      response = new Response(asset, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    } else {
      return new Response('Asset storage not configured', { status: 500 });
    }

    // Load all CMS data from KV
    const cmsKeys = await env.CMS.list();
    const cmsData = {};

    for (const key of cmsKeys.keys) {
      // Skip index_html if present
      if (key.name !== 'index_html') {
        const value = await env.CMS.get(key.name);
        cmsData[key.name] = value || '';
      }
    }

    // Use HTMLRewriter to inject dynamic content into the response
    const rewriter = new HTMLRewriter();

    // Inject image sources - ONLY change src, preserve all other attributes
    rewriter.on('img[data-cms-id]', {
      element(element) {
        const cmsId = element.getAttribute('data-cms-id');
        if (cmsId && cmsData[cmsId]) {
          element.setAttribute('src', cmsData[cmsId]);
        }
      }
    });

    // Inject text content for specific elements
    rewriter.on('h1[data-cms-id], h2[data-cms-id], h3[data-cms-id], p[data-cms-id], span[data-cms-id], div[data-cms-id], a[data-cms-id], button[data-cms-id], label[data-cms-id], strong[data-cms-id]', {
      element(element) {
        const cmsId = element.getAttribute('data-cms-id');
        if (cmsId && cmsData[cmsId]) {
          element.setInnerContent(cmsData[cmsId], { html: true });
        }
      }
    });

    // Inject background images via CSS variable
    rewriter.on('*[data-cms-bg]', {
      element(element) {
        const cmsId = element.getAttribute('data-cms-bg');
        if (cmsId && cmsData[cmsId]) {
          element.setAttribute('style', `--hero-bg: url('${cmsData[cmsId]}')`);
        }
      }
    });

    let rewrittenResponse;
    try {
      rewrittenResponse = await rewriter.transform(response);
    } catch (e) {
      console.error('Rewriter error:', e);
      return new Response('Rewriter error: ' + e.message, { status: 500 });
    }

    return rewrittenResponse;
  } catch (error) {
    console.error('CMS Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Helper to determine Content-Type based on file extension
function getContentType(path) {
  const ext = path.split('.').pop().toLowerCase();
  const types = {
    'css': 'text/css',
    'js': 'application/javascript',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject',
    'json': 'application/json',
    'xml': 'application/xml',
    'txt': 'text/plain',
    'map': 'application/json',
    'pdf': 'application/pdf',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogg': 'audio/ogg',
  };
  return types[ext] || 'application/octet-stream';
}

async function handleAdmin(request, env) {
  // Check if admin is logged in via session cookie
  const sessionCookie = request.headers.get('cookie') || '';
  const isLoggedIn = sessionCookie.includes('admin_session=valid');

  if (!isLoggedIn) {
    // Show login page
    return loginPage();
  }

  // Show admin panel
  return adminPanel(request, env);
}

function loginPage() {
  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel Administracyjny - OPAS CMS</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Inter', sans-serif; background: #0a0a0a; }
  </style>
</head>
<body class="bg-brand-black text-white min-h-screen flex items-center justify-center">
  <div class="max-w-md w-full p-8">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-brand-gold mb-2">Panel Administracyjny</h1>
      <p class="text-gray-400">Maciej Opas - Kostka Brukowa</p>
    </div>

    <form id="loginForm" class="bg-brand-gray p-8 rounded-lg border border-gray-800">
      <div class="mb-6">
        <label class="block text-sm font-medium mb-2">Hasło</label>
        <input type="password" id="password" class="w-full px-4 py-3 bg-black border-2 border-brand-gold rounded-lg focus:border-white focus:outline-none text-white placeholder-gray-400" placeholder="Wprowadź hasło" required>
      </div>
      <button type="submit" class="w-full bg-brand-gold text-brand-black py-3 rounded-lg font-bold hover:bg-opacity-90 transition">
        Zaloguj się
      </button>
      <div id="errorMsg" class="mt-4 text-red-500 text-center hidden"></div>
    </form>

    <script>
      document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;
        const response = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });

        if (response.ok) {
          window.location.href = '/admin';
        } else {
          document.getElementById('errorMsg').classList.remove('hidden');
          document.getElementById('errorMsg').textContent = 'Nieprawidłowe hasło';
        }
      });
    </script>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
}

async function handleLogin(request, env) {
  const { password } = await request.json();

  // Verify password (from env var or KV stored secret)
  const adminPassword = env.ADMIN_PASSWORD || 'Opas!@2';

  if (password !== adminPassword) {
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Set session cookie (24h expiry)
  const response = new Response(JSON.stringify({ success: true }), {
    headers: {
      'content-type': 'application/json',
      'Set-Cookie': 'admin_session=valid; Path=/; Max-Age=86400; HttpOnly',
    },
  });

  return response;
}

// Predefined list of all CMS field IDs discovered from index.html
const ALL_CMS_FIELDS = [
  "hero_title","hero_subtitle","hero_cta1","hero_cta2","hero_bg_image",
  "about_title","about_text1","about_text2","about_img1","about_img2",
  "services_intro","service1_title","service1_desc","service1_img",
  "service2_title","service2_desc","service2_img",
  "service3_title","service3_desc","service3_img",
  "cta_title","cta_text",
  "equipment_intro","equipment1_img","equipment2_img","equipment3_img",
  "testimonials_intro","testimonial1","testimonial2","testimonial3",
  "faq_title","faq_q1","faq_a1","faq_q2","faq_a2","faq_q3","faq_a3","faq_q4","faq_a4",
  "contact_intro","contact_phone","contact_email",
  "footer_copyright","footer_subtitle","footer_address","header_logo","header_tagline",
  "realizacje_intro","realizacje_title",
  "gallery_1","gallery_10","gallery_11","gallery_12","gallery_13","gallery_14","gallery_15","gallery_16","gallery_17","gallery_18","gallery_19","gallery_20","gallery_2","gallery_3","gallery_4","gallery_5","gallery_6","gallery_7","gallery_8","gallery_9"
];

async function adminPanel(request, env) {
  // Get all CMS data from KV
  const cmsKeys = await env.CMS.list();
  const cmsData = {};

  for (const key of cmsKeys.keys) {
    if (key.name !== 'index_html') {
      const value = await env.CMS.get(key.name);
      cmsData[key.name] = value || '';
    }
  }

  // Ensure all known fields exist in cmsData (empty string if not yet saved)
  for (const fieldId of ALL_CMS_FIELDS) {
    if (!(fieldId in cmsData)) {
      cmsData[fieldId] = '';
    }
  }

  // Generate admin panel HTML
  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel CMS - OPAS</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background: #0a0a0a; }
    .cms-input, .cms-textarea {
      width: 100%;
      padding: 0.75rem;
      background: #1a1a1a;
      border: 2px solid #374151;
      border-radius: 0.5rem;
      color: white;
      font-size: 0.875rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .cms-input:focus, .cms-textarea:focus {
      outline: none;
      border-color: #d4a84b;
      box-shadow: 0 0 0 3px rgba(212, 168, 75, 0.2);
    }
    .cms-textarea { min-height: 120px; resize: vertical; }
    .section-card {
      background: linear-gradient(145deg, #1a1a1a 0%, #0f0f0f 100%);
      border: 1px solid #2a2a2a;
      border-radius: 1rem;
      padding: 2rem;
      margin-bottom: 2rem;
      transition: border-color 0.3s, box-shadow 0.3s;
    }
    .section-card:hover {
      border-color: #d4a84b40;
    }
    .section-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #d4a84b;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #d4a84b30;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .field-group {
      margin-bottom: 1.5rem;
      padding: 1.25rem;
      background: #0a0a0a;
      border-radius: 0.75rem;
      border: 1px solid #1f1f1f;
    }
    .field-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      color: #e5e5e5;
      margin-bottom: 0.5rem;
    }
    .field-hint {
      font-size: 0.75rem;
      color: #9ca3af;
      margin-top: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .btn-generate {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #374151;
      color: white;
      border-radius: 0.5rem;
      font-size: 0.75rem;
      text-decoration: none;
      transition: background 0.2s;
      margin-top: 0.5rem;
    }
    .btn-generate:hover {
      background: #4b5563;
    }
    .btn-save-section {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: #d4a84b;
      color: black;
      border: none;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      margin-top: 1rem;
    }
    .btn-save-section:hover {
      background: #b8923a;
      transform: translateY(-1px);
    }
    .btn-save-section.saved {
      background: #10b981;
      color: white;
    }
    .btn-save-section.saved i {
      animation: checkBounce 0.5s ease;
    }
    @keyframes checkBounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.3); }
    }
    .title-hint-box {
      margin-top: 0.75rem;
      padding: 1rem;
      background: linear-gradient(135deg, #1e3a5f 0%, #0f2942 100%);
      border-left: 4px solid #60a5fa;
      border-radius: 0.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .title-hint-box .hint-header {
      font-size: 1.125rem;
      font-weight: 700;
      color: #fef3c7;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .title-hint-box .option-label {
      font-weight: 600;
      color: #60a5fa;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }
    .title-hint-box .option-desc {
      color: #e0f2fe;
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
      line-height: 1.4;
    }
    .title-hint-box .code-box {
      background: #0a0a0a;
      border: 2px solid #374151;
      border-radius: 0.5rem;
      padding: 0.875rem 1rem;
      margin: 0.5rem 0 1rem 0;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 0.8125rem;
      color: #a5f3fc;
      position: relative;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
      cursor: pointer;
      transition: all 0.2s;
      line-height: 1.5;
    }
    .title-hint-box .code-box:hover {
      border-color: #60a5fa;
      background: #111111;
    }
    .title-hint-box .code-box::before {
      content: '📋';
      position: absolute;
      top: 0.5rem;
      right: 0.75rem;
      opacity: 0.4;
      font-size: 0.875rem;
    }
    .title-hint-box .explanation {
      color: #9ca3af;
      font-size: 0.8125rem;
      margin-top: 0.75rem;
      line-height: 1.5;
      padding: 0.75rem;
      background: rgba(0,0,0,0.2);
      border-radius: 0.375rem;
      border-left: 3px solid #60a5fa;
    }
    .title-hint-box .explanation strong {
      color: #e5e5e5;
    }
    .copy-feedback {
      position: fixed;
      top: 1rem;
      left: 50%;
      transform: translateX(-50%) translateY(-100%);
      background: #10b981;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1000;
      font-weight: 600;
      animation: copySlideDown 0.3s ease forwards;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    @keyframes copySlideDown {
      from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes copySlideUp {
      from { transform: translateX(-50%) translateY(0); opacity: 1; }
      to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
    }
    .success-toast {
      position: fixed;
      top: 1rem;
      right: 1rem;
      background: #10b981;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 0.5rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1000;
      animation: slideIn 0.3s ease;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .admin-header {
      background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
      border-bottom: 1px solid #d4a84b30;
      padding: 1.5rem 0;
      margin-bottom: 2rem;
    }
    @keyframes checkBounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.3); }
    }
    .title-hint-box {
      margin-top: 0.75rem;
      padding: 1rem;
      background: linear-gradient(135deg, #1e3a5f 0%, #0f2942 100%);
      border-left: 4px solid #60a5fa;
      border-radius: 0.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .title-hint-box p {
      margin-bottom: 0.75rem;
      color: #e0f2fe;
      font-size: 0.875rem;
      line-height: 1.5;
    }
    .title-hint-box .example-box {
      background: #0a0a0a;
      border: 1px solid #374151;
      border-radius: 0.5rem;
      padding: 0.875rem 1rem;
      margin: 0.75rem 0;
      font-family: 'Inter', monospace;
      font-size: 0.875rem;
      color: #fef3c7;
      position: relative;
      overflow-x: auto;
      white-space: nowrap;
    }
    .title-hint-box .example-box::before {
      content: '📋';
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      opacity: 0.5;
      font-size: 0.875rem;
    }
    .title-hint-box .example-code {
      color: #fef3c7;
      display: inline;
    }
    .title-hint-box .gold-word {
      color: #d4a84b;
      font-weight: 600;
      display: inline;
    }
    .title-hint-box .explanation {
      color: #9ca3af;
      font-size: 0.8125rem;
      margin-top: 0.5rem;
      font-style: italic;
    }
    .success-toast {
      position: fixed;
      top: 1rem;
      right: 1rem;
      background: #10b981;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 0.5rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1000;
      animation: slideIn 0.3s ease;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .admin-header {
      background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
      border-bottom: 1px solid #d4a84b30;
      padding: 1.5rem 0;
      margin-bottom: 2rem;
    }
  </style>
</head>
<body class="bg-brand-black text-white">
  <div class="max-w-6xl mx-auto px-4 py-8">

    <!-- Admin Header -->
    <div class="admin-header rounded-2xl mb-8">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4 px-6">
        <div>
          <h1 class="text-3xl font-bold text-brand-gold flex items-center gap-3">
            <i class="fas fa-cogs"></i>
            Panel CMS
          </h1>
          <p class="text-gray-400 mt-1">Edytuj treści strony Maciej Opas - Kostka Brukowa</p>
        </div>
        <div class="flex gap-3">
          <button onclick="preview()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
            <i class="fas fa-eye"></i>
            <span class="hidden sm:inline">Podgląd</span>
          </button>
          <button onclick="logout()" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2">
            <i class="fas fa-sign-out-alt"></i>
            <span class="hidden sm:inline">Wyloguj</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Instruction Banner -->
    <div class="mb-8 p-6 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-2 border-blue-500/50 rounded-xl shadow-lg">
      <div class="flex items-start gap-4">
        <div class="text-2xl mt-1">💡</div>
        <div class="flex-1">
          <h3 class="text-lg font-bold text-blue-300 mb-2">Instrukcja</h3>
          <p class="text-gray-200 leading-relaxed mb-3">
            <strong class="text-white">Aby dodać zdjęcie:</strong> Kliknij przycisk "Generuj link z pliku", wgraj plik na zewnętrzny serwer (postimages.org), skopiuj <em>"Link bezpośredni"</em> i wklej go w pole tekstowe.
          </p>
          <p class="text-gray-300 leading-relaxed mb-3">
            <strong class="text-white">Zapisywanie zmian:</strong> Po każdej edycji w danej sekcji musisz kliknąć przycisk <span class="inline-block px-2 py-1 bg-brand-gold text-black font-semibold rounded text-sm mx-1">Zapisz sekcję</span>, aby zmiany zostały opublikowane na stronie.
          </p>
          <p class="text-blue-200 leading-relaxed">
            <strong class="text-white">💡 Wskazówka kolorystyczna:</strong> W sekcjach tytułowych możesz używać kodu <code class="inline-block bg-black/50 px-2 py-0.5 rounded text-sm text-brand-gold border border-gray-700">&lt;span class="text-brand-gold"&gt;...&lt;/span&gt;</code> (szczegóły znajdziesz bezpośrednio pod polami edycji tytułów).
          </p>
        </div>
      </div>
    </div>

    <!-- Success Toast -->
    <div id="toast" class="hidden">
      <i class="fas fa-check-circle text-xl"></i>
      <span>Zapisano pomyślnie!</span>
    </div>

    <!-- CMS Form Sections -->
    <form id="cmsForm">
      ${generateSections(cmsData)}
    </form>

  </div>

  <script>
    // Section-based save function
    async function saveSection(sectionId, btn) {
      const section = document.getElementById(sectionId);
      const inputs = section.querySelectorAll('input, textarea');
      const data = {};
      
      inputs.forEach(input => {
        if (input.name) {
          data[input.name] = input.value;
        }
      });

      const response = await fetch('/admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });

      if (response.ok) {
        // Visual feedback
        const originalContent = btn.innerHTML;
        btn.classList.add('saved');
        btn.innerHTML = '<i class="fas fa-check"></i> Zapisano!';
        btn.disabled = true;
        
        setTimeout(() => {
          btn.classList.remove('saved');
          btn.innerHTML = originalContent;
          btn.disabled = false;
        }, 2000);

        // Show toast
        showToast();
      }
    }

    function showToast() {
      const toast = document.getElementById('toast');
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    function preview() {
      window.open('/', '_blank');
    }

    function logout() {
      fetch('/admin/logout', { method: 'POST' })
        .then(() => { window.location.href = '/admin'; });
    }

    // Open postimages.org in new tab
    function openPostimages() {
      window.open('https://postimages.org/', '_blank');
    }

    // Copy code snippet to clipboard
    function copyToClipboard(element) {
      const codeToCopy = element.getAttribute('data-copy');
      navigator.clipboard.writeText(codeToCopy).then(() => {
        showCopyFeedback();
      }).catch(err => {
        console.error('Failed to copy: ', err);
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = codeToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showCopyFeedback();
      });
    }

    function showCopyFeedback() {
      // Remove existing feedback if any
      const existing = document.getElementById('copyFeedback');
      if (existing) existing.remove();

      const feedback = document.createElement('div');
      feedback.id = 'copyFeedback';
      feedback.className = 'copy-feedback';
      feedback.innerHTML = '<i class="fas fa-check"></i> Skopiowano!';
      document.body.appendChild(feedback);

      setTimeout(() => {
        feedback.style.animation = 'copySlideUp 0.3s ease forwards';
        setTimeout(() => feedback.remove(), 300);
      }, 1500);
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
}

// Section definitions with field groupings
const CMS_SECTIONS = [
  {
    id: 'hero',
    title: 'Sekcja Hero & Header',
    icon: 'fas fa-home',
    fields: ['hero_title', 'hero_subtitle', 'hero_cta1', 'hero_cta2', 'hero_bg_image', 'header_logo', 'header_tagline'],
    imageFields: ['hero_bg_image', 'header_logo'],
    titleFields: ['hero_title', 'header_tagline'],
    fieldLabels: {
      'hero_title': 'Tytuł główny strony (Hero)',
      'hero_subtitle': 'Podtytuł / opis sekcji Hero',
      'hero_cta1': 'Tekst przycisku CTA 1 (Hero)',
      'hero_cta2': 'Tekst przycisku CTA 2 (Hero)',
      'hero_bg_image': 'Obraz tła sekcji Hero (zdjęcie główne)',
      'header_logo': 'Logo firmy (header)',
      'header_tagline': 'Podtytuł pod logo (np. "Kostka Brukowa")'
    },
    imageSizes: {
      'hero_bg_image': 'Rekomendowane: 1920x1080px (Full HD)',
      'header_logo': 'Rekomendowane: 300x300px (przezroczyste PNG)'
    }
  },
  {
    id: 'realizacje',
    title: 'Sekcja Realizacje',
    icon: 'fas fa-images',
    fields: ['realizacje_title', 'realizacje_intro'],
    imageFields: [],
    titleFields: ['realizacje_title'],
    fieldLabels: {
      'realizacje_title': 'Tytuł sekcji Realizacje',
      'realizacje_intro': 'Wstępny opis pod tytułem sekcji Realizacje'
    }
  },
  {
    id: 'about',
    title: 'Sekcja O Nas',
    icon: 'fas fa-users',
    fields: ['about_title', 'about_text1', 'about_text2', 'about_img1', 'about_img2'],
    imageFields: ['about_img1', 'about_img2'],
    titleFields: ['about_title'],
    fieldLabels: {
      'about_title': 'Tytuł sekcji "O Nas"',
      'about_text1': 'Tekst - akapit 1 (kim jesteśmy, misja)',
      'about_text2': 'Tekst - akapit 2 (doświadczenie, zasięg)',
      'about_img1': 'Zdjęcie w sekcji O Nas #1 (główne)',
      'about_img2': 'Zdjęcie w sekcji O Nas #2 (dodatkowe)'
    },
    imageSizes: {
      'about_img1': 'Rekomendowane: 800x600px',
      'about_img2': 'Rekomendowane: 800x600px'
    }
  },
  {
    id: 'services',
    title: 'Sekcja Oferta',
    icon: 'fas fa-concierge-bell',
    fields: ['services_title', 'services_intro', 'service1_title', 'service1_desc', 'service1_img', 'service2_title', 'service2_desc', 'service2_img', 'service3_title', 'service3_desc', 'service3_img', 'cta_title', 'cta_text'],
    imageFields: ['service1_img', 'service2_img', 'service3_img'],
    titleFields: ['services_title', 'service1_title', 'service2_title', 'service3_title', 'cta_title'],
    fieldLabels: {
      'services_title': 'Tytuł sekcji Oferta',
      'services_intro': 'Wstępny opis oferty (pod tytułem)',
      'service1_title': 'Nazwa usługi 1',
      'service1_desc': 'Opis usługi 1',
      'service1_img': 'Zdjęcie usługi 1 (kostka brukowa)',
      'service2_title': 'Nazwa usługi 2',
      'service2_desc': 'Opis usługi 2',
      'service2_img': 'Zdjęcie usługi 2 (ogrodzenia)',
      'service3_title': 'Nazwa usługi 3',
      'service3_desc': 'Opis usługi 3',
      'service3_img': 'Zdjęcie usługi 3 (układanie kostki)',
      'cta_title': 'Tytuł banera CTA (na dole oferty)',
      'cta_text': 'Tekst banera CTA'
    },
    imageSizes: {
      'service1_img': 'Rekomendowane: 800x600px',
      'service2_img': 'Rekomendowane: 800x600px',
      'service3_img': 'Rekomendowane: 800x600px'
    }
  },
  {
    id: 'equipment',
    title: 'Sekcja Sprzęt',
    icon: 'fas fa-truck',
    fields: ['equipment_intro', 'equipment1_img', 'equipment2_img', 'equipment3_img'],
    imageFields: ['equipment1_img', 'equipment2_img', 'equipment3_img'],
    titleFields: [],
    fieldLabels: {
      'equipment_intro': 'Wstęp do sekcji Sprzęt',
      'equipment1_img': 'Sprzęt 1 - zdjęcie maszyny',
      'equipment2_img': 'Sprzęt 2 - zdjęcie maszyny',
      'equipment3_img': 'Sprzęt 3 - zdjęcie maszyny'
    },
    imageSizes: {
      'equipment1_img': 'Rekomendowane: 800x600px',
      'equipment2_img': 'Rekomendowane: 800x600px',
      'equipment3_img': 'Rekomendowane: 800x600px'
    }
  },
  {
    id: 'gallery',
    title: 'Galeria Realizacji',
    icon: 'fas fa-images',
    fields: ['gallery_1','gallery_2','gallery_3','gallery_4','gallery_5','gallery_6','gallery_7','gallery_8','gallery_9','gallery_10','gallery_11','gallery_12','gallery_13','gallery_14','gallery_15','gallery_16','gallery_17','gallery_18','gallery_19','gallery_20'],
    imageFields: ['gallery_1','gallery_2','gallery_3','gallery_4','gallery_5','gallery_6','gallery_7','gallery_8','gallery_9','gallery_10','gallery_11','gallery_12','gallery_13','gallery_14','gallery_15','gallery_16','gallery_17','gallery_18','gallery_19','gallery_20'],
    titleFields: [],
    fieldLabels: (key) => `Galeria - zdjęcie nr ${key.replace('gallery_', '')}`,
    imageSizes: (key) => 'Rekomendowane: 800x600px'
  },
  {
    id: 'testimonials',
    title: 'Opinie Klientów',
    icon: 'fas fa-star',
    fields: ['testimonials_intro', 'testimonial1', 'testimonial2', 'testimonial3'],
    imageFields: [],
    titleFields: [],
    fieldLabels: {
      'testimonials_intro': 'Wstęp do sekcji Opinie',
      'testimonial1': 'Treść opinii 1',
      'testimonial2': 'Treść opinii 2',
      'testimonial3': 'Treść opinii 3'
    }
  },
  {
    id: 'faq',
    title: 'FAQ - Pytania i Odpowiedzi',
    icon: 'fas fa-question-circle',
    fields: ['faq_title', 'faq_q1', 'faq_a1', 'faq_q2', 'faq_a2', 'faq_q3', 'faq_a3', 'faq_q4', 'faq_a4'],
    imageFields: [],
    titleFields: ['faq_title'],
    fieldLabels: {
      'faq_title': 'Tytuł sekcji FAQ',
      'faq_q1': 'Pytanie 1',
      'faq_a1': 'Odpowiedź 1',
      'faq_q2': 'Pytanie 2',
      'faq_a2': 'Odpowiedź 2',
      'faq_q3': 'Pytanie 3',
      'faq_a3': 'Odpowiedź 3',
      'faq_q4': 'Pytanie 4',
      'faq_a4': 'Odpowiedź 4'
    }
  },
  {
    id: 'contact',
    title: 'Sekcja Kontakt',
    icon: 'fas fa-phone',
    fields: ['contact_intro', 'contact_phone', 'contact_email'],
    imageFields: [],
    titleFields: [],
    fieldLabels: {
      'contact_intro': 'Wstępny tekst pod tytułem sekcji Kontakt',
      'contact_phone': 'Numer telefonu (do wyświetlenia)',
      'contact_email': 'Adres email (do wyświetlenia)'
    }
  },
  {
    id: 'footer',
    title: 'Stopka (Footer)',
    icon: 'fas fa-shoe-prints',
    fields: ['footer_copyright', 'footer_subtitle', 'footer_address'],
    imageFields: [],
    titleFields: ['footer_subtitle'],
    fieldLabels: {
      'footer_copyright': 'Tekst copyright (np. "© 2026 Maciej Opas...")',
      'footer_subtitle': 'Podtytuł w stopce (np. "Kostka Brukowa") - możliwość kolorowania',
      'footer_address': 'Adres / zasięg działania'
    }
  }
];

function generateSections(cmsData) {
  return CMS_SECTIONS.map(section => {
    const sectionId = section.id;
    const title = section.title;
    const icon = section.icon;
    
    // Show ALL fields defined in section, even if not in cmsData yet (use empty string)
    const fieldsHtml = section.fields.map(fieldKey => {
      const value = cmsData[fieldKey] || '';
      const isImage = section.imageFields.includes(fieldKey);
      const isTitle = section.titleFields && section.titleFields.includes(fieldKey);
      const label = typeof section.fieldLabels === 'function' 
        ? section.fieldLabels(fieldKey) 
        : (section.fieldLabels[fieldKey] || formatLabel(fieldKey));
      const sizeHint = section.imageSizes 
        ? (typeof section.imageSizes === 'function' 
            ? section.imageSizes(fieldKey) 
            : section.imageSizes[fieldKey])
        : null;

      if (isImage) {
        return `
        <div class="field-group">
          <label class="field-label">${label}</label>
          <input type="text" 
                 name="${fieldKey}" 
                 value="${escapeHtml(value)}" 
                 class="cms-input" 
                 placeholder="https://przyklad.com/zdjecie.jpg">
          ${sizeHint ? `<p class="field-hint"><i class="fas fa-info-circle"></i> ${sizeHint}</p>` : ''}
          <a href="https://postimages.org/" target="_blank" class="btn-generate" onclick="openPostimages()">
            <i class="fas fa-camera"></i> Generuj link z pliku
          </a>
        </div>`;
      } else {
        // Title field with enhanced HTML hint - two copy options
        const titleHint = isTitle ? `
          <div class="title-hint-box">
            <p class="hint-header">
              ✨ Jak zrobić złoty napis?
            </p>
            
            <div class="option-a" style="margin-bottom: 1rem;">
              <p class="option-label"><span style="display:inline-flex;align-items:center;justify-content:center;width:1.25rem;height:1.25rem;background:#60a5fa;color:#0a0a0a;border-radius:50%;font-weight:700;font-size:0.75rem;margin-right:0.5rem;">A</span>Skopiuj sam kod koloru:</p>
              <p class="option-desc">(wklej go w edytor i zmień napis wewnątrz)</p>
              <div class="code-box" onclick="copyToClipboard(this)" data-copy="<span class=\"text-brand-gold\">TU TWOJE SŁOWO</span>">
                &lt;span class="text-brand-gold"&gt;TU TWOJE SŁOWO&lt;/span&gt;
              </div>
            </div>
            
            <div class="option-b" style="margin-bottom: 1rem;">
              <p class="option-label"><span style="display:inline-flex;align-items:center;justify-content:center;width:1.25rem;height:1.25rem;background:#60a5fa;color:#0a0a0a;border-radius:50%;font-weight:700;font-size:0.75rem;margin-right:0.5rem;">B</span>Przykład gotowego całego zdania:</p>
              <p class="option-desc">(skopiuj całość i dostosuj do swoich potrzeb)</p>
              <div class="code-box" onclick="copyToClipboard(this)" data-copy="Kompleksowa Usługa <span class=\"text-brand-gold\">Brukarska</span>">
                Kompleksowa Usługa &lt;span class="text-brand-gold"&gt;Brukarska&lt;/span&gt;
              </div>
            </div>
            
            <div class="explanation">
              <strong>💡 Jak używać:</strong> Skopiuj wybrany kod, wklej go w pole edycji tytułu i zamień napis 
              <code style="background:rgba(0,0,0,0.3);padding:0.125rem 0.375rem;border-radius:0.25rem;color:#a5f3fc;">"TU TWOJE SŁOWO"</code> lub 
              <code style="background:rgba(0,0,0,0.3);padding:0.125rem 0.375rem;border-radius:0.25rem;color:#a5f3fc;">"Brukarska"</code> 
              na własny tekst. Dzięki temu wybrany wyraz będzie złoty na stronie. <strong>Nie usuwaj znaczników &lt; &gt;</strong>.
            </div>
          </div>
        ` : '';
        
        return `
        <div class="field-group">
          <label class="field-label">${label}</label>
          <textarea name="${fieldKey}" class="cms-textarea" placeholder="Treść...">${escapeHtml(value)}</textarea>
          ${titleHint}
        </div>`;
      }
    }).join('');

    return `
      <section id="${sectionId}" class="section-card">
        <h2 class="section-title">
          <i class="${icon}"></i>
          ${title}
        </h2>
        <div class="grid md:grid-cols-2 gap-6">
          ${fieldsHtml}
        </div>
        <button type="button" 
                class="btn-save-section" 
                onclick="saveSection('${sectionId}', this)">
          <i class="fas fa-save"></i>
          Zapisz sekcję
        </button>
      </section>
    `;
  }).join('\n      ');
}

function formatLabel(key) {
  // Fallback: convert snake_case to readable
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function handleSave(request, env) {
  const body = await request.json();

  // Support both { "data": {...} } and direct { "key": "value" }
  const data = body.data || body;

  // Save each field to KV
  for (const [key, value] of Object.entries(data)) {
    if (value && value.trim() !== '') {
      await env.CMS.put(key, value.trim());
    } else {
      await env.CMS.delete(key);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'content-type': 'application/json' },
  });
}

async function handleLogout(request, env) {
  const response = new Response(JSON.stringify({ success: true }), {
    headers: {
      'content-type': 'application/json',
      'Set-Cookie': 'admin_session=; Path=/; Max-Age=0; HttpOnly',
    },
  });
  return response;
}
