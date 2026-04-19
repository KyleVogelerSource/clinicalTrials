import { Routes } from '@angular/router';
import { Home } from '../pages/home/home';
import { Dashboard } from '../pages/dashboard/dashboard';
import { Designer } from '../pages/designer/designer';
import { Selection } from '../pages/selection/selection';
import { authGuard } from './auth.guard';

export const routes: Routes = [
    {
        path: '',
        component: Dashboard
    },
    {
        path: 'home',
        component: Home
    },
    {
        path: 'designer',
        component: Designer
    },
    {
        path: 'selection',
        component: Selection
    },
    {
        path: 'results',
        loadComponent: () => import('../pages/results/results').then(m => m.Results)
    },
    {
        path: 'admin',
        loadComponent: () => import('../pages/admin/admin').then(m => m.Admin),
        canActivate: [authGuard]
    },
    {
        path: 'saved-searches',
        loadComponent: () => import('../pages/saved-searches/saved-searches').then(m => m.SavedSearches),
        canActivate: [authGuard]
    },
    {
        path: 'compare',
        loadComponent: () => import('../pages/trial-compare/trial-compare').then(m => m.TrialCompare)
    }
];
