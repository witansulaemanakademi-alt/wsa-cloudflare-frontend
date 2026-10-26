const ALLOWED_METHODS = new Set([
  'addGallery',
  'addNews',
  'authenticateAdmin',
  'beginPlayerEdit',
  'beginRegistration',
  'cancelPlayerEdit',
  'cancelRegistration',
  'changeAdminPassword',
  'changePlayerStatus',
  'clearTodayAttendance',
  'completeRegistration',
  'deleteEvaluationRecord',
  'deleteGalleryRecord',
  'deleteNewsRecord',
  'deletePlayerRecord',
  'finishPlayerEdit',
  'getAppStatus',
  'getPublicBootstrap',
  'getHomePageImage',
  'saveHomePageImage',
  'loadAdminData',
  'loadAdminDataForTab',
  'saveAgeCategories',
  'saveAttendance',
  'saveEvaluation',
  'saveNarrative',
  'searchPublicPlayers',
  'uploadPlayerEditFile',
  'uploadRegistrationFile'
]);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

async function handleApi(request, env) {
  if (request.method === 'GET') {
    return jsonResponse({
      ok: true,
      service: 'WSA Worker API proxy',
      message: 'API Cloudflare Worker aktif.'
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Metode HTTP tidak diizinkan.' }, 405);
  }

  if (!env.GAS_API_URL || !env.WSA_API_SECRET) {
    return jsonResponse({
      ok: false,
      error: 'Konfigurasi Worker belum lengkap. Atur GAS_API_URL dan WSA_API_SECRET pada Variables & Secrets.'
    }, 500);
  }

  let incoming;
  try {
    incoming = await request.json();
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Isi permintaan bukan JSON yang valid.' }, 400);
  }

  if (!incoming || typeof incoming.method !== 'string' || !ALLOWED_METHODS.has(incoming.method)) {
    return jsonResponse({ ok: false, error: 'Metode API tidak diizinkan.' }, 400);
  }
  if (!Array.isArray(incoming.args)) {
    return jsonResponse({ ok: false, error: 'Argumen API harus berupa array.' }, 400);
  }

  const payload = {
    apiSecret: env.WSA_API_SECRET,
    method: incoming.method,
    args: incoming.args
  };

  try {
    const upstream = await fetch(env.GAS_API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const raw = await upstream.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return jsonResponse({
        ok: false,
        error: 'Apps Script tidak mengembalikan JSON. Pastikan GAS_API_URL adalah URL Web App /exec terbaru, Api.gs sudah dipasang, dan deployment sudah diperbarui.'
      }, 502);
    }

    return jsonResponse(data, upstream.ok ? 200 : 502);
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: 'Tidak dapat terhubung ke Google Apps Script: ' + String(err && err.message ? err.message : err)
    }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return handleApi(request, env);
    }

    if (!env.ASSETS) {
      return new Response('Binding ASSETS tidak dikonfigurasi. Periksa wrangler.jsonc.', {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=UTF-8' }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
