'use strict';

const pg = require('pg');
const csv = require('csv/sync');
const { expect } = require('chai');
const {
  applyImport,
  undoImport,
  planImport,
  loadOrganizationsById,
  StaleImportError,
} = require('../lib/organization-import');

const FIXTURE_NAME = 'Import Test Org';

describe('applyImport and undoImport', function() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  let ids;

  async function rowOf(id) {
    const result = await pool.query('SELECT to_jsonb(o) AS j FROM organization o WHERE organization_id = $1', [id]);
    return result.rows[0].j;
  }

  async function logsFor(fixtureIds) {
    const result = await pool.query(
      'SELECT * FROM organization_import_log WHERE organization_id = ANY($1) ORDER BY import_log_id',
      [fixtureIds]
    );
    return result.rows;
  }

  async function exportCsv(edits) {
    const byId = await loadOrganizationsById(pool);
    const rows = ids.map((id) => Object.assign({}, byId.get(id), edits[id]));
    return csv.stringify(rows, { header: true });
  }

  async function preview(csvText) {
    return planImport(csvText, await loadOrganizationsById(pool));
  }

  async function removeFixtures() {
    await pool.query(
      'DELETE FROM organization_import_log WHERE organization_id IN (SELECT organization_id FROM organization WHERE organization_name LIKE $1)',
      [FIXTURE_NAME + '%']
    );
    await pool.query('DELETE FROM organization WHERE organization_name LIKE $1', [FIXTURE_NAME + '%']);
    await pool.query('DELETE FROM deleted_organization WHERE organization_name LIKE $1', [FIXTURE_NAME + '%']);
  }

  beforeEach(async function() {
    await removeFixtures();
    const inserted = await pool.query(`
      INSERT INTO organization (organization_id, organization_name, website, schedule, gender, kids, active, zipcode, sponsorship, distribution, id_req, last_update)
      VALUES
        (900001, $1, 'https://a.example.org', 'Mon - Fri', 'no restrictions', 'allowed', true, 98101, false, false, false, '2020-01-01T00:00:00Z'),
        (900002, $2, 'https://b.example.org', 'Weekends', 'women only', 'not allowed', true, NULL, true, false, false, '2020-01-01T00:00:00Z')
      RETURNING organization_id`, [FIXTURE_NAME + ' A', FIXTURE_NAME + ' B']);
    ids = inserted.rows.map((row) => row.organization_id);
  });

  afterEach(removeFixtures);

  after(async function() {
    await pool.end();
  });

  it('updates only the changed fields, stamps last_update, and logs the before and after rows', async function() {
    const [a, b] = ids;
    const beforeA = await rowOf(a);
    const beforeB = await rowOf(b);
    const csvText = await exportCsv({ [a]: { schedule: 'Daily', active: 'FALSE' } });
    const plan = await preview(csvText);

    const result = await applyImport(pool, csvText, plan.fingerprint, 'staff@example.org');

    expect(result.updatedCount).to.equal(1);
    const afterA = await rowOf(a);
    expect(Object.assign({}, afterA, { last_update: null })).to.deep.equal(
      Object.assign({}, beforeA, { schedule: 'Daily', active: false, last_update: null })
    );
    expect(Math.abs(new Date(afterA.last_update) - Date.now())).to.be.below(60 * 1000);
    expect(await rowOf(b)).to.deep.equal(beforeB);

    const logs = await logsFor(ids);
    expect(logs).to.have.lengthOf(1);
    expect(logs[0]).to.include({ import_id: result.importId, organization_id: a, imported_by: 'staff@example.org' });
    expect(logs[0].before_row).to.deep.equal(beforeA);
    expect(logs[0].after_row).to.deep.equal(afterA);
  });

  it('writes nothing when the database changed after the preview', async function() {
    const [a, b] = ids;
    const csvText = await exportCsv({ [a]: { schedule: 'Daily' }, [b]: { website: 'https://b2.example.org' } });
    const plan = await preview(csvText);
    await pool.query("UPDATE organization SET schedule = 'Edited elsewhere' WHERE organization_id = $1", [a]);
    const beforeB = await rowOf(b);

    let thrown;
    try {
      await applyImport(pool, csvText, plan.fingerprint, 'staff@example.org');
    } catch (err) {
      thrown = err;
    }

    expect(thrown).to.be.instanceOf(StaleImportError);
    expect((await rowOf(a)).schedule).to.equal('Edited elsewhere');
    expect(await rowOf(b)).to.deep.equal(beforeB);
    expect(await logsFor(ids)).to.deep.equal([]);
  });

  it('writes nothing when one organization fails to update', async function() {
    const [a, b] = ids;
    const beforeA = await rowOf(a);
    const csvText = await exportCsv({ [a]: { schedule: 'Daily' }, [b]: { schedule: 'Rejected by the database' } });
    const plan = await preview(csvText);

    await pool.query("ALTER TABLE organization ADD CONSTRAINT import_test_reject CHECK (schedule <> 'Rejected by the database') NOT VALID");
    let thrown;
    try {
      await applyImport(pool, csvText, plan.fingerprint, 'staff@example.org');
    } catch (err) {
      thrown = err;
    } finally {
      await pool.query('ALTER TABLE organization DROP CONSTRAINT import_test_reject');
    }

    expect(thrown).to.be.an('error');
    expect(thrown.message).to.contain('import_test_reject');
    expect(await rowOf(a)).to.deep.equal(beforeA);
    expect(await logsFor(ids)).to.deep.equal([]);
  });

  it('restores the organizations an import changed', async function() {
    const [a, b] = ids;
    const beforeA = await rowOf(a);
    const beforeB = await rowOf(b);
    const csvText = await exportCsv({ [a]: { schedule: 'Daily' }, [b]: { zipcode: '98109', gender: 'men only' } });
    const { importId } = await applyImport(pool, csvText, (await preview(csvText)).fingerprint, 'staff@example.org');

    const result = await undoImport(pool, importId, {});

    expect(result.restored).to.have.members([a, b]);
    expect(result.skipped).to.deep.equal([]);
    expect(await rowOf(a)).to.deep.equal(beforeA);
    expect(await rowOf(b)).to.deep.equal(beforeB);
  });

  it('skips an organization edited after the import unless forced', async function() {
    const [a, b] = ids;
    const beforeA = await rowOf(a);
    const beforeB = await rowOf(b);
    const csvText = await exportCsv({ [a]: { schedule: 'Daily' }, [b]: { schedule: 'Sundays' } });
    const { importId } = await applyImport(pool, csvText, (await preview(csvText)).fingerprint, 'staff@example.org');
    await pool.query("UPDATE organization SET website = 'https://edited.example.org' WHERE organization_id = $1", [b]);

    const first = await undoImport(pool, importId, {});

    expect(first.restored).to.deep.equal([a]);
    expect(first.skipped).to.deep.equal([{ id: b, reason: 'edited since import' }]);
    expect(await rowOf(a)).to.deep.equal(beforeA);
    expect((await rowOf(b)).website).to.equal('https://edited.example.org');

    const forced = await undoImport(pool, importId, { force: true });

    expect(forced.restored).to.deep.equal([b]);
    expect(forced.skipped).to.deep.equal([{ id: a, reason: 'already restored' }]);
    expect(await rowOf(b)).to.deep.equal(beforeB);
  });

  it('rejects an unknown import id', async function() {
    let thrown;
    try {
      await undoImport(pool, 'no-such-import', {});
    } catch (err) {
      thrown = err;
    }
    expect(thrown).to.be.an('error');
    expect(thrown.message).to.contain('no-such-import');
  });
});
