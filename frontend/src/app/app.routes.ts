import { Routes } from '@angular/router';
import { ClinicalTrialsSearchComponent } from './pages/clinical-trials-search.component';

export const routes: Routes = [
  {
    path: '',
    component: ClinicalTrialsSearchComponent,
    data: { title: 'Clinical Trials Search' }
  },
  {
    path: 'search',
    component: ClinicalTrialsSearchComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];
