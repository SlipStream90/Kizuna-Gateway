-- Tenancy on Supabase Auth. Replaces the custom OIDC + `app.org_id` session setting
-- (backend/migrations/002): every tenant table is scoped by RLS against auth.uid()
-- through membership, so the Next.js server can query with the caller's own JWT.
-- Server-only helpers live in schema `private`, which is not exposed over the Data API.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.memberships (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('member', 'advisor', 'reviewer', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX memberships_user_idx ON public.memberships(user_id);

-- SECURITY DEFINER so policies on memberships itself do not recurse.
CREATE FUNCTION private.is_member(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m WHERE m.org_id = p_org AND m.user_id = (SELECT auth.uid())
  );
$$;

CREATE FUNCTION private.has_role(p_org uuid, p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.org_id = p_org AND m.user_id = (SELECT auth.uid()) AND m.role = ANY(p_roles)
  );
$$;

REVOKE ALL ON FUNCTION private.is_member(uuid), private.has_role(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_member(uuid), private.has_role(uuid, text[]) TO authenticated, service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_member_read ON public.organizations
  FOR SELECT TO authenticated USING ((SELECT private.is_member(id)));
CREATE POLICY organizations_admin_update ON public.organizations
  FOR UPDATE TO authenticated
  USING ((SELECT private.has_role(id, ARRAY['admin'])))
  WITH CHECK ((SELECT private.has_role(id, ARRAY['admin'])));

CREATE POLICY memberships_member_read ON public.memberships
  FOR SELECT TO authenticated USING ((SELECT private.is_member(org_id)));
CREATE POLICY memberships_admin_write ON public.memberships
  FOR ALL TO authenticated
  USING ((SELECT private.has_role(org_id, ARRAY['admin'])))
  WITH CHECK ((SELECT private.has_role(org_id, ARRAY['admin'])));

-- Every new account gets a personal workspace it administers.
CREATE FUNCTION private.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_org uuid;
BEGIN
  INSERT INTO public.organizations (name)
  VALUES (coalesce(nullif(split_part(NEW.email, '@', 1), ''), 'My') || ' workspace')
  RETURNING id INTO v_org;
  INSERT INTO public.memberships (org_id, user_id, role) VALUES (v_org, NEW.id, 'admin');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();
