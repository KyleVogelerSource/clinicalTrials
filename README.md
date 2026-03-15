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
