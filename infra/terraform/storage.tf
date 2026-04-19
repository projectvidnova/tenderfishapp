# ──────────────────────────────────────────────
# S3 Bucket (IONOS Object Storage)
# Note: IONOS S3 does not support server-side encryption config
# or lifecycle rules via the AWS S3 API.
# ──────────────────────────────────────────────
resource "aws_s3_bucket" "files" {
  bucket = var.s3_bucket_name
}

resource "aws_s3_bucket_versioning" "files" {
  bucket = aws_s3_bucket.files.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "files" {
  bucket                  = aws_s3_bucket.files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
