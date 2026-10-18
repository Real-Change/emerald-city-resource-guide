'use strict';

const http = require('http');
const querystring = require('querystring');
const pg = require('pg');
const { expect } = require('chai');
const { phoneSegments, mapHref } = require('../lib/contact-links');
require('../server.js');

const FIXTURE_ID = 900201;

function links(text) {
  return phoneSegments(text).filter((segment) => segment.href);
}

function mapQuery(address) {
  return decodeURIComponent(mapHref(address).split('query=')[1]);
}

describe('phoneSegments', function() {
  it('links every number in a field and keeps the text around them', function() {
    const text = 'Helpline: 1-877-922-4292 or (206) 325-0325; office line: (206) 467–9976';

    expect(phoneSegments(text)).to.deep.equal([
      { text: 'Helpline: ' },
      { text: '1-877-922-4292', href: 'tel:+18779224292' },
      { text: ' or ' },
      { text: '(206) 325-0325', href: 'tel:+12063250325' },
      { text: '; office line: ' },
      { text: '(206) 467–9976', href: 'tel:+12064679976' },
    ]);
  });

  it('links crisis short codes but not digits inside a longer number', function() {
    expect(links('988, press 1 for veterans')).to.deep.equal([{ text: '988', href: 'tel:988' }]);
    expect(links('2-1-1\nFor assistance within King County: 1 (800) 621-4636')).to.deep.equal([
      { text: '2-1-1', href: 'tel:211' },
      { text: '1 (800) 621-4636', href: 'tel:+18006214636' },
    ]);
  });

  it('leaves an extension as text after the linked number', function() {
    expect(phoneSegments('Kent: (253) 854-0077 x5104')).to.deep.equal([
      { text: 'Kent: ' },
      { text: '(253) 854-0077', href: 'tel:+12538540077' },
      { text: ' x5104' },
    ]);
  });

  it('links an email address in the phone field', function() {
    expect(links('(206) 695-7600\ninfo@acrs.org')).to.deep.equal([
      { text: '(206) 695-7600', href: 'tel:+12066957600' },
      { text: 'info@acrs.org', href: 'mailto:info@acrs.org' },
    ]);
  });

  it('returns text with no number as one plain segment', function() {
    expect(phoneSegments('Online database')).to.deep.equal([{ text: 'Online database' }]);
  });
});

describe('mapHref', function() {
  it('maps a single address, adding the state', function() {
    expect(mapHref('3815 S Othello St., Seattle')).to.equal(
      'https://www.google.com/maps/search/?api=1&query=3815%20S%20Othello%20St.%2C%20Seattle%2C%20WA'
    );
  });

  it('joins lines and keeps a state that is already there', function() {
    expect(mapQuery('13668 SE Eastgate Way \r\nBellevue, WA ')).to.equal('13668 SE Eastgate Way, Bellevue, WA');
  });

  it('maps an address that starts with a place name or has a unit number', function() {
    expect(mapQuery('Berean Bible Church, 2345 N 185th St., Shoreline')).to.equal('Berean Bible Church, 2345 N 185th St., Shoreline, WA');
    expect(mapQuery('8045 120th Ave NE., No. 100\nKirkland')).to.equal('8045 120th Ave NE., No. 100, Kirkland, WA');
  });

  it('does not map a field that lists several locations', function() {
    expect(mapHref('Food Bank: 1501 N 45th St.\nResource Center: 1005 NE 67th St.')).to.equal(null);
    expect(mapHref('Navigation Center: 606 12th Ave. S; Kerner-Scott House (women only): 510 Minor Ave. N')).to.equal(null);
  });

  it('does not map a field with no street address', function() {
    expect(mapHref('Confidential Location')).to.equal(null);
    expect(mapHref('Address moves every 2-3 months, call for current address.')).to.equal(null);
    expect(mapHref('PO Box 22886')).to.equal(null);
  });
});

describe('results page contact links', function() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  function search(keyword) {
    const body = querystring.stringify({ searchbar: keyword, submitbutton: 'keyword' });
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          port: process.env.PORT || 8080,
          path: '/results',
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
        },
        (res) => {
          let text = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => { text += chunk; });
          res.on('end', () => resolve({ statusCode: res.statusCode, body: text }));
        }
      );
      req.on('error', reject);
      req.end(body);
    });
  }

  async function removeFixture() {
    await pool.query('DELETE FROM organization_x_category WHERE organization_id = $1', [FIXTURE_ID]);
    await pool.query('DELETE FROM category WHERE category_id = $1', [FIXTURE_ID]);
    await pool.query('DELETE FROM organization WHERE organization_id = $1', [FIXTURE_ID]);
    await pool.query('DELETE FROM deleted_organization WHERE organization_id = $1', [FIXTURE_ID]);
  }

  before(async function() {
    await removeFixture();
    await pool.query(
      `INSERT INTO organization (organization_id, organization_name, phone_number, org_address, website, org_description, schedule, active)
       VALUES ($1, 'Zebrafinch Contact Test', $2, $3, '', '', 'Daily', true)`,
      [FIXTURE_ID, 'Office: (206) 555-0100 <b>ask</b>; help@example.org', '123 Main St. <i>rear</i>\nSeattle']
    );
    // Search results only include organizations listed in at least one active category.
    await pool.query("INSERT INTO category (category_id, category_name) VALUES ($1, 'Contact Link Test')", [FIXTURE_ID]);
    await pool.query('INSERT INTO organization_x_category (organization_id, category_id, active) VALUES ($1, $1, true)', [FIXTURE_ID]);
  });

  after(async function() {
    await removeFixture();
    await pool.end();
  });

  it('renders tappable phone, email and map links with the text still escaped', async function() {
    const res = await search('Zebrafinch');

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.contain('<a href="tel:+12065550100">(206) 555-0100</a> &lt;b&gt;ask&lt;/b&gt;; <a href="mailto:help@example.org">help@example.org</a>');
    expect(res.body).to.contain(
      '<a target="_blank" href="https://www.google.com/maps/search/?api=1&amp;query=123%20Main%20St.%20%3Ci%3Erear%3C%2Fi%3E%2C%20Seattle%2C%20WA">123 Main St. &lt;i&gt;rear&lt;/i&gt;'
    );
    expect(res.body).to.not.contain('<b>ask</b>');
    expect(res.body).to.not.contain('<i>rear</i>');
  });
});
