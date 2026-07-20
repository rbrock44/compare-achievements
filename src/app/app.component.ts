import {Component, ChangeDetectionStrategy} from '@angular/core';
import {ComparisonComponent} from './components/comparison/comparison.component';
import {RouterOutlet} from '@angular/router';
import {ThemeService} from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [
    ComparisonComponent,
    RouterOutlet
  ],
  templateUrl: './app.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'compare-achievements';

  // Injecting ThemeService here instantiates it as soon as the app loads,
  // applying the persisted (or default dark) theme before the UI renders.
  constructor(private themeService: ThemeService) {
  }
}
