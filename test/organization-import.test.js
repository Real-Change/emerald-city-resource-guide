'use strict';

const { expect } = require('chai');
const csv = require('csv/sync');
const { planImport, indexById } = require('../lib/organization-import');

function exportRow(overrides) {
  return Object.assign({
    organization_id: 1,
    organization_name: 'Food Bank ',
    website: 'https://food.example.org',
    phone_number: '(206) 555-0100',
    org_address: '1 Main St.',
    org_description: 'Hot meals.\r\nNo ID needed.',
    schedule: 'Mon - Fri',
    gender: 'no restrictions',
    kids: 'allowed',
    active: 'true',
    last_update: '2020-04-14 23:38:00+00',
    zipcode: 98122,
    contact_name: 'Ann',
    contact_email: 'ann@example.org',
    contact_phone: null,
    contact_title: '',
    sponsorship: 'false',
    distribution: 'true',
    id_req: 'false',
    sponsorship_email: '',
    distribution_email: null,
    org_description_es: null,
    org_address_es: '',
    schedule_es: '',
    print_locations: ['Food', 'Shelter'],
  }, overrides);
}

const DB_ROWS = [
  exportRow({}),
  exportRow({
    organization_id: 2,
    organization_name: 'Shelter',
    gender: null,
    active: null,
    zipcode: null,
    print_locations: null,
  }),
];

function toCsv(rows) {
  return csv.stringify(rows, { header: true });
}

function plan(rows, dbRows) {
  return planImport(toCsv(rows), indexById(dbRows || DB_ROWS));
}

function edited(id, overrides) {
  return Object.assign({}, DB_ROWS.find((row) => row.organization_id === id), overrides);
}

function onlyError(result) {
  expect(result.errors).to.have.lengthOf(1);
  return result.errors[0];
}

