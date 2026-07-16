import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from '../models/user.interface';
import { Game } from '../models/game.interface';
import { Achievement } from '../models/achievement.interface';
import { SteamUser } from '../models/steam-user.interface';

interface ApiResult<T> {
  success: boolean;
  error?: string;
  [key: string]: any;
}

export interface AchievementSchemaEntry {
  name: string;
  displayName: string;
  description?: string;
  icon: string;
  icongray: string;
}

function toUser(steamUser: SteamUser): User {
  return {
    id: steamUser.steamid,
    name: steamUser.personaname,
    avatar: steamUser.avatarmedium,
    isFriend: steamUser.isFriend
  };
}

@Injectable({
  providedIn: 'root'
})
export class SteamApiService {
  private apiUrl = environment.apiEndpoints.steam;

  constructor(private http: HttpClient) {}

  searchUsers(query: string): Observable<User[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<ApiResult<{ results: SteamUser[] }>>(`${this.apiUrl}/search`, { params }).pipe(
      map(res => (res.success ? (res['results'] as SteamUser[]).map(toUser) : []))
    );
  }

  getPlayerSummaries(steamIds: string[]): Observable<User[]> {
    const params = new HttpParams().set('ids', steamIds.join(','));
    return this.http.get<ApiResult<{ players: SteamUser[] }>>(`${this.apiUrl}/players`, { params }).pipe(
      map(res => (res.success ? (res['players'] as SteamUser[]).map(toUser) : []))
    );
  }

  getOwnedGames(steamId: string): Observable<Game[]> {
    return this.http.get<ApiResult<{ games: Game[] }>>(`${this.apiUrl}/games/${steamId}`).pipe(
      map(res => (res.success ? (res['games'] as Game[]) : []))
    );
  }

  getCommonGames(steamIds: string[]): Observable<Game[]> {
    const params = new HttpParams().set('ids', steamIds.join(','));
    return this.http.get<ApiResult<{ games: Game[] }>>(`${this.apiUrl}/common-games`, { params }).pipe(
      map(res => (res.success ? (res['games'] as Game[]) : []))
    );
  }

  getPlayerAchievements(steamId: string, appId: number): Observable<{ achievements: Achievement[]; gameName: string } | null> {
    return this.http.get<ApiResult<{ achievements: Achievement[]; gameName: string }>>(`${this.apiUrl}/achievements/${steamId}/${appId}`).pipe(
      map(res => (res.success ? { achievements: res['achievements'] as Achievement[], gameName: res['gameName'] as string } : null))
    );
  }

  getGameSchema(appId: number): Observable<{ achievements: AchievementSchemaEntry[]; name: string }> {
    return this.http.get<ApiResult<{ achievements: AchievementSchemaEntry[]; name: string }>>(`${this.apiUrl}/game-schema/${appId}`).pipe(
      map(res => (res.success ? { achievements: res['achievements'] as AchievementSchemaEntry[], name: res['name'] as string } : { achievements: [], name: '' }))
    );
  }

  getFriendsList(steamId: string): Observable<User[]> {
    return this.http.get<ApiResult<{ friends: { steamid: string }[] }>>(`${this.apiUrl}/friends/${steamId}`).pipe(
      switchMap(res => {
        if (!res.success || !(res['friends'] as { steamid: string }[])?.length) return of([]);
        const friendIds = (res['friends'] as { steamid: string }[]).map(f => f.steamid);
        return this.getPlayerSummaries(friendIds);
      })
    );
  }
}
