import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
    selector: 'app-logo',
    imports: [NgOptimizedImage],
    templateUrl: './logo.html',
    styleUrl: `./logo.css`,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Logo {

}