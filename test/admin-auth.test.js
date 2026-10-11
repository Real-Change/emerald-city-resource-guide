'use strict';

const http = require('http');
const pg = require('pg');
const admin = require('firebase-admin');
const { expect } = require('chai');
require('../server.js');

const ADMIN_EMAIL = 'auth-test-admin@example.com';
const OUTSIDER_EMAIL = 'auth-test-outsider@example.com';
const VALID_SESSIONS = {
  'admin-session': ADMIN_EMAIL,
  'outsider-session': OUTSIDER_EMAIL,
};

function getAdminPage(cookies) {
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('; ');
  return new Promise((resolve, reject) => {
    http.get(
      { port: process.env.PORT || 8080, path: '/admin/account', headers: { Cookie: cookieHeader } },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res));
      }
    ).on('error', reject);
  });
}

function expectLoginRedirect(res) {
  expect(res.statusCode).to.equal(302);
  expect(res.headers.location).to.equal('/login');
}

describe('ADMIN AUTHENTICATION', function() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const auth = admin.auth();
  const realVerifySessionCookie = auth.verifySessionCookie;

  before(async function() {
    await pool.query('DELETE FROM users WHERE email = $1', [ADMIN_EMAIL]);
    await pool.query(
      "INSERT INTO users (lastname, firstname, email) VALUES ('Test', 'Admin', $1)",
      [ADMIN_EMAIL]
    );
    auth.verifySessionCookie = (sessionCookie) => {
      if (sessionCookie === 'throws') throw new Error('Firebase misconfigured');
      return VALID_SESSIONS[sessionCookie]
        ? Promise.resolve({ email: VALID_SESSIONS[sessionCookie] })
        : Promise.reject(new Error('invalid session cookie'));
    };
  });

  after(async function() {
    auth.verifySessionCookie = realVerifySessionCookie;
    await pool.query('DELETE FROM users WHERE email = $1', [ADMIN_EMAIL]);
    await pool.end();
  });

  it('serves the admin page for a valid session belonging to an admin', async function() {
    const res = await getAdminPage({ session: 'admin-session', user: ADMIN_EMAIL });
    expect(res.statusCode).to.equal(200);
  });

  it('rejects a forged user cookie with no session', async function() {
    expectLoginRedirect(await getAdminPage({ user: ADMIN_EMAIL }));
  });

  it('rejects a forged user cookie alongside an invalid session', async function() {
    expectLoginRedirect(await getAdminPage({ session: 'forged', user: ADMIN_EMAIL }));
  });

  it('rejects a valid session for a non-admin even when the user cookie names an admin', async function() {
    expectLoginRedirect(await getAdminPage({ session: 'outsider-session', user: ADMIN_EMAIL }));
  });

  it('redirects to login when session verification throws', async function() {
    expectLoginRedirect(await getAdminPage({ session: 'throws', user: ADMIN_EMAIL }));
  });

  it('rejects SQL injection in the user cookie', async function() {
    expectLoginRedirect(await getAdminPage({ user: "' OR '1'='1" }));
  });
});
