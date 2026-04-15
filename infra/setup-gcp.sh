#!/bin/bash
# TenderFish — Google Cloud setup (App Engine, no Docker)
# Run once per environment to provision resources.
#
# Usage: ./infra/setup-gcp.sh <environment>
# Example: ./infra/setup-gcp.sh prod
#          ./infra/setup-gcp.sh staging

set -euo pipefail

ENV=${1:-staging}
REGION="europe-west3"

if [ "$ENV" = "prod" ]; then
  PROJECT_ID="tenderfish-prod"
  SQL_INSTANCE="tenderfish-prod"
  GCS_BUCKET="tenderfish-prod-files"
  SQL_TIER="db-custom-2-7680"
elif [ "$ENV" = "staging" ]; then
  PROJECT_ID="tenderfish-staging"
  SQL_INSTANCE="tenderfish-staging"
  GCS_BUCKET="tenderfish-staging-files"
  SQL_TIER="db-f1-micro"
else
  echo "Unknown environment: $ENV (use 'prod' or 'staging')"
  exit 1
fi

echo "=== Setting up TenderFish $ENV (App Engine, no Docker) ==="
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo ""

# ─── Enable APIs ──────────────────────────────────────────────

echo "→ Enabling required APIs..."
gcloud services enable \
  appengine.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudtasks.googleapis.com \
  --project="$PROJECT_ID"

# ─── App Engine ───────────────────────────────────────────────

echo "→ Creating App Engine application..."
gcloud app create \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  2>/dev/null || echo "  (already exists)"

# ─── Cloud SQL ────────────────────────────────────────────────

echo "→ Creating Cloud SQL instance..."
gcloud sql instances create "$SQL_INSTANCE" \
  --database-version=POSTGRES_15 \
  --tier="$SQL_TIER" \
  --region="$REGION" \
  --storage-auto-increase \
  --backup-start-time=02:00 \
  --enable-point-in-time-recovery \
  --project="$PROJECT_ID" \
  2>/dev/null || echo "  (already exists)"

echo "→ Creating database..."
gcloud sql databases create tenderfish \
  --instance="$SQL_INSTANCE" \
  --project="$PROJECT_ID" \
  2>/dev/null || echo "  (already exists)"

echo "→ Setting database user password..."
DB_PASSWORD=$(openssl rand -base64 32)
gcloud sql users set-password tenderfish \
  --instance="$SQL_INSTANCE" \
  --password="$DB_PASSWORD" \
  --project="$PROJECT_ID"

# ─── Cloud Storage ────────────────────────────────────────────

echo "→ Creating GCS bucket..."
gcloud storage buckets create "gs://$GCS_BUCKET" \
  --location="$REGION" \
  --uniform-bucket-level-access \
  --project="$PROJECT_ID" \
  2>/dev/null || echo "  (already exists)"

# ─── Secret Manager ──────────────────────────────────────────

echo "→ Creating secrets..."
SECRETS=(
  "DATABASE_URL"
  "ANTHROPIC_API_KEY"
  "CLERK_SECRET_KEY"
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
  "NEXT_PUBLIC_API_URL"
  "POSTMARK_API_KEY"
  "GCS_BUCKET_NAME"
)

for secret in "${SECRETS[@]}"; do
  gcloud secrets create "$secret" \
    --replication-policy="automatic" \
    --project="$PROJECT_ID" \
    2>/dev/null || echo "  $secret (already exists)"
done

# Store auto-generated values
CONNECTION_NAME=$(gcloud sql instances describe "$SQL_INSTANCE" \
  --project="$PROJECT_ID" \
  --format="value(connectionName)")
DATABASE_URL="postgresql://tenderfish:${DB_PASSWORD}@localhost/tenderfish?host=/cloudsql/${CONNECTION_NAME}"

echo "$DATABASE_URL" | gcloud secrets versions add DATABASE_URL \
  --data-file=- --project="$PROJECT_ID"

echo "$GCS_BUCKET" | gcloud secrets versions add GCS_BUCKET_NAME \
  --data-file=- --project="$PROJECT_ID"

# ─── Cloud Tasks Queue ───────────────────────────────────────

echo "→ Creating Cloud Tasks queue for AI pipeline..."
gcloud tasks queues create ai-pipeline \
  --location="$REGION" \
  --max-dispatches-per-second=5 \
  --max-concurrent-dispatches=3 \
  --max-attempts=3 \
  --project="$PROJECT_ID" \
  2>/dev/null || echo "  (already exists)"

# ─── Deploy Worker as Cloud Function ─────────────────────────

echo "→ Deploying AI worker as Cloud Function..."
gcloud functions deploy ai-worker \
  --gen2 \
  --runtime=nodejs20 \
  --region="$REGION" \
  --source=. \
  --entry-point=aiWorker \
  --trigger-http \
  --no-allow-unauthenticated \
  --memory=1Gi \
  --timeout=90s \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest" \
  --project="$PROJECT_ID" \
  2>/dev/null || echo "  (deploy separately after first code push)"

# ─── IAM ─────────────────────────────────────────────────────

echo "→ Granting permissions..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")

# Cloud Build → App Engine deploy
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/appengine.deployer" \
  --quiet

# Cloud Build → Secret Manager
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

# App Engine → Cloud SQL
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/cloudsql.client" \
  --quiet

echo ""
echo "=== Setup complete for $ENV ==="
echo ""
echo "Next steps:"
echo "  1. Add remaining secrets:"
echo "     echo 'your-key' | gcloud secrets versions add ANTHROPIC_API_KEY --data-file=- --project=$PROJECT_ID"
echo "     echo 'your-key' | gcloud secrets versions add CLERK_SECRET_KEY --data-file=- --project=$PROJECT_ID"
echo "     echo 'your-key' | gcloud secrets versions add POSTMARK_API_KEY --data-file=- --project=$PROJECT_ID"
echo "  2. Deploy: gcloud app deploy apps/api/app.yaml apps/web/app.yaml cron.yaml --project=$PROJECT_ID"
echo "  3. Map custom domain: gcloud app domain-mappings create app.tenderfish.ai --project=$PROJECT_ID"
echo ""
