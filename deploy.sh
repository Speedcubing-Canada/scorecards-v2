#!/usr/bin/env bash
# Deploy scorecards-v2 to Google App Engine.
#
# Usage:
#   ./deploy.sh -p                    Deploy to production
#   ./deploy.sh -s -v ci-<sha>        Deploy to staging with a version slug
#
# Flags:
#   -p              Target production project
#   -s              Target staging project
#   -v <version>    Version name (staging only; auto-assigned on prod)

set -euo pipefail

PROD_PROJECT="YOUR_GCP_PROJECT_PROD"
STAGING_PROJECT="YOUR_GCP_PROJECT_STAGING"

PROJECT=""
IS_PROD=0
VERSION=""

while getopts "psv:" opt; do
  case $opt in
    p) PROJECT="$PROD_PROJECT"; IS_PROD=1 ;;
    s) PROJECT="$STAGING_PROJECT"; IS_PROD=0 ;;
    v) VERSION="$OPTARG" ;;
    \?) echo "Usage: $0 -p | (-s -v <version>)" >&2; exit 1 ;;
    :)  echo "Option -$OPTARG requires an argument." >&2; exit 1 ;;
  esac
done

if [ -z "$PROJECT" ]; then
  echo "Either -p (prod) or -s (staging) must be set." >&2; exit 1
fi

if [ "$IS_PROD" = "0" ] && [ -z "$VERSION" ]; then
  echo "Staging deploys require -v <version>." >&2; exit 1
fi

if [ "$IS_PROD" = "1" ] && [ -n "$VERSION" ]; then
  echo "-v is not allowed for production (version is auto-assigned)." >&2; exit 1
fi

echo "Building frontend…"
npm run build

CMD="gcloud app deploy app.yaml --project $PROJECT --quiet"
[ -n "$VERSION" ] && CMD="$CMD --version $VERSION"

echo "$CMD"
$CMD

if [ -n "$VERSION" ]; then
  echo "Deployed to https://${VERSION}-dot-${PROJECT}.appspot.com"
  echo "Cleanup when done: gcloud app versions delete $VERSION --project $PROJECT --quiet"
else
  echo "Deployed to https://${PROJECT}.appspot.com"
fi
