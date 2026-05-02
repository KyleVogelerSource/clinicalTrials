import { Component, ChangeDetectionStrategy, input, effect, viewChild, ElementRef, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
// @ts-expect-error — no type declarations for leaflet-image
import leafletImage from 'leaflet-image';
import * as L from 'leaflet';

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
    label?: string;
    subLabel?: string;
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
    condition = input<string>('Trials');
    zoom = input<number>(2);
    center = input<[number, number]>([20, 0]); // Default to a global view
    focusPoint = input<[number, number] | null>(null);

    mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');
    
    exporting = signal(false);

    private map: L.Map | null = null;
    private heatmapLayer: L.Layer | null = null;
    private markerLayer: L.LayerGroup | null = null;
    private platformId = inject(PLATFORM_ID);

    constructor() {
        effect(async () => {
            // Leaflet needs the DOM, so ensure we are in the browser
            if (!isPlatformBrowser(this.platformId)) return;

            const container = this.mapContainer();
            if (!container) return;

            if (!this.map) {
                // Ensure L is global for Leaflet plugins
                (window as any).L = L;
                // Dynamically import leaflet.heat to ensure L is global before it runs
                // @ts-expect-error - no type declarations for leaflet.heat
                await import('leaflet.heat');
                this.initMap(container.nativeElement);
            }

            this.updateMapLayers(this.points());
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
            scrollWheelZoom: false,
            preferCanvas: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
        }).addTo(this.map);

        // Listen for zoom changes to toggle between heatmap and markers
        this.map.on('zoomend', () => {
            this.syncLayerVisibility();
        });
    }

    private updateMapLayers(points: HeatPoint[]): void {
        if (!this.map) return;

        // Clear existing
        if (this.heatmapLayer) this.map.removeLayer(this.heatmapLayer);
        if (this.markerLayer) this.map.removeLayer(this.markerLayer);

        // 1. Setup Heatmap Layer
        const heatData: [number, number, number][] = points.map(p => [
            p.latitude, 
            p.longitude, 
            p.intensity ?? 1
        ]);

        this.heatmapLayer = L.heatLayer(heatData, {
            radius: 20,
            blur: 15,
            maxZoom: 10,
        });

        // 2. Setup Marker Layer (Circle Pins)
        this.markerLayer = L.layerGroup();
        points.forEach(p => {
            const marker = L.circleMarker([p.latitude, p.longitude], {
                radius: 6,
                fillColor: '#DC344D', // Use our "Proposed/User" red for definition
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });
            
            if (p.label) {
                const tooltipContent = p.subLabel 
                    ? `<strong>${p.label}</strong><br/>${p.subLabel}`
                    : `<strong>${p.label}</strong>`;
                marker.bindTooltip(tooltipContent, {
                    direction: 'top',
                    offset: [0, -5],
                    className: 'site-tooltip'
                });
            }
            
            marker.addTo(this.markerLayer!);
        });

        // Add them to map
        this.heatmapLayer.addTo(this.map);
        this.markerLayer.addTo(this.map);

        this.syncLayerVisibility();

        // Optionally fit bounds if there are points
        if (points.length > 0) {
            const bounds = L.latLngBounds(points.map(p => [p.latitude, p.longitude]));
            this.map.fitBounds(bounds, { padding: [20, 20] });
        }
    }

    private syncLayerVisibility(): void {
        if (!this.map || !this.heatmapLayer || !this.markerLayer) return;

        const zoom = this.map.getZoom();
        
        // At low zoom (global), emphasize heatmap. At high zoom (local), emphasize markers.
        if (zoom < 5) {
            // Global view: Show heatmap, Hide markers
            if (!this.map.hasLayer(this.heatmapLayer)) this.heatmapLayer.addTo(this.map);
            if (this.map.hasLayer(this.markerLayer)) this.map.removeLayer(this.markerLayer);
        } else {
            // Zoomed in: Show markers, Hide heatmap (or keep it faint)
            if (this.map.hasLayer(this.heatmapLayer)) this.map.removeLayer(this.heatmapLayer);
            if (!this.map.hasLayer(this.markerLayer)) this.markerLayer.addTo(this.map);
        }
    }

    private updateHeatmap(points: HeatPoint[]): void {
        // Deprecated by updateMapLayers, but keeping for compatibility if called elsewhere
        this.updateMapLayers(points);
    }

    exportPng(): void {
        if (!this.map || this.exporting()) return;
        this.exporting.set(true);
        leafletImage(this.map, (err: Error | null, canvas: HTMLCanvasElement) => {
            this.exporting.set(false);
            if (err || !canvas) return;

            const date = new Date().toISOString().split('T')[0];
            const cond = this.condition();
            const filename = `${cond} Heatmap ${date}.png`;

            const link = document.createElement('a');
            link.download = filename;
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
