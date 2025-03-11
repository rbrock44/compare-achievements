import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SteamApiService {
  private apiUrl = environment.apiEndpoints.steam;

  constructor(private http: HttpClient) {}

  searchUsers(query: string): Observable<any> {
    const params = new HttpParams().set('q', query);
    return this.http.get(`${this.apiUrl}/search`, { params });
  }

  getPlayerSummaries(steamIds: string[]): Observable<any> {
    const params = new HttpParams().set('ids', steamIds.join(','));
    return this.http.get(`${this.apiUrl}/players`, { params });
  }

  getOwnedGames(steamId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/games/${steamId}`);
  }

  getCommonGames(steamIds: string[]): Observable<any> {
    const params = new HttpParams().set('ids', steamIds.join(','));
    return this.http.get(`${this.apiUrl}/common-games`, { params });
  }

  getPlayerAchievements(steamId: string, appId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/achievements/${steamId}/${appId}`);
  }

  getGameSchema(appId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/game-schema/${appId}`);
  }

  getFriendsList(steamId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/friends/${steamId}`);
  }
}
