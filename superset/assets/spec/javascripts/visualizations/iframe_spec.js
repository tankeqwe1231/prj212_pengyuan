import { expect } from 'chai';

const { appendIframeToken } = require('../../../visualizations/iframe');

describe('iframe token url', () => {
  it('leaves the url unchanged when there is no token', () => {
    expect(appendIframeToken('https://example.com/flash?username_fengyun=admin', ''))
      .to.equal('https://example.com/flash?username_fengyun=admin');
    expect(appendIframeToken('https://example.com/flash', null))
      .to.equal('https://example.com/flash');
  });

  it('appends iframe_token to a url that already has a query', () => {
    expect(appendIframeToken(
      'https://example.com/flash?username_fengyun=admin',
      'v1.abc-def_ghi',
    )).to.equal(
      'https://example.com/flash?username_fengyun=admin&iframe_token=v1.abc-def_ghi',
    );
  });

  it('starts the query when the url has no parameters', () => {
    expect(appendIframeToken('https://example.com/flash', 'v1.token'))
      .to.equal('https://example.com/flash?iframe_token=v1.token');
  });

  it('encodes reserved characters in the ciphertext', () => {
    expect(appendIframeToken('https://example.com/flash', 'a+b/c'))
      .to.equal('https://example.com/flash?iframe_token=a%2Bb%2Fc');
  });
});
