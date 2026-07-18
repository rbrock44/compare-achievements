import { Router, Request, Response } from 'express';
import { PsnApiService } from '../services/psn-api.service';

const router = Router();
const psnService = new PsnApiService();

// Search for users
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query['q'] as string;

    if (!query || query.length < 3) {
      return res.status(400).json({ success: false, error: 'Search query must be at least 3 characters' });
    }

    const result = await psnService.searchUsers(query);
    return res.json(result);
  } catch (error) {
    console.error('Error in search endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get player details
router.get('/players', async (req: Request, res: Response) => {
  try {
    const accountIds = (req.query['ids'] as string).split(',');

    if (!accountIds || accountIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No account IDs provided' });
    }

    const result = await psnService.getPlayerSummaries(accountIds);
    return res.json(result);
  } catch (error) {
    console.error('Error in players endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get owned games
router.get('/games/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    if (!accountId) {
      return res.status(400).json({ success: false, error: 'Account ID is required' });
    }

    const result = await psnService.getOwnedGames(accountId);
    return res.json(result);
  } catch (error) {
    console.error('Error in games endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get common games
router.get('/common-games', async (req: Request, res: Response) => {
  try {
    const accountIds = (req.query['ids'] as string).split(',');

    if (!accountIds || accountIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No account IDs provided' });
    }

    const result = await psnService.findCommonGames(accountIds);
    return res.json(result);
  } catch (error) {
    console.error('Error in common-games endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get player achievements (trophies)
router.get('/achievements/:accountId/:gameId', async (req: Request, res: Response) => {
  try {
    const { accountId, gameId } = req.params;

    if (!accountId || !gameId) {
      return res.status(400).json({ success: false, error: 'Account ID and game ID are required' });
    }

    const result = await psnService.getPlayerAchievements(accountId, gameId);
    return res.json(result);
  } catch (error) {
    console.error('Error in achievements endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get game schema (trophy details)
router.get('/game-schema/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    if (!gameId) {
      return res.status(400).json({ success: false, error: 'Game ID is required' });
    }

    const result = await psnService.getGameSchema(gameId);
    return res.json(result);
  } catch (error) {
    console.error('Error in game-schema endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get friends list
router.get('/friends/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    if (!accountId) {
      return res.status(400).json({ success: false, error: 'Account ID is required' });
    }

    const result = await psnService.getFriendsList(accountId);
    return res.json(result);
  } catch (error) {
    console.error('Error in friends endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
