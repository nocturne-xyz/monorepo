
resource "aws_kms_key" "datadog" {
  description = "Datadog KMS Key"
}

resource "aws_kms_alias" "datadog" {
  name          = "alias/datadog"
  target_key_id = aws_kms_key.datadog.key_id
}