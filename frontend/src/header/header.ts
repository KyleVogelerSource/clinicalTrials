import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
    selector: 'app-head',
    imports: [NgOptimizedImage],
    templateUrl: './header.html',
    styleUrl: `./header.css`,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Header {

}