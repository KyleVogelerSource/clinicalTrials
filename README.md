# ClinicalTrials API

A simple TypeScript + Express API for local development of the Clinical Trials backend.

This project currently exposes a small set of local endpoints and includes a starter service that returns an empty `ClinicalTrialStudiesResponse` object.

## Prerequisites

Before running this project, make sure the following are installed:

- [Node.js](https://nodejs.org/) (LTS recommended)
- npm (included with Node.js)

You can verify installation with:

```bash
node -v
npm -v
```


# Medical Subjecct Headings (MeSH)

Collection of biomedical terms which is used by ClinicalTrials.gov and other systems.

The data provided can be extract in order to feed our termonology refernces.

## Source
desc2026.xml - https://www.nlm.nih.gov/databases/download/mesh.html

## Terminology Key

**A: Anatomy**  
Body parts, organs, and cells.  
*Heart, Liver, Central Nervous System, Stem Cells*

**B: Organisms**    
Living beings, including the bacteria and viruses that cause   diseases.    
*SARS-CoV-2, Escherichia coli, Mammals*  
  
**C: Diseases**  
The primary source for clinical trials covering all physical   illnesses and pathologies.       
*Neoplasms (Cancer), Diabetes Mellitus, Myocardial Infarction*  
  
**D: Chemicals and Drugs**  
Includes all medications, substances, and biological markers.  
*Insulin, Metformin, Aspirin, Vaccines*  
  
**E: Analytical, Diagnostic, and Therapeutic Techniques, and   Equipment**  
Covers medical procedures, surgical techniques, and diagnostic   tools.  
*Biopsy, Magnetic Resonance Imaging (MRI), Radiotherapy*  
  
**F: Psychiatry and Psychology**  
Mental health conditions, behavioral disorders, and cognitive   processes.  
*Depressive Disorder, Schizophrenia, Anxiety Disorders*  
  
**G: Phenomena and Processes**  
Biological, chemical, and physical processes that occur in   living organisms.  
*Metabolism, Aging, Immune Response*  
  
**H: Disciplines and Occupations**  
Professional fields and branches of knowledge in medicine.  
*Cardiology, Nursing, Epidemiology*  
  
**I: Anthropology, Education, Sociology, and Social Phenomena**  
Social and environmental factors that affect health and clinical   research.  
*Social Media, Poverty, Patient Education*  
  
**J: Technology, Industry, and Agriculture**  
Industrial and food-related categories generally less relevant   for clinical trials.  
*Food Technology, Environmental Pollution*  
  
**K: Humanities**  
The study of human culture, history, and philosophy.  
*Bioethics, History of Medicine, Religion*  
  
**L: Information Science**  
Communication, libraries, and informatics.  
*Medical Informatics, Electronic Health Records*  
  
**M: Named Groups**  
Categorizes populations by age, occupation, or status.  
*Infant, Pregnant Women, Aged (65+)*  
  
**N: Health Care**  
The systems, facilities, and economics of providing medical care.  
*Hospitals, Health Insurance, Quality of Health Care*  
  
**V: Publication Characteristics**  
Metadata about types of research papers or study designs.  
*Clinical Trial, Randomized Controlled Trial, Case Reports*  
  
**Z: Geographic Locations**  
Physical locations which can be useful for filtering trials by region.  
*United States, European Union, Developing Countries*

## Format

Here is an informal snippet of the XML nodes that we likely care about.

```
DescriptorRecordSet LanguageCode = "eng"
    DescriptorRecord
        DescriptorUI                    <-- The ID -->
        DescriptorName
            String                      <-- The Term -->
        AllowedQualifiersList
            AllowableQualifier
                QualifierReferredTo
                    QualifierName
                        String
        TreeNumberList
            TreeNumber                  <-- Prefix links to above Key -->
        ConceptList
            Concept
                ConceptName
                    String
                TermList
                    Term
                        String          <-- Synonyms -->
```

## Trial Comparison (How It Works)

The trial comparison feature ranks selected trials based on similarity across multiple dimensions.

### Endpoint

- `POST /api/clinical-trials/compare`

### Access Requirements

- User must be authenticated (JWT token).
- User must have the `trial_benchmarking` action.

### Input Rules

- You must send between `2` and `5` trials.
- Each trial must include a valid `nctId` string.
- Optional `weights` object can override default scoring weights.
- Weight values must be non-negative numbers.

### Default Weights

- `conditionOverlap`: `25`
- `phaseMatch`: `20`
- `studyType`: `10`
- `eligibilityCompatibility`: `20`
- `interventionOverlap`: `10`
- `enrollmentSimilarity`: `10`
- `statusRecency`: `5`

The final pairwise score is the weighted sum of these dimensions and is normalized to a `0-100` scale.

### What The Response Contains

- `normalizedTrials`: normalized metadata for each trial.
- `comparisonMatrix`: pairwise scores for each trial against all selected trials.
- `benchmarkScores`: average pairwise score per trial, sorted by best score and assigned rank.

### Example Request

```json
{
    "trials": [
        { "nctId": "NCT01234567" },
        { "nctId": "NCT07654321" },
        { "nctId": "NCT01112223" }
    ]
}
```

### Example Request With Custom Weights

```json
{
    "trials": [
        { "nctId": "NCT01234567" },
        { "nctId": "NCT07654321" }
    ],
    "weights": {
        "conditionOverlap": 35,
        "phaseMatch": 25,
        "studyType": 10,
        "eligibilityCompatibility": 15,
        "interventionOverlap": 5,
        "enrollmentSimilarity": 5,
        "statusRecency": 5
    }
}
```

### Example Response (Shape)

```json
{
    "normalizedTrials": [
        {
            "nctId": "NCT01234567",
            "briefTitle": "Trial A",
            "phase": "PHASE2",
            "studyType": "INTERVENTIONAL",
            "overallStatus": "RECRUITING",
            "enrollmentCount": 120,
            "conditions": ["diabetes mellitus"],
            "interventions": ["metformin"],
            "sex": "ALL",
            "minimumAge": "18 Years",
            "maximumAge": "65 Years",
            "sponsor": "Example Sponsor",
            "startDate": "2024-01",
            "completionDate": "2026-06"
        }
    ],
    "comparisonMatrix": [
        {
            "nctId": "NCT01234567",
            "scores": [
                {
                    "againstNctId": "NCT07654321",
                    "score": 72.5,
                    "weightedBreakdown": {
                        "conditionOverlap": 20,
                        "phaseMatch": 20,
                        "studyType": 10,
                        "eligibilityCompatibility": 15,
                        "interventionOverlap": 5,
                        "enrollmentSimilarity": 1.5,
                        "statusRecency": 1
                    },
                    "explanations": [
                        "Condition overlap is 80%.",
                        "Both trials are in PHASE2."
                    ]
                }
            ]
        }
    ],
    "benchmarkScores": [
        { "nctId": "NCT01234567", "score": 74.1, "rank": 1 },
        { "nctId": "NCT07654321", "score": 71.8, "rank": 2 }
    ]
}
```

### Common Error Cases

- `400 Bad Request`: fewer than 2 or more than 5 trials, missing `nctId`, or invalid weights.
- `403 Forbidden`: user lacks `trial_benchmarking` permission.
- `404 Not Found`: one of the NCT IDs could not be resolved.
