'use strict';

const http = require('http');
const querystring = require('querystring');
const pg = require('pg');
const admin = require('firebase-admin');
const { expect } = require('chai');
require('../server.js');

const ADMIN_EMAIL = 'import-route-admin@example.com';
const FIXTURE_ID = 900101;

function post(path, form, cookies) {
  const body = querystring.stringify(form);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        port: process.env.PORT || 8080,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          Cookie: cookies || '',
        },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { text += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: text }));
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

describe('organization import routes', function() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const auth = admin.auth();
  const realVerifySessionCookie = auth.verifySessionCookie;
  const session = 'session=import-admin-session; user=' + ADMIN_EMAIL;
  const csvText = `organization_id,schedule\n${FIXTURE_ID},<script>alert(1)</script>\n`;

  async function removeFixture() {
    await pool.query('DELETE FROM organization_import_log WHERE organization_id = $1', [FIXTURE_ID]);
    await pool.query('DELETE FROM organization WHERE organization_id = $1', [FIXTURE_ID]);
    await pool.query('DELETE FROM deleted_organization WHERE organization_id = $1', [FIXTURE_ID]);
  }

  before(async function() {
    await removeFixture();
    await pool.query('DELETE FROM users WHERE email = $1', [ADMIN_EMAIL]);
    await pool.query("INSERT INTO users (lastname, firstname, email) VALUES ('Import', 'Admin', $1)", [ADMIN_EMAIL]);
    await pool.query(
      "INSERT INTO organization (organization_id, organization_name, schedule) VALUES ($1, 'Route Test Org', 'Mon - Fri')",
      [FIXTURE_ID]
    );
    auth.verifySessionCookie = (cookie) =>
      cookie === 'import-admin-session'
        ? Promise.resolve({ email: ADMIN_EMAIL })
        : Promise.reject(new Error('invalid session cookie'));
  });

  after(async function() {
    auth.verifySessionCookie = realVerifySessionCookie;
    await removeFixture();
    await pool.query('DELETE FROM users WHERE email = $1', [ADMIN_EMAIL]);
    await pool.end();
  });

  it('renders the preview with escaped values for an admin', async function() {
    const res = await post('/admin/organization/import/preview', { csv: csvText }, session);

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.contain('Route Test Org (id 900101)');
    expect(res.body).to.contain('Organizations to update: 1');
    expect(res.body).to.contain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(res.body).to.not.contain('<script>alert(1)</script>');
  });

  it('accepts an upload the size of a full export', async function() {
    const largeCsv = `organization_id,org_description_es\n${FIXTURE_ID},${'x'.repeat(600 * 1024)}\n`;
    const res = await post('/admin/organization/import/preview', { csv: largeCsv }, session);

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.contain('Organizations to update: 1');
  });

  it('keeps the default body limit on public forms', async function() {
    const res = await post('/feedbackconfirmation', { feedbackfield: 'x'.repeat(200 * 1024) });

    expect(res.statusCode).to.equal(413);
  });

  it('records the verified admin email, not the user cookie, as the importer', async function() {
    const editCsv = `organization_id,schedule\n${FIXTURE_ID},Daily\n`;
    const preview = await post('/admin/organization/import/preview', { csv: editCsv }, session);
    const fingerprint = preview.body.match(/name="fingerprint" value="([0-9a-f]{64})"/)[1];
    const spoofed = 'session=import-admin-session; user=someone-else@example.com';

    try {
      const res = await post('/admin/organization/import/apply', { csv: editCsv, fingerprint: fingerprint }, spoofed);

      expect(res.statusCode).to.equal(200);
      const log = await pool.query('SELECT imported_by FROM organization_import_log WHERE organization_id = $1', [FIXTURE_ID]);
      expect(log.rows.map((row) => row.imported_by)).to.deep.equal([ADMIN_EMAIL]);
    } finally {
      await pool.query("UPDATE organization SET schedule = 'Mon - Fri' WHERE organization_id = $1", [FIXTURE_ID]);
      await pool.query('DELETE FROM organization_import_log WHERE organization_id = $1', [FIXTURE_ID]);
    }
  });

  it('redirects the preview to login without a session', async function() {
    const res = await post('/admin/organization/import/preview', { csv: csvText });

    expect(res.statusCode).to.equal(302);
    expect(res.headers.location).to.equal('/login');
  });

  it('refuses a stale apply and asks for a new upload', async function() {
    const res = await post('/admin/organization/import/apply', { csv: csvText, fingerprint: 'stale' }, session);

    expect(res.statusCode).to.equal(409);
    expect(res.body).to.contain('upload again');
    const row = await pool.query('SELECT schedule FROM organization WHERE organization_id = $1', [FIXTURE_ID]);
    expect(row.rows[0].schedule).to.equal('Mon - Fri');
  });
});
