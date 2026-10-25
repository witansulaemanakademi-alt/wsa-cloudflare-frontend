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
      'cache-control': 'no-store'
    }
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') {
    return jsonResponse({ ok: true, service: 'WSA API proxy', message: 'API Cloudflare aktif.' });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Metode HTTP tidak diizinkan.' }, 405);
  }

  if (!env.GAS_API_URL || !env.WSA_API_SECRET) {
    return jsonResponse({ ok: false, error: 'Konfigurasi server belum lengkap. Atur GAS_API_URL dan WSA_API_SECRET pada Cloudflare Pages.' }, 500);
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

  const gasPayload = {
    apiSecret: env.WSA_API_SECRET,
    method: incoming.method,
    args: incoming.args
  };

  try {
    const upstream = await fetch(env.GAS_API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(gasPayload),
      redirect: 'follow'
    });
    const raw = await upstream.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return jsonResponse({
        ok: false,
        error: 'Apps Script tidak mengembalikan JSON. Pastikan GAS_API_URL adalah URL Web App /exec terbaru dan akses deployment mengizinkan permintaan API.'
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
