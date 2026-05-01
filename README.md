# ClinicalTrials

ClinicalTrials is a full-stack application for designing, searching, filtering, selecting, and comparing clinical trial candidates. It combines an Angular frontend, an Express/TypeScript backend, shared DTOs, MeSH terminology data, and a PostgreSQL database.

The app supports a multi-step clinical trial workflow:

- Build trial search criteria in the Designer.
- Search ClinicalTrials.gov through the backend API.
- Review and filter candidate trials.
- Save, import, export, and share search criteria.
- Compare selected trials using weighted benchmarking dimensions.
- Manage users, roles, and permissions through the admin area.

## Deploy Locally With Docker Compose

The recommended local setup uses Docker Compose. Docker will create and run everything the app needs, so you do not need to install the frontend, backend, or database separately.

### What Docker Will Start

```text
Your browser
    |
    | http://localhost
    v
+------------------+
| Nginx gateway    |
| port 80          |
+--------+---------+
         |
         +------------------------------+
         |                              |
         | page requests                | API requests
         v                              v
+------------------+          +------------------+
| Angular frontend |          | Express backend  |
| container        |          | container        |
| port 4200        |          | port 3000        |
+------------------+          +--------+---------+
                                      |
                                      | database connection
                                      v
                             +------------------+
                             | PostgreSQL       |
                             | container        |
                             | port 5432        |
                             +------------------+
```

In plain English: open one website in your browser, and Docker runs the web app, API, and database behind the scenes.

### 1. Install Docker Desktop

Install Docker Desktop for your operating system:

- Mac: https://docs.docker.com/desktop/setup/install/mac-install/
- Windows: https://docs.docker.com/desktop/setup/install/windows-install/
- Linux: https://docs.docker.com/desktop/setup/install/linux/

After installing it, open Docker Desktop and leave it running. On Windows, use the WSL 2 option if Docker asks which backend to use.

### 2. Open a Terminal

Use the terminal for your operating system:

- Mac: open `Terminal`.
- Windows: open `PowerShell`.
- Linux: open your usual terminal app.

### 3. Download the Project

Run these commands:

Mac or Linux:

```bash
git clone https://github.com/KyleVogelerSource/clinicalTrials.git
cd clinicalTrials
```

Windows PowerShell:

```powershell
git clone https://github.com/KyleVogelerSource/clinicalTrials.git
cd clinicalTrials
```

If `git clone` is not available, download the repository as a ZIP file from GitHub, unzip it, and open a terminal inside the unzipped `clinicalTrials` folder.

### 4. Start the App

Run this command from the main `clinicalTrials` folder, the same folder that contains `docker-compose.yml`.

Mac or Linux:

```bash
docker compose up --build
```

Windows PowerShell:

```powershell
docker compose up --build
```

The first run can take several minutes because Docker has to download images and install app dependencies. Leave this terminal window open while using the app.

If your computer says `docker compose` is not recognized, try the older Docker Compose command:

```bash
docker-compose up --build
```

### 5. Open the App in Your Browser

When the terminal output slows down and the containers are running, open your browser and go to:

```text
http://localhost
```

That is the local version of the ClinicalTrials app.

Optional backend checks:

```text
http://localhost/api/health
http://localhost/api/debug/status
```

Optional load tests are available under `load-tests/`. Start with the safe local smoke test after Docker Compose is running:

```bash
k6 run load-tests/smoke-local.js
```

Or run the same smoke test through Docker Compose without installing k6 locally:

```bash
docker compose --profile load-test run --rm k6
```

### 6. Stop the App

Go back to the terminal where Docker is running and press:

```text
Ctrl + C
```

Then run:

Mac or Linux:

```bash
docker compose down
```

Windows PowerShell:

```powershell
docker compose down
```

### 7. Reset the Local Database

Only do this if you want to erase the local PostgreSQL data and start fresh:

Mac or Linux:

```bash
docker compose down --volumes
```

Windows PowerShell:

```powershell
docker compose down --volumes
```

## Deploy to AWS With Terraform

Terraform is the tool used by this repository to create the cloud infrastructure. In plain English, Terraform reads the files in the `terraform/` folder and creates the AWS services needed to run the app online.

This deployment is more advanced than the local Docker setup. You do not need to be a cloud expert, but you do need:

- An AWS account.
- Permission to create AWS resources.
- Terraform installed.
- AWS CLI installed and logged in.
- Docker installed and running.
- Access to this GitHub repository's settings if you want automatic GitHub Actions deployment.

Important: this can create paid AWS resources. The database, NAT gateway, App Runner service, CloudFront, S3, and other AWS resources may cost money while they exist. Destroy the Terraform environment when you are finished testing.

### What Terraform Will Create

