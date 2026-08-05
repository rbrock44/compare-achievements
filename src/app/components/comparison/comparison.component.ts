import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Game } from '../../models/game.interface';
import { User } from '../../models/user.interface';
import { RowSizeService } from '../../services/row-size.service';
import { SteamApiService } from '../../services/steam-api.service';
import { PsnApiService } from '../../services/psn-api.service';
import { PlatformApiService } from '../../services/platform-api.interface';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [
    SteamApiService,
    PsnApiService
  ]
})
export class ComparisonComponent implements OnInit {
  @ViewChild('userSearchInput') userSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('platformTrigger') platformTrigger?: ElementRef<HTMLButtonElement>;

  // Setter-based ViewChild: fires as soon as the (conditionally-rendered) platform
  // listbox appears in the DOM, so keyboard focus can move into it immediately.
  @ViewChild('platformListbox') set platformListboxRef(ref: ElementRef<HTMLUListElement> | undefined) {
    ref?.nativeElement.focus();
  }

  // Setter-based ViewChild: fires as soon as the Settings modal panel appears in the
  // DOM, so we can move focus into it and keep a reference for the Tab-cycle trap.
  @ViewChild('settingsPanel') set settingsPanelRef(ref: ElementRef<HTMLElement> | undefined) {
    this.settingsPanelElement = ref?.nativeElement ?? null;
    if (ref) {
      const firstFocusable = ref.nativeElement.querySelector<HTMLElement>(
        'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (firstFocusable ?? ref.nativeElement).focus();
    }
  }

  platform: string = 'Steam';
  isPlatformDropdownOpen: boolean = false;
  highlightedPlatformIndex: number = -1;
  readonly platforms = [
    { id: 'Steam', name: 'Steam', disabled: false },
    { id: 'PSN', name: 'PlayStation Network', disabled: false },
    { id: 'Xbox', name: 'Xbox (Coming Soon)', disabled: true },
  ];
  users: User[] = [];
  searchQuery: string = '';
  searchResults: User[] = [];
  friendsCache: User[] = [];
  games: Game[] = [];
  gameSearchQuery: string = '';
  isGameDropdownOpen: boolean = false;
  highlightedGameIndex: number = -1;
  selectedGame: string = '';
  achievements: Achievement[] = [];
  isLoadingAchievements: boolean = false;
  showOnlyMissing: boolean = false;
  showOnlyMissingAll: boolean = false;
  isSearching: boolean = false;
  isSettingsOpen: boolean = false;
  private lastFocusedElementBeforeSettings: HTMLElement | null = null;
  private settingsPanelElement: HTMLElement | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private steamService: SteamApiService,
    private psnService: PsnApiService,
    public themeService: ThemeService,
    public rowSizeService: RowSizeService
  ) {
  }

  private get activeService(): PlatformApiService {
    return this.platform === 'PSN' ? this.psnService : this.steamService;
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
    if (this.isPlatformDropdownOpen) {
      this.closePlatformDropdown();
    } else {
      this.openPlatformDropdown();
    }
  }

  openPlatformDropdown(): void {
    this.isPlatformDropdownOpen = true;
    const currentIndex = this.platforms.findIndex(p => p.id === this.platform);
    this.highlightedPlatformIndex = currentIndex >= 0 ? currentIndex : 0;
  }

  closePlatformDropdown(): void {
    this.isPlatformDropdownOpen = false;
  }

