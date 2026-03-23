import { Routes } from '@angular/router';
import { Home } from '../pages/home/home';
import { Designer } from '../pages/designer/designer';
import { Selection } from '../pages/selection/selection';

export const routes: Routes = [
    {
        path: '',
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
        loadComponent: () => import('../pages/admin/admin').then(m => m.Admin)
    }
];
