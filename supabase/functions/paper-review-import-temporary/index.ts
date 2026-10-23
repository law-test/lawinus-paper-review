import { createImporterHandler } from './importer-core.mjs';
import spec from './allowlist.json' with { type: 'json' };

// Deploy with verify_jwt=false: the route authenticates a strong temporary token,
// then verifies immutable object path, exact size and SHA256 before writing.
// Neither runtime secret is ever returned, logged, or persisted by this function.
Deno.serve(createImporterHandler(spec, {
  getRuntimeCredentials: () => ({
    url: Deno.env.get('SUPABASE_URL'),
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  }),
  fetch,
}));
