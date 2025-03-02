import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';

interface User {
  id: string;
  name: string;
  avatar?: string;
  isFriend?: boolean;
}

interface Game {
  id: string;
  name: string;
}

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
  styleUrls: ['./comparison.component.scss']
})
export class ComparisonComponent implements OnInit {
  platform: string = 'Steam';
  users: User[] = [];
  searchQuery: string = '';
  searchResults: User[] = [];
  games: Game[] = [];
  selectedGame: string = '';
  achievements: Achievement[] = [];
  showOnlyMissing: boolean = false;
  showOnlyMissingAll: boolean = false;
  isSearching: boolean = false;
  isSettingsOpen: boolean = false;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
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
    // In a real app, call your API to get user details
    // For demo, we'll add a placeholder user
    this.users.push({
      id: userId,
      name: userId // In real app, get actual name from API
    });

    if (this.users.length > 0) {
      this.loadCommonGames();
    }
  }

  searchUsers(): void {
    if (this.searchQuery.length < 3) return;

    this.isSearching = true;

    // In a real app, call your Steam API
    // For demo purposes, we'll simulate an API call
    setTimeout(() => {
      this.searchResults = [
        {id: 'user1', name: 'SteamUser1', avatar: 'https://via.placeholder.com/40'},
        {id: 'user2', name: 'SteamFriend1', avatar: 'https://via.placeholder.com/40', isFriend: true},
        {id: 'user3', name: 'RandomUser', avatar: 'https://via.placeholder.com/40'}
      ].filter(user => user.name.toLowerCase().includes(this.searchQuery.toLowerCase()));
      this.isSearching = false;
    }, 300);
  }

  handleSearchInput(): void {
    if (this.searchQuery.length > 2) {
      this.searchUsers();
    } else {
      this.searchResults = [];
    }
  }

  addUser(user: User): void {
    if (!this.users.some(u => u.id === user.id)) {
      this.users.push(user);
      this.searchQuery = '';
      this.searchResults = [];
      this.loadCommonGames();
      this.updateUrlParams();
    }
  }

  removeUser(userId: string): void {
    this.users = this.users.filter(u => u.id !== userId);
    if (this.users.length > 0) {
      this.loadCommonGames();
    } else {
      this.games = [];
      this.selectedGame = '';
      this.achievements = [];
    }
    this.updateUrlParams();
  }

  loadCommonGames(): void {
    // In a real app, call your API to get common games
    // For demo, we'll add placeholder games
    setTimeout(() => {
      this.games = [
        {id: 'game1', name: 'Half-Life 2'},
        {id: 'game2', name: 'Portal 2'},
        {id: 'game3', name: 'Left 4 Dead 2'}
      ];
    }, 300);
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
    // In a real app, call your API to get achievements
    // For demo, we'll add placeholder achievements
    setTimeout(() => {
      this.achievements = [
        {
          id: 'ach1',
          name: 'First Steps',
          description: 'Complete the tutorial',
          icon: 'https://via.placeholder.com/32',
          users: {
            'user1': {achieved: true, unlockTime: '2023-01-15T12:30:00Z'},
            'user2': {achieved: true, unlockTime: '2023-01-20T18:45:00Z'}
          }
        },
        {
          id: 'ach2',
          name: 'Expert Mode',
          description: 'Complete the game on hard difficulty',
          icon: 'https://via.placeholder.com/32',
          users: {
            'user1': {achieved: true, unlockTime: '2023-02-10T20:15:00Z'},
            'user2': {achieved: false}
          }
        },
        {
          id: 'ach3',
          name: 'Collector',
          description: 'Find all hidden items',
          icon: 'https://via.placeholder.com/32',
          users: {
            'user1': {achieved: false},
            'user2': {achieved: false}
          }
        }
      ];
    }, 300);
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
