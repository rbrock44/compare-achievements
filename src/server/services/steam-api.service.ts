import axios from 'axios';
import * as dotenv from 'dotenv';
import { Request, Response } from 'express';
import {Game} from '../../app/models/game.interface';

// Load environment variables from .env file (for server-side)
dotenv.config();

const STEAM_API_KEY = process.env['STEAM_API_KEY'];
const STEAM_API_BASE_URL = 'https://api.steampowered.com';

if (!STEAM_API_KEY) {
  console.error('STEAM_API_KEY is not defined. Make sure to set it in your environment variables.');
}

export class SteamApiService {

  /**
   * Resolve a Steam user by SteamID64 or vanity URL name.
   * The Steam Web API has no free-text username search, so this resolves
   * a single exact match: a 17-digit SteamID64 is used directly, otherwise
   * the query is treated as a vanity URL name and resolved first.
   */
  async searchUsers(query: string) {
    try {
      let steamId = query;

      if (!/^\d{17}$/.test(query)) {
        const resolveResponse = await axios.get(`${STEAM_API_BASE_URL}/ISteamUser/ResolveVanityURL/v1/`, {
          params: {
            key: STEAM_API_KEY,
            vanityurl: query
          }
        });

        if (resolveResponse.data.response.success !== 1) {
          return { success: true, results: [] };
        }

        steamId = resolveResponse.data.response.steamid;
      }

      const summaries = await this.getPlayerSummaries([steamId]);
      if (!summaries.success) {
        return { success: true, results: [] };
      }

      return { success: true, results: summaries.players };
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

      const rawGames = response.data.response.games || [];
      const games: Game[] = rawGames.map((g: any) => ({
        id: g.appid.toString(),
        name: g.name,
        imgIconUrl: g.img_icon_url,
        playtimeForever: g.playtime_forever
      }));

      return { success: true, games };
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
      const gameLists: Game[][] = results.map(result => result.games || []);

      // Find common games (intersection of all game lists)
      let commonGames: Game[] = gameLists[0] || [];

      for (let i = 1; i < gameLists.length; i++) {
        const currentGames = gameLists[i] || [];
        commonGames = commonGames.filter((game: Game) =>
          currentGames.some((g: Game) => g.id === game.id)
        );
      }

      return { success: true, games: commonGames };
    } catch (error) {
      console.error('Error finding common games:', error);
      return { success: false, error: 'Failed to find common games' };
    }
  }
}
