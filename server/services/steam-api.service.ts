import axios from 'axios';
import * as dotenv from 'dotenv';
import { Request, Response } from 'express';

// Load environment variables from .env file (for server-side)
dotenv.config();

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const STEAM_API_BASE_URL = 'https://api.steampowered.com';

if (!STEAM_API_KEY) {
  console.error('STEAM_API_KEY is not defined. Make sure to set it in your environment variables.');
}

export class SteamApiService {

  /**
   * Search for Steam users by username
   */
  async searchUsers(query: string) {
    try {
      // Note: Steam Web API doesn't have a direct search by username endpoint
      // This would typically use a community search or a database of known users
      // For demonstration, we could return dummy data or use a Steam community search

      // In a real implementation, you might use:
      // - Steam community search scraping (not ideal but possible)
      // - Your own database of users
      // - Steam ID resolution if the user enters a valid Steam ID/URL

      // For now, return a mock response
      return { success: true, results: [] };
    } catch (error) {
      console.error('Error searching for Steam users:', error);
      return { success: false, error: 'Failed to search for users' };
    }
  }

  /**
   * Get player summaries by Steam IDs
   */
  async getPlayerSummaries(steamIds: string[]) {
    try {
      const response = await axios.get(`${STEAM_API_BASE_URL}/ISteamUser/GetPlayerSummaries/v2/`, {
        params: {
          key: STEAM_API_KEY,
          steamids: steamIds.join(',')
        }
      });

      return { success: true, players: response.data.response.players };
    } catch (error) {
      console.error('Error getting player summaries:', error);
      return { success: false, error: 'Failed to get player information' };
    }
  }

  /**
   * Get user's owned games
   */
  async getOwnedGames(steamId: string) {
    try {
      const response = await axios.get(`${STEAM_API_BASE_URL}/IPlayerService/GetOwnedGames/v1/`, {
        params: {
          key: STEAM_API_KEY,
          steamid: steamId,
          include_appinfo: 1,
          include_played_free_games: 1
        }
      });

      return { success: true, games: response.data.response.games || [] };
    } catch (error) {
      console.error('Error getting owned games:', error);
      return { success: false, error: 'Failed to get games list' };
    }
  }

  /**
   * Get player achievements for a game
   */
  async getPlayerAchievements(steamId: string, appId: number) {
    try {
      const response = await axios.get(`${STEAM_API_BASE_URL}/ISteamUserStats/GetPlayerAchievements/v1/`, {
        params: {
          key: STEAM_API_KEY,
          steamid: steamId,
          appid: appId,
          l: 'en'
        }
      });

      // Check for private profiles or games without achievements
      if (!response.data.playerstats.success) {
        return {
          success: false,
          error: response.data.playerstats.error || 'Profile is private or game has no achievements'
        };
      }

      return {
        success: true,
        achievements: response.data.playerstats.achievements,
        gameName: response.data.playerstats.gameName
      };
    } catch (error) {
      console.error('Error getting player achievements:', error);
      return { success: false, error: 'Failed to get achievements' };
    }
  }

  /**
   * Get friends list for a user
   */
  async getFriendsList(steamId: string) {
    try {
      const response = await axios.get(`${STEAM_API_BASE_URL}/ISteamUser/GetFriendList/v1/`, {
        params: {
          key: STEAM_API_KEY,
          steamid: steamId,
          relationship: 'friend'
        }
      });

      return { success: true, friends: response.data.friendslist.friends };
    } catch (error) {
      console.error('Error getting friends list:', error);
      return { success: false, error: 'Failed to get friends list or profile is private' };
    }
  }

  /**
   * Get game schema (achievement details)
   */
  async getGameSchema(appId: number) {
    try {
      const response = await axios.get(`${STEAM_API_BASE_URL}/ISteamUserStats/GetSchemaForGame/v2/`, {
        params: {
          key: STEAM_API_KEY,
          appid: appId,
          l: 'en'
        }
      });

      return {
        success: true,
        achievements: response.data.game.availableGameStats?.achievements || [],
        name: response.data.game.gameName
      };
    } catch (error) {
      console.error('Error getting game schema:', error);
      return { success: false, error: 'Failed to get game details' };
    }
  }

  /**
   * Find common games between multiple users
   */
  async findCommonGames(steamIds: string[]) {
    try {
      // Get games for each user
      const gamePromises = steamIds.map(id => this.getOwnedGames(id));
      const results = await Promise.all(gamePromises);

      // Check for any errors
      for (let i = 0; i < results.length; i++) {
        if (!results[i].success) {
          return {
            success: false,
            error: `Failed to get games for user ${steamIds[i]}: ${results[i].error}`
          };
        }
      }

      // Extract game lists
      const gameLists = results.map(result => result.games);

      // Find common games (intersection of all game lists)
      let commonGames = gameLists[0];

      for (let i = 1; i < gameLists.length; i++) {
        const currentGames = gameLists[i];
        commonGames = commonGames.filter(game =>
          currentGames.some(g => g.appid === game.appid)
        );
      }

      return { success: true, games: commonGames };
    } catch (error) {
      console.error('Error finding common games:', error);
      return { success: false, error: 'Failed to find common games' };
    }
  }
}
