#!/bin/bash
# Run this ONCE before your first `terraform init` to create the S3 bucket
# and DynamoDB table that store Terraform state safely.
#
# Usage:
#   chmod +x bootstrap-state-backend.sh
#   ./bootstrap-state-backend.sh
#
# After this runs, uncomment the backend "s3" block in main.tf and run:
#   terraform init  (Terraform will migrate local state to S3)

set -e

REGION="${AWS_DEFAULT_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="proteaai-terraform-state-${ACCOUNT_ID}"
TABLE_NAME="proteaai-terraform-locks"

echo "==> Creating S3 bucket: $BUCKET_NAME"
if [ "$REGION" = "us-east-1" ]; then
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION"
else
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
fi

echo "==> Enabling versioning on S3 bucket"
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled

echo "==> Enabling encryption on S3 bucket"
aws s3api put-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

echo "==> Blocking public access on S3 bucket"
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "==> Creating DynamoDB table for state locking: $TABLE_NAME"
aws dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

echo ""
echo "✅ Done! Now update main.tf backend block with:"
echo ""
echo '  backend "s3" {'
echo "    bucket         = \"$BUCKET_NAME\""
echo '    key            = "proteaai/prod/terraform.tfstate"'
echo "    region         = \"$REGION\""
echo '    encrypt        = true'
echo "    dynamodb_table = \"$TABLE_NAME\""
echo '  }'
echo ""
echo "Then run: terraform init"
