import sinon from 'sinon';

import { fetchPost, getCSRFToken } from '../../../javascripts/dify/utils/api';

describe('Dify API CSRF integration', () => {
  let fetchStub;

  beforeEach(() => {
    document.body.innerHTML = '<input id="csrf_token" value="fab-token">';
    fetchStub = sinon.stub(global, 'fetch').resolves({ ok: true });
  });

  afterEach(() => {
    fetchStub.restore();
    document.body.innerHTML = '';
  });

  it('reads the shared layout token and sends it on POST', async () => {
    expect(getCSRFToken()).to.equal('fab-token');

    await fetchPost('/workflow', { query: 'steel' });

    expect(fetchStub.calledOnce).to.equal(true);
    expect(fetchStub.firstCall.args[1].headers['X-CSRFToken']).to.equal('fab-token');
  });
});
