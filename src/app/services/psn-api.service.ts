import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from '../models/user.interface';
import { Game } from '../models/game.interface';
import { Achievement } from '../models/achievement.interface';
import { AchievementSchemaEntry, PlatformApiService } from './platform-api.interface';

interface ApiResult<T> {
  success: boolean;
  error?: string;
  [key: string]: any;
}

// Unlike Steam's raw player/achievement payloads, the PSN backend service already normalizes
// its responses into the app's own User/Game/Achievement shapes (PSN's raw shapes are far more
// awkward to work with directly), so no client-side mapper is needed here.
@Injectable({
  providedIn: 'root'
})
export class PsnApiService implements PlatformApiService {
  private apiUrl = environment.apiEndpoints.psn;

  constructor(private http: HttpClient) {}

  searchUsers(query: string): Observable<User[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<ApiResult<{ results: User[] }>>(`${this.apiUrl}/search`, { params }).pipe(
      map(res => (res.success ? (res['results'] as User[]) : []))
    );
  }

  getPlayerSummaries(accountIds: string[]): Observable<User[]> {
    const params = new HttpParams().set('ids', accountIds.join(','));
    return this.http.get<ApiResult<{ players: User[] }>>(`${this.apiUrl}/players`, { params }).pipe(
      map(res => (res.success ? (res['players'] as User[]) : []))
    );
  }

  getOwnedGames(accountId: string): Observable<Game[]> {
    return this.http.get<ApiResult<{ games: Game[] }>>(`${this.apiUrl}/games/${accountId}`).pipe(
      map(res => (res.success ? (res['games'] as Game[]) : []))
    );
  }

  getCommonGames(accountIds: string[]): Observable<Game[]> {
    const params = new HttpParams().set('ids', accountIds.join(','));
    return this.http.get<ApiResult<{ games: Game[] }>>(`${this.apiUrl}/common-games`, { params }).pipe(
      map(res => (res.success ? (res['games'] as Game[]) : []))
    );
  }

  getPlayerAchievements(accountId: string, gameId: string): Observable<{ achievements: Achievement[]; gameName: string } | null> {
    return this.http.get<ApiResult<{ achievements: Achievement[]; gameName: string }>>(`${this.apiUrl}/achievements/${accountId}/${gameId}`).pipe(
      map(res => (res.success ? { achievements: res['achievements'] as Achievement[], gameName: res['gameName'] as string } : null))
    );
  }

  getGameSchema(gameId: string): Observable<{ achievements: AchievementSchemaEntry[]; name: string }> {
    return this.http.get<ApiResult<{ achievements: AchievementSchemaEntry[]; name: string }>>(`${this.apiUrl}/game-schema/${gameId}`).pipe(
      map(res => (res.success ? { achievements: res['achievements'] as AchievementSchemaEntry[], name: res['name'] as string } : { achievements: [], name: '' }))
    );
  }

  getFriendsList(accountId: string): Observable<User[]> {
    return this.http.get<ApiResult<{ friends: { accountId: string }[] }>>(`${this.apiUrl}/friends/${accountId}`).pipe(
      switchMap(res => {
        if (!res.success || !(res['friends'] as { accountId: string }[])?.length) return of([]);
        const friendIds = (res['friends'] as { accountId: string }[]).map(f => f.accountId);
        return this.getPlayerSummaries(friendIds);
      })
    );
  }
}
