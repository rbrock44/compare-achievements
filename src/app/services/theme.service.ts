import { Injectable, Inject, PLATFORM_ID, DOCUMENT } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly themeSubject = new BehaviorSubject<Theme>('dark');
  readonly theme$ = this.themeSubject.asObservable();
  private readonly isBrowser: boolean;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.initTheme();
  }

  get theme(): Theme {
    return this.themeSubject.value;
  }

  private initTheme(): void {
    let theme: Theme = 'dark';

    if (this.isBrowser) {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (stored === 'light' || stored === 'dark') {
        theme = stored;
      }
    }

    this.applyTheme(theme);
  }

  toggleTheme(): void {
    this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    this.applyTheme(theme);

    if (this.isBrowser) {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }

  private applyTheme(theme: Theme): void {
    this.themeSubject.next(theme);

    const root = this.document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }
}
