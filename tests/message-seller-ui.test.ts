import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageSellerForm } from '../components/marketplace/message-seller-form';

test('listing detail initially exposes an explicit Message Seller button', () => {
  const html = renderToStaticMarkup(createElement(MessageSellerForm, {
    listingId: 'f83ee645-1364-458e-a0dd-5428507d6a66',
  }));
  assert.match(html, /<button[^>]*>[^<]*Message Seller/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /id="buyer-email"/);
});
