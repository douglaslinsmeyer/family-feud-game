#!/usr/bin/env bash
set -euo pipefail
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH"

# 1. Deploy infra (idempotent)
pushd infra
npx cdk deploy --require-approval never --outputs-file cdk-outputs.json
popd

# 2. Read outputs into env vars
SITE_BUCKET=$(node -e "console.log(require('./infra/cdk-outputs.json').FamilyFeudStack.SiteBucketName)")
DISTRIBUTION_ID=$(node -e "console.log(require('./infra/cdk-outputs.json').FamilyFeudStack.DistributionId)")
TABLE_NAME=$(node -e "console.log(require('./infra/cdk-outputs.json').FamilyFeudStack.TableName)")
IDENTITY_POOL_ID=$(node -e "console.log(require('./infra/cdk-outputs.json').FamilyFeudStack.IdentityPoolId)")
REGION=$(aws configure get region)

# 3. Build SPA with the right env
VITE_PERSISTENCE=ddb \
VITE_AWS_REGION="$REGION" \
VITE_COGNITO_IDENTITY_POOL_ID="$IDENTITY_POOL_ID" \
VITE_DDB_TABLE_NAME="$TABLE_NAME" \
npm run build

# 4. Upload to S3
aws s3 sync dist/ "s3://$SITE_BUCKET/" --delete

# 5. Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths '/*'

DOMAIN=$(node -e "console.log(require('./infra/cdk-outputs.json').FamilyFeudStack.DistributionDomain)")
echo
echo "Deployed to: https://$DOMAIN/"