```text
GitHub Actions
    |
    | uploads frontend files
    | pushes backend Docker image
    v
+--------------------+        +--------------------+
| S3 bucket          |        | ECR repository     |
| frontend files     |        | backend image      |
+---------+----------+        +---------+----------+
          |                             |
          | served by                   | pulled by
          v                             v
+--------------------+        +--------------------+
| CloudFront         |        | App Runner         |
| public website URL |        | backend API URL    |
+--------------------+        +---------+----------+
                                        |
                                        | private database connection
                                        v
                              +--------------------+
                              | RDS PostgreSQL     |
                              | private database   |
                              +--------------------+

Network pieces created around this:

+--------------------------------------------------+
| AWS VPC                                          |
| public subnets, private subnets, NAT gateway,    |
| security groups, and App Runner VPC connector    |
+--------------------------------------------------+
```

In plain English: Terraform creates the online home for the frontend, backend, database, networking, container image storage, and GitHub deployment permissions.

### 1. Install the Required Tools

Install Terraform:

- Official Terraform install guide: https://developer.hashicorp.com/terraform/install

Install the AWS CLI:

- Official AWS CLI setup guide: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-quickstart.html

Install Docker Desktop if it is not already installed:

- Mac: https://docs.docker.com/desktop/setup/install/mac-install/
- Windows: https://docs.docker.com/desktop/setup/install/windows-install/
- Linux: https://docs.docker.com/desktop/setup/install/linux/

Check that the tools are installed:

Mac or Linux:

```bash
terraform -version
aws --version
docker --version
```

Windows PowerShell:

```powershell
terraform -version
aws --version
docker --version
```

### 2. Log In to AWS From Your Computer

Terraform needs permission to create resources in your AWS account.

Run:

Mac or Linux:

```bash
aws configure
```

Windows PowerShell:

```powershell
aws configure
```

AWS will ask for:

- AWS Access Key ID
- AWS Secret Access Key
- Default region name
- Default output format

For this project, use:

```text
Default region name: us-east-1
Default output format: json
```

Confirm AWS is connected:

Mac or Linux:

```bash
aws sts get-caller-identity
```

Windows PowerShell:

```powershell
aws sts get-caller-identity
```

If this prints your AWS account information, your computer can talk to AWS.

AWS CLI credential help: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html

### 3. Go to the Terraform Folder

From the main project folder, go to the dev Terraform environment:

Mac or Linux:

```bash
cd terraform/environments/dev
```

Windows PowerShell:

```powershell
cd terraform\environments\dev
```

### 4. Create the Terraform Variables File

Terraform needs a small settings file for this environment.

Mac or Linux:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Windows PowerShell:

```powershell
Copy-Item terraform.tfvars.example terraform.tfvars
```

Open `terraform.tfvars` in a text editor and update these values:

```hcl
aws_region    = "us-east-1"
github_owner  = "YOUR_GITHUB_USERNAME_OR_ORG"
github_repo   = "clinicalTrials"

db_username   = "app_user"
db_password   = "REPLACE_WITH_A_LONG_RANDOM_PASSWORD"
db_ssl        = true
db_ssl_reject_unauthorized = false
```

Do not commit `terraform.tfvars` to GitHub. It contains the database password.

Also keep Terraform state private. Files such as `terraform.tfstate` can contain infrastructure details and secret values.

### 5. Initialize Terraform

This downloads the Terraform AWS provider.

Mac or Linux:

```bash
terraform init
```

Windows PowerShell:

```powershell
terraform init
```

### 6. Create the ECR Image Repository First

The backend runs as a Docker image. AWS App Runner needs that image to exist before the full Terraform deployment can succeed.

Create only the ECR repository first:

Mac or Linux:

```bash
terraform apply -target=module.ecr
```

Windows PowerShell:

```powershell
terraform apply -target=module.ecr
```

Terraform will show a plan. Type:

```text
yes
```

### 7. Push the First Backend Image to ECR

Go back to the main project folder.

Mac or Linux:

```bash
cd ../../..
```

Windows PowerShell:

```powershell
cd ..\..\..
```

Get your AWS account ID:

Mac or Linux:

```bash
aws sts get-caller-identity --query Account --output text
```

Windows PowerShell:

```powershell
aws sts get-caller-identity --query Account --output text
```

Use that account ID to build your ECR URL:

```text
YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/clinicaltrials-dev-backend
```

Example only:

```text
123456789012.dkr.ecr.us-east-1.amazonaws.com/clinicaltrials-dev-backend
```

Log Docker in to ECR.

Mac or Linux:

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

Windows PowerShell:

