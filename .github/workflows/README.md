# Deploy pipeline setup

One-time GCP and GitHub configuration required before the pipeline will run.

GCP project: **scorecards-v2-prod**

---

## 1. Enable required APIs

```bash
gcloud app create --region=northamerica-northeast1 --project=scorecards-v2-prod
gcloud services enable \
  appengine.googleapis.com \
  cloudbuild.googleapis.com \
  iamcredentials.googleapis.com \
  --project=scorecards-v2-prod
```

- `iamcredentials.googleapis.com` — required by Workload Identity Federation to mint short-lived tokens
- `cloudbuild.googleapis.com` — `gcloud app deploy` delegates builds to Cloud Build; the staging bucket (`staging.<project>.appspot.com`) is created when this API is enabled

After enabling Cloud Build, grant the App Engine default service account access to
that staging bucket (it is not granted automatically):

```bash
gcloud projects add-iam-policy-binding scorecards-v2-prod \
  --member="serviceAccount:scorecards-v2-prod@appspot.gserviceaccount.com" \
  --role="roles/storage.admin"
```

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

`gcloud app deploy` delegates the actual build to Cloud Build, which runs as the
App Engine default service account. Grant `github-deploy` permission to act as it:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  scorecards-v2-prod@appspot.gserviceaccount.com \
  --member="serviceAccount:github-deploy@scorecards-v2-prod.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project=scorecards-v2-prod
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

## 4. Store WCA_CLIENT_SECRET in Secret Manager

The OAuth client secret must **not** go through GitHub Actions or `app.yaml`. App
Engine Standard bakes env vars from `app.yaml` into each new version at deploy
time, so any value set manually in the console is dropped on the next workflow
run. Instead, `server.js` fetches it from Secret Manager at startup.

Enable the API and create the secret (run once, then paste the secret value at
the prompt and press Ctrl-D):

```bash
gcloud services enable secretmanager.googleapis.com --project=scorecards-v2-prod

gcloud secrets create WCA_CLIENT_SECRET \
  --replication-policy=automatic \
  --project=scorecards-v2-prod

gcloud secrets versions add WCA_CLIENT_SECRET \
  --data-file=- \
  --project=scorecards-v2-prod
```

Grant the App Engine default service account read access to the secret. This is
the identity `server.js` runs as on App Engine, and it's what the Secret Manager
client picks up via Application Default Credentials:

```bash
gcloud secrets add-iam-policy-binding WCA_CLIENT_SECRET \
  --member="serviceAccount:scorecards-v2-prod@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=scorecards-v2-prod
```

To rotate the secret later, add a new version with `gcloud secrets versions add`
— the server reads the `latest` alias on startup, so the new value takes effect
on the next instance start (or after `gcloud app versions migrate`).

---

## 5. Add repository variables

**Settings → Secrets and variables → Variables → New repository variable:**

| Name | Value |
|------|-------|
| `WIF_PROVIDER` | WIF provider resource name (from step 3) |
| `WIF_SA` | `github-deploy@scorecards-v2-prod.iam.gserviceaccount.com` |
| `VITE_WCA_CLIENT_ID` | WCA OAuth client ID |
