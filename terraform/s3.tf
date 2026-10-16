# The browser gets pictures through /api/pictures/<id>, never from the bucket,
# so it needs no CORS rules.

locals {
  # Bucket names are global; the account id keeps this one Fenro's.
  pictures_bucket_name = "${local.service_name}-pictures-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket" "pictures" {
  bucket = local.pictures_bucket_name

  tags = {
    Name = local.pictures_bucket_name
  }
}

resource "aws_s3_bucket_public_access_block" "pictures" {
  bucket = aws_s3_bucket.pictures.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "pictures" {
  bucket = aws_s3_bucket.pictures.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "pictures" {
  bucket = aws_s3_bucket.pictures.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "pictures" {
  bucket = aws_s3_bucket.pictures.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "pictures" {
  bucket = aws_s3_bucket.pictures.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.pictures_noncurrent_days
    }

    expiration {
      expired_object_delete_marker = true
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }

  depends_on = [aws_s3_bucket_versioning.pictures]
}

resource "aws_s3_bucket_policy" "pictures" {
  bucket = aws_s3_bucket.pictures.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.pictures.arn,
          "${aws_s3_bucket.pictures.arn}/*",
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      }
    ]
  })

  # S3 refuses any policy while Block Public Access is being set up.
  depends_on = [aws_s3_bucket_public_access_block.pictures]
}
