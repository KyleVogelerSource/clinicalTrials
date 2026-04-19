import { Component, ChangeDetectionStrategy, input, effect, viewChild, ElementRef, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
// @ts-expect-error — no type declarations for leaflet-image
import leafletImage from 'leaflet-image';
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
    latitude: number;
    longitude: number;
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
    focusPoint = input<[number, number] | null>(null);

    mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');
    
    exporting = signal(false);

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

        effect(() => {
            const point = this.focusPoint();
            if (point && this.map) {
                this.map.setView(point, 12, { animate: true });
            }
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
            p.latitude, 
            p.longitude, 
            p.intensity ?? 1
        ]);

        this.heatmapLayer = L.heatLayer(heatData, {
            radius: 25,
            blur: 15,
            maxZoom: 10,
        }).addTo(this.map);

        // Optionally fit bounds if there are points
        if (points.length > 0) {
            const bounds = L.latLngBounds(points.map(p => [p.latitude, p.longitude]));
            this.map.fitBounds(bounds, { padding: [20, 20] });
        }
    }

    exportPng(): void {
        if (!this.map || this.exporting()) return;
        this.exporting.set(true);
        leafletImage(this.map, (err: Error | null, canvas: HTMLCanvasElement) => {
            this.exporting.set(false);
            if (err || !canvas) return;
            const link = document.createElement('a');
            link.download = 'heatmap.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }

    ngOnDestroy(): void {
        if (this.map) {
            this.map.remove();
        }
    }
}
