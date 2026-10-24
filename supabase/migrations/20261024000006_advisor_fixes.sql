-- Supabase advisor follow-ups: index foreign keys, and split the admin membership
-- policy so SELECT is covered by one permissive policy only.

CREATE INDEX ai_credentials_created_by_idx ON public.ai_credentials(created_by);
CREATE INDEX assessments_created_by_idx ON public.assessments(created_by);
CREATE INDEX gtm_simulations_created_by_idx ON public.gtm_simulations(created_by);
-- Matches the (assessment_id, org_id) foreign key column order.
DROP INDEX public.assessment_partners_org_assessment_idx;
CREATE INDEX assessment_partners_assessment_org_idx ON public.assessment_partners(assessment_id, org_id);

DROP POLICY memberships_admin_write ON public.memberships;
CREATE POLICY memberships_admin_insert ON public.memberships
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.has_role(org_id, ARRAY['admin'])));
CREATE POLICY memberships_admin_update ON public.memberships
  FOR UPDATE TO authenticated
  USING ((SELECT private.has_role(org_id, ARRAY['admin'])))
  WITH CHECK ((SELECT private.has_role(org_id, ARRAY['admin'])));
CREATE POLICY memberships_admin_delete ON public.memberships
  FOR DELETE TO authenticated USING ((SELECT private.has_role(org_id, ARRAY['admin'])));
