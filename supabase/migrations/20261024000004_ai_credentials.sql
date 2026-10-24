-- User-supplied AI provider keys, stored encrypted in Supabase Vault per organisation.
--
-- The table holds only metadata (provider, label, last four characters). Admins set
-- and remove keys through SECURITY DEFINER functions; nothing callable by a signed-in
-- user ever returns the key. Only service_role (the Next.js server, after its own
-- membership check) can read the decrypted key, via private.reveal_ai_credential.

CREATE TABLE public.ai_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('groq', 'anthropic', 'openai')),
  label text,
  key_hint text NOT NULL,                 -- last four characters, for display only
  vault_secret_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);

ALTER TABLE public.ai_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_credentials_member_read ON public.ai_credentials
  FOR SELECT TO authenticated USING ((SELECT private.is_member(org_id)));
-- No INSERT/UPDATE/DELETE policies: writes only through the functions below.

CREATE FUNCTION public.set_ai_credential(p_org uuid, p_provider text, p_key text, p_label text DEFAULT NULL)
RETURNS public.ai_credentials
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_existing public.ai_credentials;
  v_secret uuid;
  v_row public.ai_credentials;
  v_key text := trim(p_key);
BEGIN
  IF NOT private.has_role(p_org, ARRAY['admin']) THEN
    RAISE EXCEPTION 'only organisation admins can manage AI keys' USING ERRCODE = '42501';
  END IF;
  IF p_provider NOT IN ('groq', 'anthropic', 'openai') THEN
    RAISE EXCEPTION 'unsupported provider %', p_provider USING ERRCODE = '22023';
  END IF;
  IF v_key IS NULL OR length(v_key) < 16 OR length(v_key) > 512 OR v_key ~ '\s' THEN
    RAISE EXCEPTION 'that does not look like an API key' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing FROM public.ai_credentials WHERE org_id = p_org AND provider = p_provider FOR UPDATE;
  IF FOUND THEN
    PERFORM vault.update_secret(v_existing.vault_secret_id, v_key);
    UPDATE public.ai_credentials
       SET key_hint = right(v_key, 4), label = p_label, updated_at = now()
     WHERE id = v_existing.id
     RETURNING * INTO v_row;
  ELSE
    v_secret := vault.create_secret(v_key, 'ai_key:' || p_org || ':' || p_provider, 'User-supplied AI key');
    INSERT INTO public.ai_credentials (org_id, provider, label, key_hint, vault_secret_id, created_by)
    VALUES (p_org, p_provider, p_label, right(v_key, 4), v_secret, (SELECT auth.uid()))
    RETURNING * INTO v_row;
  END IF;

  INSERT INTO public.audit_events (org_id, actor_id, action, entity_type, entity_id, request_id)
  VALUES (p_org, (SELECT auth.uid()), 'ai_credential.set', 'ai_credential', v_row.id, 'db');
  RETURN v_row;
END;
$$;

CREATE FUNCTION public.delete_ai_credential(p_org uuid, p_provider text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row public.ai_credentials;
BEGIN
  IF NOT private.has_role(p_org, ARRAY['admin']) THEN
    RAISE EXCEPTION 'only organisation admins can manage AI keys' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.ai_credentials WHERE org_id = p_org AND provider = p_provider RETURNING * INTO v_row;
  IF FOUND THEN
    DELETE FROM vault.secrets WHERE id = v_row.vault_secret_id;
    INSERT INTO public.audit_events (org_id, actor_id, action, entity_type, entity_id, request_id)
    VALUES (p_org, (SELECT auth.uid()), 'ai_credential.delete', 'ai_credential', v_row.id, 'db');
  END IF;
END;
$$;

-- Server-only: returns the decrypted key. Never granted to anon/authenticated.
CREATE FUNCTION private.reveal_ai_credential(p_org uuid, p_provider text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.decrypted_secret
  FROM public.ai_credentials c
  JOIN vault.decrypted_secrets s ON s.id = c.vault_secret_id
  WHERE c.org_id = p_org AND c.provider = p_provider;
$$;

REVOKE ALL ON FUNCTION public.set_ai_credential(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_ai_credential(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.reveal_ai_credential(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_ai_credential(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_ai_credential(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.reveal_ai_credential(uuid, text) TO service_role;
