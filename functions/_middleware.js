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
      } else {
        // Fallback: attempt to retrieve from ASSET_INDEX (KV) if ASSETS unavailable
        let asset;
        if (env.ASSET_INDEX) {
          asset = await env.ASSET_INDEX.get(path);
        }
        if (!asset) {
          return new Response('Not found', { status: 404 });
        }
        const contentType = getContentType(path);
        return new Response(asset, { headers: { 'Content-Type': contentType } });
      }
    }

    // For HTML pages: always use the original static index.html from assets, then inject CMS data
    let html;
    if (env.ASSET_INDEX) {
      html = await env.ASSET_INDEX.get('/index.html');
    }

    if (!html) {
      console.error('HTML not found in ASSET_INDEX');
      return new Response('Not found: no HTML source', { status: 404 });
    }

    if (!html) {
      console.error('HTML not found in KV or ASSET_INDEX');
      return new Response('Not found: no HTML source', { status: 404 });
    }

    // Load all CMS data from KV
    const cmsKeys = await env.CMS.list();
    const cmsData = {};

    for (const key of cmsKeys.keys) {
      if (key.name !== 'index_html') {
        const value = await env.CMS.get(key.name);
        cmsData[key.name] = value || '';
      }
    }

    // Use HTMLRewriter to inject dynamic content
    const rewriter = new HTMLRewriter();

    rewriter.on('img[data-cms-id]', {
      element(element) {
        const cmsId = element.getAttribute('data-cms-id');
        if (cmsId && cmsData[cmsId]) {
          element.setAttribute('src', cmsData[cmsId]);
        }
      }
    });

    rewriter.on('h1[data-cms-id], h2[data-cms-id], h3[data-cms-id], p[data-cms-id], span[data-cms-id], div[data-cms-id], a[data-cms-id], button[data-cms-id], label[data-cms-id], strong[data-cms-id]', {
      element(element) {
        const cmsId = element.getAttribute('data-cms-id');
        if (cmsId && cmsData[cmsId]) {
          element.setInnerContent(cmsData[cmsId], { html: true });
        }
      }
    });

    rewriter.on('*[data-cms-bg]', {
      element(element) {
        const cmsId = element.getAttribute('data-cms-bg');
        if (cmsId && cmsData[cmsId]) {
          element.setAttribute('style', `--hero-bg: url('${cmsData[cmsId]}')`);
        }
      }
    });

    let rewrittenHtml;
    try {
      const response = new Response(html, {
        headers: { 'content-type': 'text/html;charset=UTF-8' }
      });
      const transformed = await rewriter.transform(response);
      rewrittenHtml = await transformed.text();
    } catch (e) {
      console.error('Rewriter error:', e);
      return new Response('Rewriter error: ' + e.message, { status: 500 });
    }

    return new Response(rewrittenHtml, {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
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
        <input type="password" id="password" class="w-full px-4 py-3 bg-brand-black border border-gray-700 rounded-lg focus:border-brand-gold focus:outline-none text-white" placeholder="Wprowadź hasło" required>
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
  "contact_intro",
  "footer_copyright","footer_subtitle","footer_address","header_logo","header_tagline",
  "realizacje_intro",
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
    .cms-field { margin-bottom: 1.5rem; }
    .cms-label { display: block; font-size: 0.875rem; color: #d4a84b; margin-bottom: 0.5rem; font-weight: 600; }
    .cms-input, .cms-textarea {
      width: 100%;
      padding: 0.75rem;
      background: #1a1a1a;
      border: 1px solid #374151;
      border-radius: 0.5rem;
      color: white;
      font-size: 0.875rem;
    }
    .cms-input:focus, .cms-textarea:focus {
      outline: none;
      border-color: #d4a84b;
    }
    .cms-textarea { min-height: 100px; resize: vertical; }
  </style>
</head>
<body class="bg-brand-black text-white p-6">
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex justify-between items-center mb-8 pb-6 border-b border-gray-800">
      <div>
        <h1 class="text-3xl font-bold text-brand-gold">Panel CMS</h1>
        <p class="text-gray-400 mt-1">Edytuj treści strony opas.com.pl</p>
      </div>
      <div class="flex gap-4">
        <button onclick="preview()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
          <i class="fas fa-eye mr-2"></i>Podgląd
        </button>
        <button onclick="logout()" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition">
          <i class="fas fa-sign-out-alt mr-2"></i>Wyloguj
        </button>
      </div>
    </div>

    <!-- Success Message -->
    <div id="successMessage" class="hidden mb-6 p-4 bg-green-900 border border-green-600 rounded text-green-300">
      Zmiany zapisane pomyślnie!
    </div>

    <!-- Fields -->
    <form id="cmsForm" class="grid md:grid-cols-2 gap-8">
      ${generateFormFields(cmsData)}
    </form>

    <!-- Save Button -->
    <div class="mt-12 pt-6 border-t border-gray-800">
      <button onclick="saveAll()" class="w-full md:w-auto px-8 py-4 bg-brand-gold text-brand-black font-bold rounded-lg hover:bg-opacity-90 transition text-lg">
        <i class="fas fa-save mr-2"></i>Zapisz wszystkie zmiany
      </button>
    </div>
  </div>

  <script>
    async function saveAll() {
      const formData = new FormData(document.getElementById('cmsForm'));
      const data = {};

      formData.forEach((value, key) => {
        data[key] = value;
      });

      const response = await fetch('/admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        document.getElementById('successMessage').classList.remove('hidden');
        setTimeout(() => {
          document.getElementById('successMessage').classList.add('hidden');
        }, 3000);
      }
    }

    function preview() {
      window.open('/', '_blank');
    }

    function logout() {
      fetch('/admin/logout', { method: 'POST' })
        .then(() => { window.location.href = '/admin'; });
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
}

function generateFormFields(cmsData) {
  const fields = [];

  for (const [key, value] of Object.entries(cmsData)) {
    const label = formatLabel(key);

    if (key.includes('bg_') || key.includes('_bg') || key.includes('background')) {
      fields.push(`
        <div class="cms-field bg-brand-gray p-6 rounded-lg border border-gray-800">
          <label class="cms-label">${label}</label>
          <input type="text" name="${key}" value="${escapeHtml(value)}" class="cms-input" placeholder="URL obrazka">
          <p class="text-gray-500 text-xs mt-2">Wprowadź URL obrazka (np. obrazek z serwera lub zewnętrzny link)</p>
        </div>
      `);
    } else if (key.includes('img') || key.includes('logo') || key.includes('photo') || key.includes('gallery')) {
      fields.push(`
        <div class="cms-field bg-brand-gray p-6 rounded-lg border border-gray-800">
          <label class="cms-label">${label}</label>
          <input type="text" name="${key}" value="${escapeHtml(value)}" class="cms-input" placeholder="URL obrazka">
          <p class="text-gray-500 text-xs mt-2">Wprowadź URL obrazka (np. obrazek z serwera lub zewnętrzny link)</p>
        </div>
      `);
    } else {
      fields.push(`
        <div class="cms-field bg-brand-gray p-6 rounded-lg border border-gray-800">
          <label class="cms-label">${label}</label>
          <textarea name="${key}" class="cms-textarea" placeholder="Treść tekstu">${escapeHtml(value)}</textarea>
        </div>
      `);
    }
  }

  return fields.join('\n      ');
}

function formatLabel(key) {
  // Convert snake_case to readable Polish labels
  const labels = {
    'hero_title': 'Tytuł główny (Hero)',
    'hero_subtitle': 'Podtytuł / opis (Hero)',
    'hero_bg_image': 'Obraz tła sekcji Hero',
    'hero_cta1': 'Przycisk CTA 1 (Hero)',
    'hero_cta2': 'Przycisk CTA 2 (Hero)',
    'about_title': 'Tytuł sekcji "O Nas"',
    'about_text1': 'Tekst about - akapit 1',
    'about_text2': 'Tekst about - akapit 2',
    'services_title': 'Tytuł sekcji "Oferta"',
    'services_intro': 'Wstęp do oferty',
    'service1_title': 'Nazwa usługi 1',
    'service1_desc': 'Opis usługi 1',
    'service2_title': 'Nazwa usługi 2',
    'service2_desc': 'Opis usługi 2',
    'service3_title': 'Nazwa usługi 3',
    'service3_desc': 'Opis usługi 3',
    'cta_title': 'Tytuł CTA banner',
    'cta_text': 'Tekst CTA banner',
    'equipment_title': 'Tytuł sekcji "Sprzęt"',
    'equipment_intro': 'Wstęp do sprzętu',
    'testimonials_title': 'Tytuł sekcji "Opinie"',
    'testimonials_intro': 'Wstęp do opinii',
    'testimonial1': 'Opinia 1',
    'testimonial2': 'Opinia 2',
    'testimonial3': 'Opinia 3',
    'faq_title': 'Tytuł sekcji "FAQ"',
    'faq_q1': 'Pytanie FAQ 1',
    'faq_a1': 'Odpowiedź FAQ 1',
    'faq_q2': 'Pytanie FAQ 2',
    'faq_a2': 'Odpowiedź FAQ 2',
    'faq_q3': 'Pytanie FAQ 3',
    'faq_a3': 'Odpowiedź FAQ 3',
    'faq_q4': 'Pytanie FAQ 4',
    'faq_a4': 'Odpowiedź FAQ 4',
    'contact_title': 'Tytuł sekcji "Kontakt"',
    'contact_intro': 'Wstęp do kontaktu',
    'footer_copyright': 'Copyright w stopce',
    'footer_subtitle': 'Podtytuł w stopce',
    'footer_address': 'Tekst adresu w stopce',
    'header_tagline': 'Podtytuł w headerze',
    'page_title': 'Tytuł strony',
    'page_description': 'Meta opis strony',
  };

  return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
