// Replace the deployed entrypoint with this file immediately after verification.
// This variant reads no secrets and makes no outbound requests.
Deno.serve(() => new Response(JSON.stringify({ error: 'Import completed; endpoint disabled' }), {
  status: 410,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
}));