  // Handles Enter/Space/ArrowUp/ArrowDown on the trigger button while the listbox is
  // closed. Once open, keyboard handling moves to the listbox itself (see
  // onPlatformListboxKeydown) so the option list can be navigated with the arrow keys.
  onPlatformTriggerKeydown(event: KeyboardEvent): void {
    if (this.isPlatformDropdownOpen) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openPlatformDropdown();
    }
  }

  // Arrow-key navigation, Enter-to-select and Escape-to-close for the open platform
  // listbox, per the WAI-ARIA APG listbox pattern.
  onPlatformListboxKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveHighlightedPlatform(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveHighlightedPlatform(-1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.selectHighlightedPlatform();
        break;
      case 'Escape':
        event.preventDefault();
        this.closePlatformDropdown();
        this.platformTrigger?.nativeElement.focus();
        break;
    }
  }

  // Focus leaving the whole platform-picker container (button + listbox) closes the
  // dropdown, same as the previous button-only (blur) behavior, but without closing
  // when focus simply moves from the button into the listbox on open.
  onPlatformContainerFocusOut(event: FocusEvent): void {
    const container = event.currentTarget as HTMLElement;
    const next = event.relatedTarget as Node | null;
    if (!next || !container.contains(next)) {
      this.closePlatformDropdown();
    }
  }

  private moveHighlightedPlatform(delta: number): void {
    const count = this.platforms.length;
    if (count === 0) return;
    let index = this.highlightedPlatformIndex;
    for (let i = 0; i < count; i++) {
      index = (index + delta + count) % count;
      if (!this.platforms[index].disabled) {
        this.highlightedPlatformIndex = index;
        return;
      }
    }
  }

  private selectHighlightedPlatform(): void {
    const option = this.platforms[this.highlightedPlatformIndex];
    if (option && !option.disabled) {
      this.selectPlatform(option.id);
      this.platformTrigger?.nativeElement.focus();
    }
  }

  get highlightedPlatformOptionId(): string | null {
    if (!this.isPlatformDropdownOpen || this.highlightedPlatformIndex < 0) return null;
    const option = this.platforms[this.highlightedPlatformIndex];
    return option ? `platform-option-${option.id}` : null;
  }

  selectPlatform(platformId: string): void {
    this.isPlatformDropdownOpen = false;
    if (platformId === this.platform) return;

    this.platform = platformId;
    // User/game/friend IDs are platform-specific, so stale state from the previous
    // platform would otherwise be sent to the newly-selected platform's API.
    this.users = [];
    this.friendsCache = [];
    this.games = [];
    this.selectedGame = '';
    this.gameSearchQuery = '';
    this.achievements = [];
    this.searchQuery = '';
    this.searchResults = [];
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
    // Explicit null (not just omitting the key) is required to clear a param
    // under queryParamsHandling: 'merge' — otherwise a stale value lingers in the URL.
    const queryParams: any = {
      platform: this.platform,
      users: this.users.length > 0 ? this.users.map(u => u.id).join(',') : null,
      game: this.selectedGame || null,
      missing: this.showOnlyMissing ? 'true' : null,
      missingAll: this.showOnlyMissingAll ? 'true' : null,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  loadUserDetails(userId: string): void {
    this.activeService.getPlayerSummaries([userId]).subscribe(users => {
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
    this.activeService.getFriendsList(userId).subscribe({
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

    this.activeService.searchUsers(query).subscribe({
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
    this.activeService.getCommonGames(this.users.map(x => x.id)).subscribe(commonGames => {
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
    this.highlightedGameIndex = -1;
  }

  onGameSearchBlur(): void {
    this.isGameDropdownOpen = false;
    // Restore the text box to reflect the current selection if the user
    // clicked away without picking one of the filtered options
    this.syncGameSearchQueryWithSelection();
  }

  // Reset the keyboard highlight whenever the filtered list changes underneath it.
  onGameSearchInput(): void {
    this.highlightedGameIndex = -1;
  }

  // Arrow-key navigation, Enter-to-select and Escape-to-close for the game combobox's
  // listbox popup. Focus stays on the text input throughout (standard editable-combobox
  // pattern), so aria-activedescendant on the input tracks the highlighted option.
  onGameSearchKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.isGameDropdownOpen) this.isGameDropdownOpen = true;
        this.moveHighlightedGame(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.isGameDropdownOpen) this.isGameDropdownOpen = true;
        this.moveHighlightedGame(-1);
        break;
      case 'Enter': {
        if (!this.isGameDropdownOpen || this.highlightedGameIndex < 0) return;
        event.preventDefault();
        const game = this.filteredGames[this.highlightedGameIndex];
        if (game) this.selectGame(game.id);
        break;
      }
      case 'Escape':
        if (!this.isGameDropdownOpen) return;
        event.preventDefault();
        this.isGameDropdownOpen = false;
        this.syncGameSearchQueryWithSelection();
        break;
    }
  }

  private moveHighlightedGame(delta: number): void {
    const count = this.filteredGames.length;
    if (count === 0) {
      this.highlightedGameIndex = -1;
      return;
    }
    if (this.highlightedGameIndex < 0) {
      this.highlightedGameIndex = delta > 0 ? 0 : count - 1;
    } else {
      this.highlightedGameIndex = (this.highlightedGameIndex + delta + count) % count;
    }
  }

  get highlightedGameOptionId(): string | null {
    if (!this.isGameDropdownOpen || this.highlightedGameIndex < 0) return null;
    const game = this.filteredGames[this.highlightedGameIndex];
    return game ? `game-option-${game.id}` : null;
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
    this.isLoadingAchievements = true;

    this.activeService.getGameSchema(gameId).subscribe({
      next: schema => {
        const achievementCalls = this.users.map(user =>
          this.activeService.getPlayerAchievements(user.id, gameId).pipe(
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
    if (this.isSettingsOpen) {
      this.closeSettings();
    } else {
      this.openSettings();
    }
  }

  private openSettings(): void {
    this.lastFocusedElementBeforeSettings = document.activeElement as HTMLElement;
    this.isSettingsOpen = true;
  }

  private closeSettings(): void {
    this.isSettingsOpen = false;
    this.lastFocusedElementBeforeSettings?.focus();
    this.lastFocusedElementBeforeSettings = null;
  }

  // Escape-to-close and a minimal Tab-cycle focus trap while the Settings dialog is open.
  onSettingsPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSettings();
      return;
    }
    if (event.key !== 'Tab' || !this.settingsPanelElement) return;

    const focusable = Array.from(
      this.settingsPanelElement.querySelectorAll<HTMLElement>(
        'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  updateSettings(): void {
    this.updateUrlParams();
    this.closeSettings();
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
