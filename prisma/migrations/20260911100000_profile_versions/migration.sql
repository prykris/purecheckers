ALTER TABLE "User" ADD COLUMN "profileVersion" INTEGER NOT NULL DEFAULT 0;

-- Ordering metadata only. All profile writers, including raw wallet SQL, share
-- the row's transactional revision; business rules remain in their services.
CREATE FUNCTION advance_user_profile_version() RETURNS trigger AS $$
BEGIN
  NEW."profileVersion" := OLD."profileVersion" + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profile_version
BEFORE UPDATE ON "User"
FOR EACH ROW EXECUTE FUNCTION advance_user_profile_version();
