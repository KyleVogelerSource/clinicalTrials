import { Routes } from '@angular/router';
import { Home } from '../pages/home/home';
import { Dashboard } from '../pages/dashboard/dashboard';
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
        path: 'analysis',
        loadComponent: () => import('../pages/analysis/analysis').then(m => m.Analysis)
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
