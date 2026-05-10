# Deploy Nexus to Google Cloud Run

## 1. Setup
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

## 2. Deploy
```bash
gcloud run deploy nexus \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated
```

## 3. Required Environment Variables
Set these in Cloud Run or the deploy command will start the server without AI features:

```bash
gcloud run services update nexus \
  --region europe-west1 \
  --update-env-vars GEMINI_API_KEY=your_gemini_key,Venice=your_venice_key,NODE_ENV=production
```

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Yes (for Gemini AI) | Google GenAI deep search, graph expansion |
| `Venice` or `VENICE_API_KEY` | Yes (for Venice AI) | Venice AI sensemaking, clean, forensic |
| `NODE_ENV` | Yes | Must be `production` to serve built static files |

> **Note:** The server will still start and serve the frontend even without API keys.
> AI routes will return HTTP 503 with a clear error message until keys are configured.

## 4. Health Check
```bash
curl https://YOUR_CLOUD_RUN_URL/health
# Returns: {ok:true,service:nexus,runtime:cloud-run,ai:configured}
# or:      {ok:true,service:nexus,runtime:cloud-run,ai:no-keys-set}
```

## 5. Logs
```bash
gcloud logs tail --service nexus
```

## 6. Future upgrades
- Cloud SQL (persistent DB)
- Cloud Storage (file uploads)
- Custom domain
- Auth layer
