import {Component} from '@angular/core';
import {ComparisonComponent} from './components/comparison/comparison.component';
import {RouterOutlet} from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [
    ComparisonComponent,
    RouterOutlet
  ],
  templateUrl: './app.component.html',
  standalone: true,
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'compare-achievements';
}
