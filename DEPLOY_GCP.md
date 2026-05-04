# Deploy Nexus to Google Cloud Run

## 1. Setup

gcloud auth login
gcloud config set project YOUR_PROJECT_ID

## 2. Deploy

gcloud run deploy nexus \
  --source . \
  --region europe-west2 \
  --allow-unauthenticated

## 3. Environment

Set env vars if needed:

gcloud run services update nexus \
  --update-env-vars NODE_ENV=production

## 4. Logs

gcloud logs tail

## 5. Future upgrades

- Cloud SQL (persistent DB)
- Cloud Storage (file uploads)
- Custom domain
- Auth layer
