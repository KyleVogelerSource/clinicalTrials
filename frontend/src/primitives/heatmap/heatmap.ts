import { Component, ChangeDetectionStrategy, input, effect, viewChild, ElementRef, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as L from 'leaflet';
import 'leaflet.heat';

// Extend Leaflet's namespace to include the heatLayer method
declare module 'leaflet' {
    function heatLayer(
        latlngs: (L.LatLngExpression | [number, number, number])[],
        options?: any
    ): L.Layer;
}

export interface HeatPoint {
    lat: number;
    lng: number;
    intensity?: number;
}

@Component({
    selector: 'app-heatmap',
    standalone: true,
    templateUrl: './heatmap.html',
    styleUrl: './heatmap.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Heatmap implements OnDestroy {
    points = input.required<HeatPoint[]>();
    zoom = input<number>(2);
    center = input<[number, number]>([20, 0]); // Default to a global view

    mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');
    
    private map: L.Map | null = null;
    private heatmapLayer: L.Layer | null = null;
    private platformId = inject(PLATFORM_ID);

    constructor() {
        effect(() => {
            // Leaflet needs the DOM, so ensure we are in the browser
            if (!isPlatformBrowser(this.platformId)) return;

            const container = this.mapContainer();
            if (!container) return;

            if (!this.map) {
                this.initMap(container.nativeElement);
            }

            this.updateHeatmap(this.points());
        });
    }

    private initMap(element: HTMLElement): void {
        this.map = L.map(element, {
            center: this.center(),
            zoom: this.zoom(),
            scrollWheelZoom: false, // Better for UX in a dashboard
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
        }).addTo(this.map);
    }

    private updateHeatmap(points: HeatPoint[]): void {
        if (!this.map) return;

        if (this.heatmapLayer) {
            this.map.removeLayer(this.heatmapLayer);
        }

        const heatData: [number, number, number][] = points.map(p => [
            p.lat, 
            p.lng, 
            p.intensity ?? 1
        ]);

        this.heatmapLayer = L.heatLayer(heatData, {
            radius: 25,
            blur: 15,
            maxZoom: 10,
        }).addTo(this.map);

        // Optionally fit bounds if there are points
        if (points.length > 0) {
            const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
            this.map.fitBounds(bounds, { padding: [20, 20] });
        }
    }

    ngOnDestroy(): void {
        if (this.map) {
            this.map.remove();
        }
    }
}
