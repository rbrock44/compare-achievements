export const environment = {
  production: true,
  // Other non-sensitive config variables
  apiEndpoints: {
    // GitHub Pages only serves static files, so the browser must call the
    // separately-hosted Render server (see render.yaml) instead of a relative path.
    steam: 'https://compare-achievements-api.onrender.com/api/steam',
    psn: 'https://compare-achievements-api.onrender.com/api/psn',
  }
};
