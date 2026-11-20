import test from 'node:test';
import assert from 'node:assert/strict';
import { isUuid, validateBuyerMessage, validateListing, validatePhoto } from '../lib/validation';

const validListing = {
  title: 'Desk lamp',
  description: 'Working lamp in good condition, with charging cable.',
  price: '29.50',
  category: 'Electronics',
  sellerEmail: 'seller@example.com',
};

test('listing form accepts complete, reasonable data', () => {
  assert.deepEqual(validateListing(validListing), {});
});

test('listing requires meaningful title, description, category and email', () => {
  const issues = validateListing({ ...validListing, title: ' ', description: '', category: '', sellerEmail: 'nope' });
  assert.ok(issues.title);
  assert.ok(issues.description);
  assert.ok(issues.category);
  assert.ok(issues.sellerEmail);
});

test('listing rejects negative, zero, malformed and excessive prices', () => {
  for (const price of ['-1', '0', 'not-a-number', '2.555', '999999999']) {
    assert.ok(validateListing({ ...validListing, price }).price, price);
  }
});

test('photo upload enforces type and 5 MB size', () => {
  assert.equal(validatePhoto({ type: 'image/jpeg', size: 1024 }), null);
  assert.equal(validatePhoto({ type: 'image/webp', size: 1024 }), null);
  assert.ok(validatePhoto({ type: 'image/svg+xml', size: 1024 }));
  assert.ok(validatePhoto({ type: 'image/png', size: 6 * 1024 * 1024 }));
});

test('buyer message requires a valid email and 1 to 2000 characters', () => {
  assert.deepEqual(validateBuyerMessage({ buyerEmail: 'buyer@example.com', message: 'Is this available?' }), {});
  assert.ok(validateBuyerMessage({ buyerEmail: 'invalid', message: '' }).buyerEmail);
  assert.ok(validateBuyerMessage({ buyerEmail: 'buyer@example.com', message: 'a'.repeat(2001) }).message);
});

test('dynamic item page accepts UUID only', () => {
  assert.equal(isUuid('920f91dd-b9f8-4d0b-a489-47becc12d64e'), true);
  assert.equal(isUuid('../../admin'), false);
});

test('reference category names and optional locations validate', () => {
  assert.deepEqual(validateListing({ ...validListing, category: 'Sporting Goods', location: 'Palo Alto, CA' }), {});
  assert.deepEqual(validateListing({ ...validListing, location: '' }), {});
  assert.ok(validateListing({ ...validListing, location: 'A' }).location);
  assert.ok(validateListing({ ...validListing, location: 'x'.repeat(101) }).location);
});
