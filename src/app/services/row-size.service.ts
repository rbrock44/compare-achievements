import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

const ROW_SIZE_STORAGE_KEY = 'achievementRowSize';
const ROW_SIZE_MIN = 0.75;
const ROW_SIZE_MAX = 2;
const ROW_SIZE_STEP = 0.25;
const ROW_SIZE_DEFAULT = 1;

@Injectable({
  providedIn: 'root'
})
export class RowSizeService {
  private readonly rowSizeSubject = new BehaviorSubject<number>(ROW_SIZE_DEFAULT);
  readonly rowSize$ = this.rowSizeSubject.asObservable();
  private readonly isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.rowSizeSubject.next(this.loadRowSize());
  }

  get rowSize(): number {
    return this.rowSizeSubject.value;
  }

  private loadRowSize(): number {
    if (this.isBrowser) {
      const stored = Number(window.localStorage.getItem(ROW_SIZE_STORAGE_KEY));
      if (!isNaN(stored) && stored >= ROW_SIZE_MIN && stored <= ROW_SIZE_MAX) {
        return stored;
      }
    }
    return ROW_SIZE_DEFAULT;
  }

  increaseRowSize(): void {
    this.setRowSize(this.rowSize + ROW_SIZE_STEP);
  }

  decreaseRowSize(): void {
    this.setRowSize(this.rowSize - ROW_SIZE_STEP);
  }

  setRowSize(size: number): void {
    const clamped = Math.min(ROW_SIZE_MAX, Math.max(ROW_SIZE_MIN, Math.round(size * 100) / 100));
    this.rowSizeSubject.next(clamped);

    if (this.isBrowser) {
      window.localStorage.setItem(ROW_SIZE_STORAGE_KEY, String(clamped));
    }
  }
}
