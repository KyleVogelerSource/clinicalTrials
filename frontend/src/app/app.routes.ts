import { Routes } from '@angular/router';
import { Home } from '../pages/home/home';
import { Designer } from '../pages/designer/designer';

export const routes: Routes = [
    {
        path: '',
        component: Home
    },
    {
        path: 'designer',
        component: Designer
    }
];
