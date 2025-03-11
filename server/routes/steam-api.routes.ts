import { Router, Request, Response } from 'express';
import { SteamApiService } from '../services/steam-api.service';

const router = Router();
const steamService = new SteamApiService();

// Search for users
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;

    if (!query || query.length < 3) {
      return res.status(400).json({ success: false, error: 'Search query must be at least 3 characters' });
    }

    const result = await steamService.searchUsers(query);
    return res.json(result);
  } catch (error) {
    console.error('Error in search endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get player details
router.get('/players', async (req: Request, res: Response) => {
  try {
    const steamIds = (req.query.ids as string).split(',');

    if (!steamIds || steamIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No Steam IDs provided' });
    }

    const result = await steamService.getPlayerSummaries(steamIds);
    return res.json(result);
  } catch (error) {
    console.error('Error in players endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get owned games
router.get('/games/:steamId', async (req: Request, res: Response) => {
  try {
    const { steamId } = req.params;

    if (!steamId) {
      return res.status(400).json({ success: false, error: 'Steam ID is required' });
    }

    const result = await steamService.getOwnedGames(steamId);
    return res.json(result);
  } catch (error) {
    console.error('Error in games endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get common games
router.get('/common-games', async (req: Request, res: Response) => {
  try {
    const steamIds = (req.query.ids as string).split(',');

    if (!steamIds || steamIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No Steam IDs provided' });
    }

    const result = await steamService.findCommonGames(steamIds);
    return res.json(result);
  } catch (error) {
    console.error('Error in common-games endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get player achievements
router.get('/achievements/:steamId/:appId', async (req: Request, res: Response) => {
  try {
    const { steamId, appId } = req.params;

    if (!steamId || !appId) {
      return res.status(400).json({ success: false, error: 'Steam ID and App ID are required' });
    }

    const result = await steamService.getPlayerAchievements(steamId, parseInt(appId));
    return res.json(result);
  } catch (error) {
    console.error('Error in achievements endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get game schema (achievement details)
router.get('/game-schema/:appId', async (req: Request, res: Response) => {
  try {
    const { appId } = req.params;

    if (!appId) {
      return res.status(400).json({ success: false, error: 'App ID is required' });
    }

    const result = await steamService.getGameSchema(parseInt(appId));
    return res.json(result);
  } catch (error) {
    console.error('Error in game-schema endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get friends list
router.get('/friends/:steamId', async (req: Request, res: Response) => {
  try {
    const { steamId } = req.params;

    if (!steamId) {
      return res.status(400).json({ success: false, error: 'Steam ID is required' });
    }

    const result = await steamService.getFriendsList(steamId);
    return res.json(result);
  } catch (error) {
    console.error('Error in friends endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
