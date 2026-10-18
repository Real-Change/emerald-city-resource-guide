# Bulk organization import runbook

Use this runbook when staff update many organizations at once on the **Bulk Update (CSV)** admin page. It covers the backup before an import, the import, and four ways to undo one. The undo tiers start with the smallest blast radius.

## One-time setup: run the migration in production

The deploy workflow (`.github/workflows/deploy.yml`) does not run migrations. After the deploy that adds the import page, and before anyone uses it, run:

```sh
fly ssh console -a emerald-city-resource-guide -C "npx knex migrate:latest --env production"
```

The first run prints `Batch <n> run: <count> migrations`. A later run prints `Already up to date`. The import fails until this migration runs, because it writes to the `organization_import_log` table.

## Connect to the production database from your machine

The backup check and undo tiers 2 and 3 connect to production through a Fly proxy.

1. In a separate terminal, start the proxy and leave it running:

   ```sh
   fly proxy 15432:5432 -a emerald-city-resource-guide-db
   ```

   The proxy uses local port 15432, so a local Postgres on 5432 does not get in the way.

2. In the terminal where you run the commands, set `PG_URL`:

   ```sh
   export PG_URL=$(fly ssh console -q -C 'printenv DATABASE_URL' -a emerald-city-resource-guide | sed -E 's/@emerald-city-resource-guide-db\.(internal|flycast)(:5432)?/@localhost:15432/')
   ```

The commands below run `psql` and `pg_restore` from the `postgres:14.2` image, the same image that `db/fly_db_dump.sh` uses, so you do not need a local Postgres client.

## 1. Before the import

1. Take a full dump of production:

   ```sh
   ./db/fly_db_dump.sh
   ```

   The script writes `~/ecrg-backups/YYYY-MM-DDTHHMMSS.pgdump`. To write somewhere else, give a directory as the first argument. Do not write dumps inside this repository, because the repository is public. The script refuses to overwrite a file, checks that `pg_restore --list` can read the dump, and deletes the file if the check fails. On success it prints `Wrote <file> (<n> tables with data)`. The script starts and stops its own proxy on port 15432, so stop any proxy you started from the previous section before you run it. Set `ECRG_PROXY_PORT` to use a different port.

2. Set `FILE` to the dump the script wrote:

   ```sh
   export FILE=~/ecrg-backups/YYYY-MM-DDTHHMMSS.pgdump
   ```

3. Prove that the dump restores. Start the proxy and set `PG_URL` as described in the previous section. Restore the dump into the local Docker database, then compare the organization count with production:

   ```sh
   make db-restore < "$FILE"
   docker compose exec -T postgres psql -U emerald-city-resource-guide -tAc "SELECT count(*) FROM organization"
   docker run --rm --net host postgres:14.2 psql "$PG_URL" -tAc "SELECT count(*) FROM organization"
   ```

   The two counts must match. `make db-restore` replaces your local data. If you have no local database yet, run `make setup` first.

4. Check that a Fly volume snapshot exists. It is the last resort if the dump is lost:

   ```sh
   fly volumes list -a emerald-city-resource-guide-db
   fly volumes snapshots list <volume-id> -a emerald-city-resource-guide-db
   ```

   Look for a snapshot from the last day. Pass `-a` even if you have already named the volume: inside this repository `fly` reads the app name from `fly.toml`, which names the web app, and the command fails. On 2026-10-16 the `pg_data` volume took a scheduled snapshot every day and kept each one for 5 days. Check `Scheduled snapshots: true` and `Snapshot retention` with:

   ```sh
   fly volumes show <volume-id> -a emerald-city-resource-guide-db
   ```

   A snapshot older than 5 days is gone. If an import goes wrong and the dump is lost, use tier 4 within that window.

## 2. During the import

1. On **Bulk Update (CSV)**, download the organizations CSV, edit it, and upload it.
2. Read the preview. It lists every changed field with its value before and after. If it shows errors, fix the file and upload it again.
3. Select **Apply these changes**. The import is one transaction: it saves every change or none.
4. Write down the import ID on the confirmation page. Tier 1 needs it.

