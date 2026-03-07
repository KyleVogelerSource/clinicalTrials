import { Routes } from '@angular/router';
import { Home } from '../home/home';
import { Designer } from '../designer/designer';

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
