import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Game } from '../../models/game.interface';
import { User } from '../../models/user.interface';
import { RowSizeService } from '../../services/row-size.service';
import { SteamApiService } from '../../services/steam-api.service';
import { Theme, ThemeService } from '../../services/theme.service';

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
  @ViewChild('userSearchInput') userSearchInput?: ElementRef<HTMLInputElement>;

  platform: string = 'Steam';
  isPlatformDropdownOpen: boolean = false;
  readonly platforms = [
    { id: 'Steam', name: 'Steam', disabled: false },
    { id: 'PSN', name: 'PlayStation Network (Coming Soon)', disabled: true },
    { id: 'Xbox', name: 'Xbox (Coming Soon)', disabled: true },
  ];
  users: User[] = [];
  searchQuery: string = '';
  searchResults: User[] = [];
  friendsCache: User[] = [];
  games: Game[] = [];
  gameSearchQuery: string = '';
  isGameDropdownOpen: boolean = false;
  selectedGame: string = '';
  achievements: Achievement[] = [];
  isLoadingAchievements: boolean = false;
  showOnlyMissing: boolean = false;
  showOnlyMissingAll: boolean = false;
  isSearching: boolean = false;
  isSettingsOpen: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private steamService: SteamApiService,
    public themeService: ThemeService,
    public rowSizeService: RowSizeService
  ) {
  }

  get theme(): Theme {
    return this.themeService.theme;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  get rowSizeScale(): number {
    return this.rowSizeService.rowSize;
  }

  increaseRowSize(): void {
    this.rowSizeService.increaseRowSize();
  }

  decreaseRowSize(): void {
    this.rowSizeService.decreaseRowSize();
  }

  get selectedPlatformName(): string {
    return this.platforms.find(p => p.id === this.platform)?.name ?? this.platform;
  }

  togglePlatformDropdown(): void {
    this.isPlatformDropdownOpen = !this.isPlatformDropdownOpen;
  }

  closePlatformDropdown(): void {
    this.isPlatformDropdownOpen = false;
  }

  selectPlatform(platformId: string): void {
    this.platform = platformId;
    this.isPlatformDropdownOpen = false;
    this.updateUrlParams();
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
      if (!this.users.some(u => u.id === user.id)) {
        this.users.push(user);
        this.loadFriends(user.id);
      }
      if (this.users.length > 0) {
        this.loadCommonGames();
      }
    });
  }

  loadFriends(userId: string): void {
    this.steamService.getFriendsList(userId).subscribe({
      next: friends => this.mergeFriends(friends),
      error: () => {}
    });
  }

  // Merge newly-loaded friends into the shared friends list, avoiding duplicates
  private mergeFriends(friends: User[]): void {
    const existingIds = new Set(this.friendsCache.map(f => f.id));
    const newFriends = friends.filter(f => !existingIds.has(f.id));
    if (newFriends.length > 0) {
      this.friendsCache = [...this.friendsCache, ...newFriends]
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  // Rebuild the friends list from scratch for all currently added users
  private reloadAllFriends(): void {
    this.friendsCache = [];
    this.users.forEach(u => this.loadFriends(u.id));
  }

  // Friends already in the cache whose name matches the search query
  private getMatchingFriends(query: string): User[] {
    return this.friendsCache.filter(f =>
      !this.users.some(u => u.id === f.id) &&
      f.name.toLowerCase().includes(query)
    );
  }

  searchUsers(): void {
    if (this.searchQuery.length < 3) return;

    this.isSearching = true;
    const query = this.searchQuery.toLowerCase();
    const friendMatches = this.getMatchingFriends(query);

    this.steamService.searchUsers(query).subscribe({
      next: users => {
        const knownIds = new Set([...friendMatches.map(f => f.id), ...this.users.map(u => u.id)]);
        const steamMatches = users.filter(u => !knownIds.has(u.id));
        this.searchResults = [...friendMatches, ...steamMatches];
        this.isSearching = false;
      },
      error: () => this.isSearching = false
    });
  }

  handleSearchInput(): void {
    if (this.searchQuery.length === 0) {
      this.showFriendSuggestions();
      return;
    }

    this.searchResults = this.getMatchingFriends(this.searchQuery.toLowerCase());

    if (this.searchQuery.length > 2) {
      this.searchUsers();
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
      this.users.push(user);
      this.searchQuery = '';
      this.searchResults = [];
      this.isGameDropdownOpen = false;
      this.userSearchInput?.nativeElement.blur();
      this.loadFriends(user.id);
      this.loadCommonGames();
      this.updateUrlParams();
    }
  }

  removeUser(userId: string): void {
    this.users = this.users.filter(u => u.id !== userId);
    if (this.users.length > 0) {
      this.loadCommonGames();
      this.reloadAllFriends();
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
      this.games = [...commonGames].sort((a, b) => a.name.localeCompare(b.name));
      this.syncGameSearchQueryWithSelection();
    });
  }

  // Games filtered by the search query, kept in alphabetical order
  get filteredGames(): Game[] {
    const query = this.gameSearchQuery.trim().toLowerCase();
    if (!query) return this.games;
    return this.games.filter(game => game.name.toLowerCase().includes(query));
  }

  onGameSearchFocus(): void {
    this.isGameDropdownOpen = true;
  }

  onGameSearchBlur(): void {
    this.isGameDropdownOpen = false;
    // Restore the text box to reflect the current selection if the user
    // clicked away without picking one of the filtered options
    this.syncGameSearchQueryWithSelection();
  }

  private syncGameSearchQueryWithSelection(): void {
    const game = this.games.find(g => g.id === this.selectedGame);
    this.gameSearchQuery = game ? game.name : '';
  }

  clearGameSearch(): void {
    this.gameSearchQuery = '';
    this.selectedGame = '';
    this.achievements = [];
    this.isLoadingAchievements = false;
    this.isGameDropdownOpen = true;
  }

  selectGame(gameId: string): void {
    this.selectedGame = gameId;
    this.isGameDropdownOpen = false;
    this.syncGameSearchQueryWithSelection();
    if (gameId) {
      this.loadAchievements(gameId);
    } else {
      this.achievements = [];
      this.isLoadingAchievements = false;
    }
    this.updateUrlParams();
  }

  loadAchievements(gameId: string): void {
    const appId = +gameId;
    this.isLoadingAchievements = true;

    this.steamService.getGameSchema(appId).subscribe({
      next: schema => {
        const achievementCalls = this.users.map(user =>
          this.steamService.getPlayerAchievements(user.id, appId).pipe(
            catchError(() => of(null))
          )
        );

        forkJoin(achievementCalls.length ? achievementCalls : [of(null)]).subscribe({
          next: results => {
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
            this.isLoadingAchievements = false;
          },
          error: () => this.isLoadingAchievements = false
        });
      },
      error: () => this.isLoadingAchievements = false
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
