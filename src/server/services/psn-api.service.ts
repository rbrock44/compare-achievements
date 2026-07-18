import * as dotenv from 'dotenv';
import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
  makeUniversalSearch,
  getProfileFromAccountId,
  getUserFriendsAccountIds,
  getUserTitles,
  getTitleTrophies,
  getUserTrophiesEarnedForTitle
} from 'psn-api';
import type { AuthTokensResponse, TrophyTitle } from 'psn-api';
import { Game } from '../../app/models/game.interface';
import { User } from '../../app/models/user.interface';
import { Achievement } from '../../app/models/achievement.interface';

// Load environment variables from .env file (for server-side)
dotenv.config();

const PSN_NPSSO = process.env['PSN_NPSSO'];

if (!PSN_NPSSO) {
  console.error('PSN_NPSSO is not defined. Make sure to set it in your environment variables.');
}

// A PSN game (trophy title) is identified by an npCommunicationId, but fetching its trophy
// data also requires knowing which trophy service ("trophy" for PS3/PS4/Vita, "trophy2" for
// PS5) it belongs to. Games.id is an opaque string to the frontend, so both values are packed
// into it here and split back apart wherever a gameId comes back in from a request.
type NpServiceName = 'trophy' | 'trophy2';

function encodeGameId(npCommunicationId: string, npServiceName: NpServiceName): string {
  return `${npCommunicationId}::${npServiceName}`;
}

function decodeGameId(gameId: string): { npCommunicationId: string; npServiceName: NpServiceName } {
  const [npCommunicationId, npServiceName] = gameId.split('::');
  return { npCommunicationId, npServiceName: npServiceName === 'trophy' ? 'trophy' : 'trophy2' };
}

function toGame(title: TrophyTitle): Game {
  return {
    id: encodeGameId(title.npCommunicationId, title.npServiceName),
    name: title.trophyTitleName,
    imgIconUrl: title.trophyTitleIconUrl
  };
}

export class PsnApiService {
  // Sony has no official public API, so this authenticates as a single PSN account (via an
  // npsso token, analogous to STEAM_API_KEY) and reuses that session for every request. The
  // access token is short-lived; it's refreshed transparently using the longer-lived refresh
  // token, falling back to a fresh npsso exchange only once the refresh token itself expires.
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private refreshToken: string | null = null;
  private refreshTokenExpiresAt = 0;
  private readonly TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

  // Trophy definitions for a title almost never change, so cache them to avoid re-hitting
  // PSN's rate-limited API on every comparison load.
  private schemaCache = new Map<string, { data: { achievements: any[]; name: string }; expiresAt: number }>();
  private readonly SCHEMA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  private storeTokens(tokens: AuthTokensResponse): void {
    this.accessToken = tokens.accessToken;
    this.accessTokenExpiresAt = Date.now() + tokens.expiresIn * 1000;
    this.refreshToken = tokens.refreshToken;
    this.refreshTokenExpiresAt = Date.now() + tokens.refreshTokenExpiresIn * 1000;
  }

  private async getAuthorization(): Promise<{ accessToken: string }> {
    const now = Date.now();

    if (this.accessToken && now < this.accessTokenExpiresAt - this.TOKEN_EXPIRY_BUFFER_MS) {
      return { accessToken: this.accessToken };
    }

    if (this.refreshToken && now < this.refreshTokenExpiresAt - this.TOKEN_EXPIRY_BUFFER_MS) {
      this.storeTokens(await exchangeRefreshTokenForAuthTokens(this.refreshToken));
      return { accessToken: this.accessToken as string };
    }

    if (!PSN_NPSSO) {
      throw new Error('PSN_NPSSO is not configured');
    }

    const accessCode = await exchangeNpssoForAccessCode(PSN_NPSSO);
    this.storeTokens(await exchangeAccessCodeForAuthTokens(accessCode));
    return { accessToken: this.accessToken as string };
  }

  /**
   * Resolve PSN users by online ID via PSN's universal search.
   */
  async searchUsers(query: string) {
    try {
      const auth = await this.getAuthorization();
      const searchResult = await makeUniversalSearch(auth, query, 'SocialAllAccounts');
      const accounts = searchResult.domainResponses[0]?.results ?? [];

      const results: User[] = accounts.map(account => ({
        id: account.socialMetadata.accountId,
        name: account.socialMetadata.onlineId,
        avatar: account.socialMetadata.avatarUrl
      }));

      return { success: true, results };
    } catch (error) {
      console.error('Error searching for PSN users:', error);
      return { success: false, error: 'Failed to search for users' };
    }
  }

