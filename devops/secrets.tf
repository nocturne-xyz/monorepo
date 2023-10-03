/*
This file does not contain the secret values. It is used to reference the secret values in the AWS Secrets Manager.

See documentation for adding new secrets in the readme.
*/
data "aws_secretsmanager_secret" "dd_api_key" {
  name = "${terraform.workspace}/DD_API_KEY_PLAIN"
}

data "aws_secretsmanager_secret_version" "dd_api_key_version" {
  secret_id = data.aws_secretsmanager_secret.dd_api_key.id
}
