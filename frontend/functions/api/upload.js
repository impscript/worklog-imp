/**
 * Cloudflare Pages API Endpoint: /api/upload
 * Handles POST requests for image uploads to R2.
 * Handles GET requests to serve uploaded files securely from R2.
 */

export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET Action: Serve image securely from R2
  if (context.request.method === 'GET') {
    try {
      const url = new URL(context.request.url);
      const filename = url.searchParams.get('filename');

      if (!filename) {
        return new Response(JSON.stringify({ error: 'Missing filename parameter' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check R2 Bucket Binding
      const bucket = context.env.WORKLOG_IMAGES;
      if (!bucket) {
        return new Response(JSON.stringify({ error: 'R2 Bucket WORKLOG_IMAGES binding is not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const object = await bucket.get(filename);
      if (!object) {
        return new Response('Image not found', { status: 404, headers: corsHeaders });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000');
      // Set CORS
      headers.set('Access-Control-Allow-Origin', '*');

      return new Response(object.body, { headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // POST Action: Upload file to R2
  if (context.request.method === 'POST') {
    try {
      const bucket = context.env.WORKLOG_IMAGES;
      if (!bucket) {
        return new Response(JSON.stringify({ error: 'R2 Bucket WORKLOG_IMAGES binding is not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const formData = await context.request.formData();
      const file = formData.get('file');

      if (!file) {
        return new Response(JSON.stringify({ error: 'No file provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Generate a unique filename
      const fileExt = file.name.split('.').pop() || 'jpg';
      const uniqueFilename = `${crypto.randomUUID()}.${fileExt}`;

      // Upload to Cloudflare R2
      const arrayBuffer = await file.arrayBuffer();
      await bucket.put(uniqueFilename, arrayBuffer, {
        httpMetadata: {
          contentType: file.type || 'image/jpeg',
        }
      });

      // Construct file access URL
      // If VITE_R2_PUBLIC_URL is defined, use it, otherwise fall back to relative proxy endpoint
      const publicBaseUrl = context.env.VITE_R2_PUBLIC_URL || '';
      const imageUrl = publicBaseUrl 
        ? `${publicBaseUrl}/${uniqueFilename}` 
        : `/api/upload?filename=${uniqueFilename}`;

      return new Response(JSON.stringify({
        success: true,
        filename: uniqueFilename,
        url: imageUrl
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}
