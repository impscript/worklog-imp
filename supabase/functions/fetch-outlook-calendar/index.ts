import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle Preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { outlookUrl } = await req.json();

    if (!outlookUrl) {
      throw new Error('Missing outlookUrl parameter');
    }

    // Verify it is a valid Outlook Office365 Calendar URL
    if (!outlookUrl.startsWith('https://outlook.office.com/') && !outlookUrl.startsWith('https://outlook.office365.com/')) {
      throw new Error('Invalid outlookUrl. Must be a published Outlook calendar URL from office.com or office365.com.');
    }

    console.log(`Fetching Outlook calendar from: ${outlookUrl}`);

    const calendarRes = await fetch(outlookUrl);

    if (!calendarRes.ok) {
      throw new Error(`Failed to fetch Outlook calendar. Status code: ${calendarRes.status}`);
    }

    const rawICS = await calendarRes.text();

    return new Response(JSON.stringify({ icsData: rawICS }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching calendar:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
