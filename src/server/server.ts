import express from 'express';
import * as path from 'path';
import * as dotenv from 'dotenv';
import steamRoutes from './routes/steam-api.routes';
import psnRoutes from './routes/psn-api.routes';
import { Request, Response } from 'express';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env['PORT'] || 4000;

// Check for API keys
if (!process.env['STEAM_API_KEY']) {
  console.error('WARNING: STEAM_API_KEY environment variable is not set.');
}
if (!process.env['PSN_NPSSO']) {
  console.error('WARNING: PSN_NPSSO environment variable is not set.');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/steam', steamRoutes);
app.use('/api/psn', psnRoutes);

// Serve static files from the Angular app
const distPath = path.join(__dirname, '../dist/your-app-name/browser');
app.use(express.static(distPath));

// For all GET requests that aren't for the API, send back index.html
app.get('*', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
