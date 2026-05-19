export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = context.params.path ? context.params.path.join('/') : '';
  
  const targetUrl = new URL(`http://mobiledev.advanceagro.net/ws/api/idms/${path}`);
  targetUrl.search = url.search;

  try {
    const response = await fetch(targetUrl.toString(), {
      method: context.request.method,
      headers: {
        'Accept': context.request.headers.get('Accept') || '*/*',
        'User-Agent': context.request.headers.get('User-Agent') || 'Cloudflare Worker',
      },
      body: context.request.method !== 'GET' && context.request.method !== 'HEAD' ? context.request.body : null
    });

    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    return newResponse;
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, url: targetUrl.toString() }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
