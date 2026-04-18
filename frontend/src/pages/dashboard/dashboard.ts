import { Component, inject, OnInit } from "@angular/core";
import { ClinicalStudyService } from "../../services/clinical-study.service";
import { TrialWorkflowService } from "../../services/trial-workflow-service";
import { AuthService } from "../../services/auth.service";
import { SavedSearchService } from "../../services/saved-search.service";
import { Router } from "@angular/router";
import { LoadingIndicator } from "../../primitives/loading-indicator/loading-indicator";

@Component({
    selector: "app-dashboard",
    templateUrl: "./dashboard.html",
    styleUrl: "./dashboard.css",
    imports: [LoadingIndicator]
})
export class Dashbaord implements OnInit {
    clinicalStudiesService = inject(ClinicalStudyService);
    workflowService = inject(TrialWorkflowService);
    authService = inject(AuthService);
    savedSearchService = inject(SavedSearchService);
    router = inject(Router);

    ngOnInit(): void {
        
    }
}