```powershell
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

Build, tag, and push the backend image.

Mac or Linux:

```bash
docker build -t clinicaltrials-dev-backend ./backend
docker tag clinicaltrials-dev-backend:latest YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/clinicaltrials-dev-backend:latest
docker push YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/clinicaltrials-dev-backend:latest
```

Windows PowerShell:

```powershell
docker build -t clinicaltrials-dev-backend ./backend
docker tag clinicaltrials-dev-backend:latest YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/clinicaltrials-dev-backend:latest
docker push YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/clinicaltrials-dev-backend:latest
```

Replace `YOUR_AWS_ACCOUNT_ID` with the account number printed by AWS.

### 8. Create the Rest of the AWS Infrastructure

Go back to the Terraform folder:

Mac or Linux:

```bash
cd terraform/environments/dev
```

Windows PowerShell:

```powershell
cd terraform\environments\dev
```

Preview what Terraform will create:

Mac or Linux:

```bash
terraform plan
```

Windows PowerShell:

```powershell
terraform plan
```

Apply the deployment:

Mac or Linux:

```bash
terraform apply
```

Windows PowerShell:

```powershell
terraform apply
```

Terraform will show a plan. Type:

```text
yes
```

This step can take several minutes.

### 9. Save the Terraform Outputs

After Terraform finishes, print the output values:

Mac or Linux:

```bash
terraform output
```

Windows PowerShell:

```powershell
terraform output
```

Save these values somewhere private:

- `backend_service_url`
- `backend_service_arn`
- `frontend_bucket_name`
- `cloudfront_distribution_id`
- `cloudfront_domain_name`
- `ecr_repository_url`
- `github_actions_role_arn`
- `db_address`

The public frontend URL will be:

```text
https://CLOUDFRONT_DOMAIN_NAME
```

The backend API URL will be:

```text
BACKEND_SERVICE_URL
```

### 10. Add GitHub Secrets for Automatic Deployment

Terraform creates the AWS infrastructure. GitHub Actions deploys the newest frontend and backend code into that infrastructure.

In GitHub:

1. Open the repository.
2. Click `Settings`.
3. Click `Secrets and variables`.
4. Click `Actions`.
5. Add these repository secrets:

```text
AWS_ROLE_ARN = value from github_actions_role_arn
AWS_REGION = us-east-1
ECR_REPOSITORY = clinicaltrials-dev-backend
APP_RUNNER_SERVICE_ARN = value from backend_service_arn
S3_BUCKET_NAME = value from frontend_bucket_name
CLOUDFRONT_DISTRIBUTION_ID = value from cloudfront_distribution_id
ANTHROPIC_API_KEY = Anthropic API key used by backend AI results and benchmark explanations
VOYAGE_API_KEY = Voyage AI API key used by backend trial similarity embeddings
```

The backend deployment workflow validates `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` before deploying to App Runner. If either secret is missing or rejected by the provider API, the backend deployment fails.

GitHub secrets help: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets

### 11. Deploy the Application Code

As written, the deployment workflows run from GitHub Actions:

- Backend deployment: `.github/workflows/deploy-backend.yml`
- Frontend deployment: `.github/workflows/deploy-frontend.yml`

The backend workflow can be run manually from the GitHub Actions page. The frontend workflow currently runs when changes are pushed to the `main` branch.

After the frontend workflow finishes, open the CloudFront URL in your browser:

```text
https://CLOUDFRONT_DOMAIN_NAME
```

That is the deployed AWS version of the ClinicalTrials app.

### 12. Check That the Backend Is Healthy

Open this URL in your browser:

```text
BACKEND_SERVICE_URL/api/health
```

For a deeper check, open:

```text
BACKEND_SERVICE_URL/api/debug/status
```

The debug status should show that the backend is running, the database is connected, and both AI providers are configured and reachable. The endpoint reports only boolean provider status and redacted error metadata; it does not expose API key values.

### 13. Destroy the AWS Deployment When Finished

If this is only for a class demo or test, destroy the AWS resources when finished so they stop costing money.

From `terraform/environments/dev`, run:

Mac or Linux:

```bash
terraform destroy
```

Windows PowerShell:

```powershell
terraform destroy
```

Terraform will show what it will delete. Type:

```text
yes
```

Do not run `terraform destroy` if this AWS environment is being used by other people.

## Project Layout

```text
clinicalTrials/
├── backend/          # Express.js backend API
├── frontend/         # Angular SPA
├── shared/           # Shared DTOs and static terminology data
├── docker/           # Nginx reverse proxy config
├── terraform/        # AWS infrastructure
└── docker-compose.yml
```

## Medical Subject Headings (MeSH)

Collection of biomedical terms used by ClinicalTrials.gov and other systems.

The data provided can be extracted to feed the app's terminology references.

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