If the preview is out of date because someone edited an organization after the upload, the apply step saves nothing and asks for a new upload.

## 3. Undo an import

Use the first tier that fits.

### Tier 1: undo by import ID

Tier 1 restores only the organizations that the import changed. It skips any organization that someone edited after the import.

```sh
fly ssh console -a emerald-city-resource-guide -C "node db/undo-import.js <import_id>"
```

The output lists the restored organization IDs and each skipped ID with a reason:

- `edited since import`: someone changed the organization after the import. To overwrite that edit with the value from before the import, run the command again with `--force` after the import ID.
- `already restored`: the organization already has its value from before the import. Running the undo again is safe.

Restoring also puts back each organization's `last_update` from before the import. To undo several imports, undo the newest one first.

### Tier 2: restore the organization table from the dump

Use tier 2 if tier 1 cannot undo the damage, for example if the import log is missing. Tier 2 resets every organization that exists in both the dump and production to its value in the dump. It keeps organizations added after the dump, does not bring back organizations deleted after the dump, and does not change requests, feedback, the mailing list, or categories.

1. Extract the organization rows from the dump into a SQL file that loads them into a table named `organization_restore`:

   ```sh
   docker run --rm -i postgres:14.2 pg_restore --data-only --table organization --file - < "$FILE" \
     | sed 's/^COPY public\.organization (/COPY public.organization_restore (/' > organization_restore.sql
   ```

2. Create the table and load the rows:

   ```sh
   docker run --rm --net host postgres:14.2 psql "$PG_URL" -v ON_ERROR_STOP=1 -c "CREATE TABLE organization_restore (LIKE organization)"
   docker run --rm -i --net host postgres:14.2 psql "$PG_URL" -v ON_ERROR_STOP=1 < organization_restore.sql
   ```

3. List the organizations that the restore will change:

   ```sh
   docker run --rm --net host postgres:14.2 psql "$PG_URL" -c "SELECT o.organization_id, o.organization_name FROM organization o JOIN organization_restore r USING (organization_id) WHERE ROW(o.*) IS DISTINCT FROM ROW(r.*) ORDER BY 1"
   ```

4. Copy the rows back in one transaction, then drop the table:

   ```sh
   docker run --rm -i --net host postgres:14.2 psql "$PG_URL" -v ON_ERROR_STOP=1 <<'SQL'
   BEGIN;
   SELECT format(
     'UPDATE organization o SET (%s) = (%s) FROM organization_restore r WHERE o.organization_id = r.organization_id AND ROW(o.*) IS DISTINCT FROM ROW(r.*)',
     string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position),
     string_agg('r.' || quote_ident(column_name), ', ' ORDER BY ordinal_position))
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'organization' AND column_name <> 'organization_id'
   \gexec
   COMMIT;
   DROP TABLE organization_restore;
   SQL
   ```

   The output includes `UPDATE <n>`, where `n` is the number of organizations listed in step 3.

The restore uses `UPDATE`. Do not use `DELETE` to clear the table: the `move_deleted_organization` trigger runs before each delete and copies the row into `deleted_organization`. A `TRUNCATE` followed by `pg_restore --data-only --table organization` does not run that trigger, but it also removes organizations added after the dump.

### Tier 3: restore the whole database from the dump

**Tier 3 loses every write to every table since the dump**, including copy requests, feedback, mailing list sign-ups, and organization edits.

```sh
docker run --rm -i --net host postgres:14.2 pg_restore --clean --if-exists --single-transaction --no-owner -d "$PG_URL" < "$FILE"
```

`--single-transaction` makes the restore all or nothing. If it fails, the database stays as it was.

### Tier 4: restore a Fly volume snapshot into a new Postgres app

Use tier 4 only if the dump is lost or unreadable. Create a new Postgres app from a snapshot, check its data, and then point the app at it:

```sh
fly volumes list -a emerald-city-resource-guide-db
fly volumes snapshots list <volume-id> -a emerald-city-resource-guide-db
fly postgres create --snapshot-id <snapshot-id>
```

Tier 4 has not been rehearsed. Follow Fly's current documentation for the attach step.
