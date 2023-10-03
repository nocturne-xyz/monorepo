resource "aws_iam_role" "ecs_service_role" {
  name = "ecs_service_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        },
        Effect = "Allow",
        Sid    = ""
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_full_permissions" {
  role       = aws_iam_role.ecs_service_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

// policy for decrypting with the datadog kms key to read datadog secret
resource "aws_iam_role_policy" "datadog_kms_policy" {
  name = "datadog_kms_policy"
  role = aws_iam_role.ecs_service_role.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "kms:Decrypt",
        ]
        Effect = "Allow"
        Resource = [
          aws_kms_key.datadog.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "secretsmanager_access_policy" {
  name = "secretsmanager_access_policy"
  role = aws_iam_role.ecs_service_role.name

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action   = "secretsmanager:GetSecretValue",
        Effect   = "Allow",
        Resource = "${data.aws_secretsmanager_secret.dd_api_key.arn}*"
      }
    ]
  })
}
