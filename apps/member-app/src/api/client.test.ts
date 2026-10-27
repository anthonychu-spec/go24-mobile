describe('api modules', () => {
  // The app loads client.ts first (via auth), which loads the mock; the mock must not import
  // member.ts back, or member's top-level API_BASE read hits an uninitialised binding.
  it('load client before member without a cycle', () => {
    jest.isolateModules(() => {
      const client = require('./client');
      const member = require('./member');
      expect(member.accountDeletionPageUrl).toBe(`${client.API_BASE}/account-deletion?brand=lab`);
    });
  });

  it('send X-App-Brand on every request', () => {
    const { apiClient, BRAND_HEADERS } = require('./client');
    expect(BRAND_HEADERS).toEqual({ 'X-App-Brand': 'lab' });
    expect(apiClient.defaults.headers['X-App-Brand']).toBe('lab');
  });
});
