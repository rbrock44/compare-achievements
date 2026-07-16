import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {forkJoin, of} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {SteamApiService} from '../../services/steam-api.service';
import {User} from '../../models/user.interface';
import {Game} from '../../models/game.interface';

interface AchievementUserData {
  achieved: boolean;
  unlockTime?: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  users: {
    [userId: string]: AchievementUserData;
  };
}

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
  ],
  selector: 'app-comparison',
  templateUrl: './comparison.component.html',
  styleUrls: ['./comparison.component.scss'],
  providers: [
    SteamApiService
  ]
})
export class ComparisonComponent implements OnInit {
  platform: string = 'Steam';
  users: User[] = [];
  searchQuery: string = '';
  searchResults: User[] = [];
  friendsCache: User[] = [];
  games: Game[] = [];
  selectedGame: string = '';
  achievements: Achievement[] = [];
  showOnlyMissing: boolean = false;
  showOnlyMissingAll: boolean = false;
  isSearching: boolean = false;
  isSettingsOpen: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private steamService: SteamApiService
  ) {
  }

  ngOnInit(): void {
    // Get URL parameters
    this.route.queryParams.subscribe(params => {
      if (params['platform']) this.platform = params['platform'];
      if (params['users']) {
        const userIds = params['users'].split(',');
        // Load user details for each ID
        userIds.forEach((id: any) => this.loadUserDetails(id));
      }
      if (params['game']) {
        this.selectedGame = params['game'];
        this.loadAchievements(this.selectedGame ?? '');
      }
      if (params['missing']) this.showOnlyMissing = params['missing'] === 'true';
      if (params['missingAll']) this.showOnlyMissingAll = params['missingAll'] === 'true';
    });
  }

  updateUrlParams(): void {
    const queryParams: any = {};

    queryParams.platform = this.platform;
    if (this.users.length > 0) queryParams.users = this.users.map(u => u.id).join(',');
    if (this.selectedGame) queryParams.game = this.selectedGame;
    if (this.showOnlyMissing) queryParams.missing = 'true';
    if (this.showOnlyMissingAll) queryParams.missingAll = 'true';

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  loadUserDetails(userId: string): void {
    this.steamService.getPlayerSummaries([userId]).subscribe(users => {
      const user = users[0] ?? { id: userId, name: userId };
      const wasEmpty = this.users.length === 0;
      if (!this.users.some(u => u.id === user.id)) {
        this.users.push(user);
      }
      if (wasEmpty) {
        this.loadFriends(user.id);
      }
      if (this.users.length > 0) {
        this.loadCommonGames();
      }
    });
  }

  loadFriends(userId: string): void {
    this.steamService.getFriendsList(userId).subscribe({
      next: friends => this.friendsCache = friends,
      error: () => this.friendsCache = []
    });
  }

  searchUsers(): void {
    if (this.searchQuery.length < 3) return;

    this.isSearching = true;

    this.steamService.searchUsers(this.searchQuery.toLowerCase()).subscribe({
      next: users => {
        this.searchResults = users;
        this.isSearching = false;
      },
      error: () => this.isSearching = false
    });
  }

  handleSearchInput(): void {
    if (this.searchQuery.length > 2) {
      this.searchUsers();
    } else if (this.searchQuery.length === 0) {
      this.showFriendSuggestions();
    } else {
      this.searchResults = [];
    }
  }

  onSearchFocus(): void {
    if (this.searchQuery.length === 0) {
      this.showFriendSuggestions();
    }
  }

  onSearchBlur(): void {
    this.searchResults = [];
  }

  showFriendSuggestions(): void {
    this.searchResults = this.users.length > 0
      ? this.friendsCache.filter(friend => !this.users.some(u => u.id === friend.id))
      : [];
  }

  addUser(user: User): void {
    if (!this.users.some(u => u.id === user.id)) {
      const wasEmpty = this.users.length === 0;
      this.users.push(user);
      this.searchQuery = '';
      this.searchResults = [];
      if (wasEmpty) {
        this.loadFriends(user.id);
      }
      this.loadCommonGames();
      this.updateUrlParams();
    }
  }

  removeUser(userId: string): void {
    const wasFirstUser = this.users[0]?.id === userId;
    this.users = this.users.filter(u => u.id !== userId);
    if (this.users.length > 0) {
      this.loadCommonGames();
      if (wasFirstUser) {
        this.loadFriends(this.users[0].id);
      }
    } else {
      this.games = [];
      this.selectedGame = '';
      this.achievements = [];
      this.friendsCache = [];
    }
    this.updateUrlParams();
  }

  loadCommonGames(): void {
    this.steamService.getCommonGames(this.users.map(x => x.id)).subscribe(commonGames => {
      this.games = commonGames;
    });
  }

  selectGame(gameId: string): void {
    this.selectedGame = gameId;
    if (gameId) {
      this.loadAchievements(gameId);
    } else {
      this.achievements = [];
    }
    this.updateUrlParams();
  }

  loadAchievements(gameId: string): void {
    const appId = +gameId;

    this.steamService.getGameSchema(appId).subscribe(schema => {
      const achievementCalls = this.users.map(user =>
        this.steamService.getPlayerAchievements(user.id, appId).pipe(
          catchError(() => of(null))
        )
      );

      forkJoin(achievementCalls.length ? achievementCalls : [of(null)]).subscribe(results => {
        this.achievements = schema.achievements.map(def => {
          const usersData: { [userId: string]: AchievementUserData } = {};

          this.users.forEach((user, index) => {
            const userResult = results[index];
            const match = userResult?.achievements.find(a => a.apiname === def.name);

            usersData[user.id] = {
              achieved: match ? match.achieved === 1 : false,
              unlockTime: match?.unlocktime ? new Date(match.unlocktime * 1000).toISOString() : undefined
            };
          });

          return {
            id: def.name,
            name: def.displayName || def.name,
            description: def.description ?? '',
            icon: def.icon,
            users: usersData
          };
        });
      });
    });
  }

  toggleSettings(): void {
    this.isSettingsOpen = !this.isSettingsOpen;
  }

  updateSettings(): void {
    this.updateUrlParams();
    this.isSettingsOpen = false;
  }

  // Filter achievements based on settings
  get filteredAchievements(): Achievement[] {
    return this.achievements.filter(achievement => {
      if (!this.showOnlyMissing && !this.showOnlyMissingAll) return true;

      if (this.showOnlyMissingAll) {
        return Object.values(achievement.users).every(u => !u.achieved);
      }

      if (this.showOnlyMissing) {
        return Object.values(achievement.users).some(u => !u.achieved);
      }

      return true;
    });
  }

  // Format time difference between users
  formatTimeDifference(time1: string, time2: string): string {
    const date1 = new Date(time1);
    const date2 = new Date(time2);
    const diffMs = Math.abs(date1.getTime() - date2.getTime());
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  }

  // Determine who achieved first
  getFirstAchiever(achievement: Achievement): string | null {
    const achieved = Object.entries(achievement.users)
      .filter(([_, data]) => data.achieved)
      .sort(([_, data1], [__, data2]) => {
        if (!data1.unlockTime || !data2.unlockTime) return 0;
        return new Date(data1.unlockTime).getTime() - new Date(data2.unlockTime).getTime();
      });

    return achieved.length > 0 ? achieved[0][0] : null;
  }
}
