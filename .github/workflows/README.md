# Deploy pipeline setup

One-time GCP and GitHub configuration required before the pipeline will run.

---

## 1. Enable App Engine

In each GCP project (staging + prod):

```bash
gcloud app create --region=northamerica-northeast1 --project=YOUR_PROJECT
gcloud services enable appengine.googleapis.com --project=YOUR_PROJECT
```

---

## 2. Create service accounts

One service account per environment:

```bash
# Staging
gcloud iam service-accounts create github-deploy-staging \
  --display-name="GitHub Actions deploy (staging)" \
  --project=YOUR_STAGING_PROJECT

# Production
gcloud iam service-accounts create github-deploy-prod \
  --display-name="GitHub Actions deploy (production)" \
  --project=YOUR_PROD_PROJECT
```

Grant the App Engine deployer roles:

```bash
for ROLE in \
  roles/appengine.deployer \
  roles/appengine.serviceAdmin \
  roles/cloudbuild.builds.editor \
  roles/storage.objectAdmin; do

  gcloud projects add-iam-policy-binding YOUR_STAGING_PROJECT \
    --member="serviceAccount:github-deploy-staging@YOUR_STAGING_PROJECT.iam.gserviceaccount.com" \
    --role="$ROLE"
done
# Repeat with YOUR_PROD_PROJECT / github-deploy-prod for production.
```

---

## 3. Configure Workload Identity Federation

This lets GitHub Actions authenticate to GCP without long-lived service account keys.

```bash
# Create the pool (once per project)
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --project=YOUR_STAGING_PROJECT

# Create the provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --project=YOUR_STAGING_PROJECT

# Allow the GitHub repo to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  github-deploy-staging@YOUR_STAGING_PROJECT.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/YOUR_STAGING_PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_GITHUB_ORG/scorecards-v2" \
  --project=YOUR_STAGING_PROJECT
```

Repeat for the production project. The WIF provider resource name to copy into the GitHub variable looks like:

```
projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

---

## 4. Set the WCA_CLIENT_SECRET on App Engine

The OAuth client secret must **not** go through GitHub Actions. Set it directly in the App Engine console:

1. GCP Console → App Engine → Versions
2. Select the version → **Edit** → **Environment variables**
3. Add `WCA_CLIENT_SECRET = <your secret>`

Or set it before the first deploy using the API:

```bash
# Not supported directly via gcloud — use the console or patch app.yaml locally
# (never commit the secret to the file).
```

---

## 5. Create the GitHub environment

In the repository:

1. **Settings → Environments → New environment** → name it `production`
2. Add **Required reviewers** (yourself or a team)
3. This pauses the production deploy job until a reviewer approves

---

## 6. Add repository variables

**Settings → Secrets and variables → Variables → New repository variable:**

| Name | Value |
|------|-------|
| `WIF_PROVIDER_STAGING` | WIF provider resource name (staging) |
| `WIF_PROVIDER_PROD` | WIF provider resource name (prod) |
| `WIF_SA_STAGING` | `github-deploy-staging@YOUR_STAGING_PROJECT.iam.gserviceaccount.com` |
| `WIF_SA_PROD` | `github-deploy-prod@YOUR_PROD_PROJECT.iam.gserviceaccount.com` |
| `GCP_PROJECT_STAGING` | staging GCP project ID |
| `GCP_PROJECT_PROD` | production GCP project ID |
| `VITE_WCA_CLIENT_ID_STAGING` | WCA OAuth client ID for staging |
| `VITE_WCA_CLIENT_ID_PROD` | WCA OAuth client ID for production |
| `STAGING_URL` | e.g. `https://YOUR_STAGING_PROJECT.appspot.com` |
| `PROD_URL` | e.g. `https://YOUR_PROD_PROJECT.appspot.com` |
