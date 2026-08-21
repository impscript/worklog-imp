-- Backup tables are operational artifacts, not application Data API tables.
-- Keep them available to database owners/service operations while preventing
-- browser roles from reading or mutating their unscoped contents.

BEGIN;

DO $$
DECLARE
  backup_table RECORD;
BEGIN
  FOR backup_table IN
    SELECT format('%I.%I', namespace.nspname, relation.relname) AS qualified_name
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind = 'r'
      AND relation.relname LIKE '\_bkp\_%' ESCAPE '\'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', backup_table.qualified_name);
    EXECUTE format(
      'REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated',
      backup_table.qualified_name
    );
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