describe('planImport', function() {
  it('finds no changes when the unedited export is uploaded', function() {
    const result = plan(DB_ROWS);
    expect(result.errors).to.deep.equal([]);
    expect(result.warnings).to.deep.equal([]);
    expect(result.changes).to.deep.equal([]);
    expect(result.unchangedCount).to.equal(2);
  });

  it('treats whitespace and line-ending differences as unchanged', function() {
    const result = plan([
      edited(1, { organization_name: 'Food Bank', org_description: '  Hot meals.\nNo ID needed.\n', contact_title: '   ' }),
      edited(2, {}),
    ]);
    expect(result.changes).to.deep.equal([]);
    expect(result.unchangedCount).to.equal(2);
  });

  it('reports only the fields that changed, with before and after values', function() {
    const result = plan([edited(1, { schedule: 'Daily', zipcode: '98101' }), edited(2, {})]);
    expect(result.errors).to.deep.equal([]);
    expect(result.changes).to.deep.equal([{
      organization_id: 1,
      organization_name: 'Food Bank ',
      fields: [
        { column: 'schedule', before: 'Mon - Fri', after: 'Daily' },
        { column: 'zipcode', before: 98122, after: 98101 },
      ],
    }]);
    expect(result.unchangedCount).to.equal(1);
  });

  it('accepts spreadsheet-style TRUE and FALSE', function() {
    const result = plan([edited(1, { active: 'TRUE', distribution: 'FALSE', id_req: 'No' })]);
    expect(result.errors).to.deep.equal([]);
    expect(result.changes).to.have.lengthOf(1);
    expect(result.changes[0].fields).to.deep.equal([{ column: 'distribution', before: 'true', after: false }]);
  });

  it('rejects a boolean that is not true or false', function() {
    const error = onlyError(plan([edited(1, { active: 'maybe' })]));
    expect(error).to.include({ row: 2, column: 'active' });
  });

  it('rejects a blank boolean unless the organization has no value', function() {
    const error = onlyError(plan([edited(1, { active: '' }), edited(2, { active: '' })]));
    expect(error).to.include({ row: 2, column: 'active' });
  });

  it('writes an empty string, never null, for a blank text cell', function() {
    const result = plan([edited(1, { website: '' })]);
    expect(result.changes[0].fields).to.deep.equal([{ column: 'website', before: 'https://food.example.org', after: '' }]);
  });

  it('rejects text mangled by a non-UTF-8 save', function() {
    const error = onlyError(plan([edited(1, { schedule: 'Mon \uFFFD Fri' })]));
    expect(error).to.include({ row: 2, column: 'schedule' });
    expect(error.message).to.include('CSV UTF-8');
  });

  it('rejects text longer than the column allows', function() {
    const error = onlyError(plan([edited(1, { organization_name: 'x'.repeat(256) })]));
    expect(error).to.include({ row: 2, column: 'organization_name' });
    expect(error.message).to.include('limit is 255');
  });

  it('accepts text exactly at the column limit, counting characters not UTF-16 units', function() {
    const result = plan([edited(1, { organization_name: '\u2013'.repeat(254) + '\uD83D\uDE00' })]);
    expect(result.errors).to.deep.equal([]);
    expect(result.changes).to.have.lengthOf(1);
  });

  it('writes null for a blank zipcode', function() {
    const result = plan([edited(1, { zipcode: '' })]);
    expect(result.changes[0].fields).to.deep.equal([{ column: 'zipcode', before: 98122, after: null }]);
  });

  it('rejects an unknown column', function() {
    const rows = [Object.assign({ notes: 'x' }, edited(1, {}))];
    const error = onlyError(plan(rows));
    expect(error).to.include({ row: 1, column: 'notes' });
  });

  it('rejects a header that names a built-in object property', function() {
    const error = onlyError(planImport('organization_id,constructor\n1,x\n', indexById(DB_ROWS)));
    expect(error).to.include({ row: 1, column: 'constructor' });
  });

  it('rejects a column that appears twice', function() {
    const error = onlyError(planImport('organization_id,schedule,schedule\n1,Daily,Weekly\n', indexById(DB_ROWS)));
    expect(error).to.include({ row: 1, column: 'schedule' });
  });

  it('requires the organization_id column', function() {
    const row = edited(1, {});
    delete row.organization_id;
    const error = onlyError(plan([row]));
    expect(error).to.include({ row: 1, column: 'organization_id' });
  });

  it('reads a file saved with a UTF-8 byte order mark', function() {
    const result = planImport('\uFEFF' + toCsv(DB_ROWS), indexById(DB_ROWS));
    expect(result.errors).to.deep.equal([]);
    expect(result.unchangedCount).to.equal(2);
  });

  it('rejects a row with a blank organization id and points at Add New Agency', function() {
    const error = onlyError(plan([edited(1, {}), edited(2, { organization_id: '' })]));
    expect(error.row).to.equal(3);
    expect(error.column).to.equal('organization_id');
    expect(error.message).to.contain('Add New Agency');
  });

  it('rejects an id that is not in the database', function() {
    const error = onlyError(plan([edited(1, {}), edited(2, {}), edited(1, { organization_id: 999 })]));
    expect(error).to.include({ row: 4, column: 'organization_id' });
  });

  it('rejects an id that is not a number', function() {
    const error = onlyError(plan([edited(1, { organization_id: '1a' })]));
    expect(error).to.include({ row: 2, column: 'organization_id' });
  });

  it('rejects a duplicate id on the later row', function() {
    const error = onlyError(plan([edited(1, {}), edited(2, {}), edited(1, { schedule: 'Daily' })]));
    expect(error).to.include({ row: 4, column: 'organization_id' });
    expect(error.message).to.contain('row 2');
  });

  it('rejects a zipcode that is not a whole number', function() {
    const error = onlyError(plan([edited(1, {}), edited(2, { zipcode: '98-122' })]));
    expect(error).to.include({ row: 3, column: 'zipcode' });
  });

  it('rejects a gender outside the allowed values', function() {
    const error = onlyError(plan([edited(1, { gender: 'everyone' })]));
    expect(error).to.include({ row: 2, column: 'gender' });
  });

  it('leaves an invalid gender already in the database alone when the cell is unchanged', function() {
    const dbRows = [exportRow({ gender: 'undefined' })];
    const result = plan([edited(1, { gender: 'undefined' })], dbRows);
    expect(result.errors).to.deep.equal([]);
    expect(result.unchangedCount).to.equal(1);
  });

  it('accepts a gender in a different case and writes the canonical value', function() {
    const result = plan([edited(2, { gender: 'Women Only' })]);
    expect(result.changes[0].fields).to.deep.equal([{ column: 'gender', before: null, after: 'women only' }]);
  });

  it('counts spreadsheet rows, not file lines, after a multi-line cell', function() {
    const error = onlyError(plan([edited(1, { schedule: 'Mon\nTue\nWed' }), edited(2, { zipcode: 'abc' })]));
    expect(error.row).to.equal(3);
  });

  it('warns about a print location edit and does not import it', function() {
    const result = plan([edited(1, { print_locations: '["Food"]' }), edited(2, {})]);
    expect(result.errors).to.deep.equal([]);
    expect(result.changes).to.deep.equal([]);
    expect(result.warnings).to.have.lengthOf(1);
    expect(result.warnings[0]).to.include({ row: 2, column: 'print_locations' });
  });

  it('never writes last_update from the file', function() {
    const result = plan([edited(1, { last_update: '1999-01-01 00:00:00+00' })]);
    expect(result.changes).to.deep.equal([]);
  });

  it('only compares the columns present in the file', function() {
    const result = planImport('organization_id,schedule\n1,Daily\n', indexById(DB_ROWS));
    expect(result.errors).to.deep.equal([]);
    expect(result.changes[0].fields).to.deep.equal([{ column: 'schedule', before: 'Mon - Fri', after: 'Daily' }]);
  });

  it('reports malformed CSV as an error instead of throwing', function() {
    const result = planImport('organization_id,schedule\n1,"Daily\n', indexById(DB_ROWS));
    expect(result.errors).to.have.lengthOf(1);
    expect(result.changes).to.deep.equal([]);
  });

  it('gives the same fingerprint for the same input', function() {
    const rows = [edited(1, { schedule: 'Daily' })];
    expect(plan(rows).fingerprint).to.match(/^[0-9a-f]{64}$/);
    expect(plan(rows).fingerprint).to.equal(plan(rows).fingerprint);
  });

  it('changes the fingerprint when the database changes under the same file', function() {
    const rows = [edited(1, { schedule: 'Daily' })];
    const movedDb = [exportRow({ schedule: 'Weekends' }), DB_ROWS[1]];
    expect(plan(rows, movedDb).fingerprint).to.not.equal(plan(rows).fingerprint);
  });
});
