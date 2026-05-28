# Deploy pipeline setup

One-time GCP and GitHub configuration required before the pipeline will run.

GCP project: **scorecards-v2-prod**

---

## 1. Enable required APIs

```bash
gcloud app create --region=northamerica-northeast1 --project=scorecards-v2-prod
gcloud services enable \
  appengine.googleapis.com \
  iamcredentials.googleapis.com \
  --project=scorecards-v2-prod
```

`iamcredentials.googleapis.com` is required by Workload Identity Federation to mint
short-lived tokens when impersonating the service account.

---

## 2. Create a service account

```bash
gcloud iam service-accounts create github-deploy \
  --display-name="GitHub Actions deploy" \
  --project=scorecards-v2-prod
```

Grant the App Engine deployer roles:

```bash
for ROLE in \
  roles/appengine.deployer \
  roles/appengine.serviceAdmin \
  roles/cloudbuild.builds.editor \
  roles/storage.objectAdmin; do

  gcloud projects add-iam-policy-binding scorecards-v2-prod \
    --member="serviceAccount:github-deploy@scorecards-v2-prod.iam.gserviceaccount.com" \
    --role="$ROLE"
done
```

---

## 3. Configure Workload Identity Federation

```bash
# Create the pool
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --project=scorecards-v2-prod

# Create the OIDC provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="attribute.repository=='Speedcubing-Canada/scorecards-v2'" \
  --project=scorecards-v2-prod

# Allow the GitHub repo to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  github-deploy@scorecards-v2-prod.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe scorecards-v2-prod --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-pool/attribute.repository/Speedcubing-Canada/scorecards-v2" \
  --project=scorecards-v2-prod
```

The `WIF_PROVIDER` value to copy into GitHub looks like:

```
projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

Get it with:

```bash
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --project=scorecards-v2-prod \
  --format="value(name)"
```

---

## 4. Set WCA_CLIENT_SECRET on App Engine

The OAuth client secret must **not** go through GitHub Actions. Set it in the GCP Console:

**App Engine → Versions → (select version) → Edit → Environment variables**
Add: `WCA_CLIENT_SECRET = <your secret>`

---

## 5. Add repository variables

**Settings → Secrets and variables → Variables → New repository variable:**

| Name | Value |
|------|-------|
| `WIF_PROVIDER` | WIF provider resource name (from step 3) |
| `WIF_SA` | `github-deploy@scorecards-v2-prod.iam.gserviceaccount.com` |
| `VITE_WCA_CLIENT_ID` | WCA OAuth client ID |
