#!/bin/bash
# Runs automatically once LocalStack reports ready (mounted into
# /etc/localstack/init/ready.d). Provisions the S3 bucket used for uploads in
# local development.
set -euo pipefail

BUCKET="${S3_BUCKET:-vamp-uploads}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

awslocal s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$REGION" \
  >/dev/null 2>&1 || true

# Permissive CORS so the browser can upload directly to LocalStack in dev.
awslocal s3api put-bucket-cors \
  --bucket "$BUCKET" \
  --cors-configuration '{
    "CORSRules": [
      {
        "AllowedOrigins": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedHeaders": ["*"],
        "ExposeHeaders": ["ETag"]
      }
    ]
  }' >/dev/null 2>&1 || true

echo "LocalStack: S3 bucket '$BUCKET' ready."
