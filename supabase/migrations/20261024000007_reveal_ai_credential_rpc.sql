-- The Next.js server reads keys through the Data API, which only exposes `public`.
-- This wrapper is executable by service_role alone; signed-in users and anon cannot call it.

CREATE FUNCTION public.reveal_ai_credential(p_org uuid, p_provider text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.reveal_ai_credential(p_org, p_provider);
$$;

REVOKE ALL ON FUNCTION public.reveal_ai_credential(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_ai_credential(uuid, text) TO service_role;
