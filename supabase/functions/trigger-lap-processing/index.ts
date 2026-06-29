// Supabase Edge Function: the only thing this does is fire a GitHub Actions
// repository_dispatch event so the lap-detection worker runs. The GitHub PAT
// lives only here (as a Supabase secret, set via `supabase secrets set`) —
// it never reaches the browser bundle. See .github/workflows/lap-detection.yml
// for what runs on the other end, and server/process-session.ts for the
// actual work.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TriggerRequest = {
  sessionId?: unknown;
  drillId?: unknown;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let body: TriggerRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Request body must be JSON.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { sessionId, drillId } = body;
  if (typeof sessionId !== 'string' || !sessionId || typeof drillId !== 'string' || !drillId) {
    return new Response(JSON.stringify({ error: 'sessionId and drillId are required strings.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const githubPat = Deno.env.get('GITHUB_PAT');
  const githubRepo = Deno.env.get('GITHUB_REPO');
  if (!githubPat || !githubRepo) {
    return new Response(JSON.stringify({ error: 'Server is not configured to trigger processing.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const githubResponse = await fetch(`https://api.github.com/repos/${githubRepo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubPat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'lap-detection-process',
      client_payload: { sessionId, drillId },
    }),
  });

  if (!githubResponse.ok) {
    const detail = await githubResponse.text();
    return new Response(JSON.stringify({ error: `GitHub dispatch failed (${githubResponse.status}): ${detail}` }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