  /**
   * Get player profiles by account IDs. PSN has no batch profile endpoint, so this fans out
   * one request per ID and quietly drops any that fail (private profile, bad ID, etc.),
   * mirroring how Steam's batch call just omits players it can't find.
   */
  async getPlayerSummaries(accountIds: string[]) {
    try {
      const auth = await this.getAuthorization();
      const settled = await Promise.allSettled(
        accountIds.map(async (accountId): Promise<User> => {
          const profile = await getProfileFromAccountId(auth, accountId);
          return {
            id: accountId,
            name: profile.onlineId,
            avatar: profile.avatars?.find(a => a.size === 'm')?.url ?? profile.avatars?.[0]?.url
          };
        })
      );

      const players = settled
        .filter((r): r is PromiseFulfilledResult<User> => r.status === 'fulfilled')
        .map(r => r.value);

      return { success: true, players };
    } catch (error) {
      console.error('Error getting player summaries:', error);
      return { success: false, error: 'Failed to get player information' };
    }
  }

  /**
   * Get a user's trophy titles (owned games).
   */
  async getOwnedGames(accountId: string) {
    try {
      const auth = await this.getAuthorization();
      // PSN caps a single page at 800 titles; that covers the vast majority of accounts
      // without needing to implement offset-based pagination.
      const response = await getUserTitles(auth, accountId, { limit: 800 });
      const games: Game[] = response.trophyTitles.map(toGame);

      return { success: true, games };
    } catch (error) {
      console.error('Error getting owned games:', error);
      return { success: false, error: 'Failed to get games list' };
    }
  }

  /**
   * Get a user's earned trophies for a title.
   */
  async getPlayerAchievements(accountId: string, gameId: string) {
    try {
      const auth = await this.getAuthorization();
      const { npCommunicationId, npServiceName } = decodeGameId(gameId);
      const response = await getUserTrophiesEarnedForTitle(auth, accountId, npCommunicationId, 'all', { npServiceName });

      const achievements: Achievement[] = response.trophies.map(trophy => ({
        apiname: String(trophy.trophyId),
        name: '',
        description: '',
        achieved: trophy.earned ? 1 : 0,
        unlocktime: trophy.earnedDateTime ? Math.floor(new Date(trophy.earnedDateTime).getTime() / 1000) : 0,
        icon: '',
        icongray: ''
      }));

      // The frontend already knows the game's display name from the owned-games list, so
      // this field (kept only for parity with the Steam service's response shape) is unused.
      return { success: true, achievements, gameName: '' };
    } catch (error) {
      console.error('Error getting player achievements:', error);
      return { success: false, error: 'Failed to get achievements' };
    }
  }

  /**
   * Get a user's friends list (their friended account IDs only — resolved to profiles by the
   * caller via getPlayerSummaries, same two-step pattern as the Steam friends list).
   */
  async getFriendsList(accountId: string) {
    try {
      const auth = await this.getAuthorization();
      const response = await getUserFriendsAccountIds(auth, accountId);
      return { success: true, friends: response.friends.map(id => ({ accountId: id })) };
    } catch (error) {
      console.error('Error getting friends list:', error);
      return { success: false, error: 'Failed to get friends list or profile is private' };
    }
  }

  /**
   * Get a title's trophy definitions (achievement schema equivalent).
   */
  async getGameSchema(gameId: string) {
    const cached = this.schemaCache.get(gameId);
    if (cached && cached.expiresAt > Date.now()) {
      return { success: true, ...cached.data };
    }

    try {
      const auth = await this.getAuthorization();
      const { npCommunicationId, npServiceName } = decodeGameId(gameId);
      const response = await getTitleTrophies(auth, npCommunicationId, 'all', { npServiceName });

      const achievements = response.trophies.map(trophy => ({
        name: String(trophy.trophyId),
        displayName: trophy.trophyName ?? '',
        description: trophy.trophyDetail,
        icon: trophy.trophyIconUrl ?? '',
        icongray: trophy.trophyIconUrl ?? ''
      }));

      const data = { achievements, name: '' };
      this.schemaCache.set(gameId, { data, expiresAt: Date.now() + this.SCHEMA_CACHE_TTL_MS });

      return { success: true, ...data };
    } catch (error) {
      console.error('Error getting game schema:', error);
      return { success: false, error: 'Failed to get game details' };
    }
  }

  /**
   * Find common games between multiple users
   */
  async findCommonGames(accountIds: string[]) {
    try {
      const gamePromises = accountIds.map(id => this.getOwnedGames(id));
      const results = await Promise.all(gamePromises);

      for (let i = 0; i < results.length; i++) {
        if (!results[i].success) {
          return {
            success: false,
            error: `Failed to get games for user ${accountIds[i]}: ${results[i].error}`
          };
        }
      }

      const gameLists: Game[][] = results.map(result => result.games || []);
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
