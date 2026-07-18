import { Observable } from 'rxjs';
import { User } from '../models/user.interface';
import { Game } from '../models/game.interface';
import { Achievement } from '../models/achievement.interface';

export interface AchievementSchemaEntry {
  name: string;
  displayName: string;
  description?: string;
  icon: string;
  icongray: string;
}

// Implemented in parallel by SteamApiService and PsnApiService so ComparisonComponent can
// swap between platforms by picking which implementation to call, without branching on
// platform at every call site.
export interface PlatformApiService {
  searchUsers(query: string): Observable<User[]>;
  getPlayerSummaries(userIds: string[]): Observable<User[]>;
  getOwnedGames(userId: string): Observable<Game[]>;
  getCommonGames(userIds: string[]): Observable<Game[]>;
  getPlayerAchievements(userId: string, gameId: string): Observable<{ achievements: Achievement[]; gameName: string } | null>;
  getGameSchema(gameId: string): Observable<{ achievements: AchievementSchemaEntry[]; name: string }>;
  getFriendsList(userId: string): Observable<User[]>;
}
