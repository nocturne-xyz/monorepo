resource "aws_ecs_cluster" "web_service_cluster" {
  name = "web-service-cluster"
}

resource "aws_ecs_task_definition" "screener_server" {
  family                   = "screener-server-tf"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  execution_role_arn       = aws_iam_role.ecs_service_role.arn
  task_role_arn            = aws_iam_role.ecs_service_role.arn

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }
  ephemeral_storage {
    size_in_gib = 64
  }

  container_definitions = jsonencode([
    {
      name : "deposit-screener",
      image : "nocturnelabs/deposit-screener:9daee706",
      cpu : 1024,
      memory : 6144,
      portMappings : [
        {
          "name" : "deposit-screener-80-tcp",
          "containerPort" : 80,
          "hostPort" : 80,
          "protocol" : "tcp",
          "appProtocol" : "http"
        }
      ],
      essential : true,
      command : [
        "run",
        "server",
        "--config-name-or-path",
        "/app/packages/config/configs/goerli.json",
        "--port",
        "80",
        "--log-dir",
        "./logs/deposit-screener-server",
        "--stdout-log-level",
        "debug",
        "--dummy-screening-delay",
        "300"
      ],
      environment : [
        {
          "name" : "ENVIRONMENT",
          "value" : "development"
        },
        {
          "name" : "REDIS_URL",
          // note - we may want to upgrade to a cluster at some point
          value = "${aws_elasticache_cluster.redis_cluster.cache_nodes.0.address}:6379"
        }
      ],
      mountPoints : [],
      volumesFrom : [],
      logConfiguration : {
        "logDriver" : "awsfirelens",
        "options" : {
          "Host" : "http-intake.logs.datadoghq.com",
          "Name" : "datadog",
          "TLS" : "on",
          #          // not ideal to have this hardcoded, but it's the only way to get the secret value into the container afaict
          "apikey" : data.aws_secretsmanager_secret_version.dd_api_key_version.secret_string,
          "dd_message_key" : "log",
          "dd_service" : "deposit-screener-server-tf",
          "dd_source" : "node",
          "dd_tags" : "project:testnet",
          "provider" : "ecs"
        }
      }
    },
    {
      name : "log_router",
      image : "amazon/aws-for-fluent-bit:stable",
      cpu : 0,
      portMappings : [],
      essential : true,
      environment : [],
      mountPoints : [],
      volumesFrom : [],
      user : "0",
      firelensConfiguration : {
        "type" : "fluentbit",
        "options" : {
          "config-file-type" : "file",
          "config-file-value" : "/fluent-bit/configs/parse-json.conf",
          "enable-ecs-log-metadata" : "true"
        }
      }
    },
    {
      name      = "datadog-agent",
      image     = "public.ecr.aws/datadog/agent:latest",
      cpu       = 0 # adjust as required
      essential = false
      // add more container configurations as required
      environment = [
        {
          "name" : "DD_SITE",
          "value" : "datadoghq.com"
        },
        {
          "name" : "ECS_FARGATE",
          "value" : "true"
        }
      ]
      secrets = [
        {
          "name" : "DD_API_KEY",
          "valueFrom" : data.aws_secretsmanager_secret.dd_api_key.arn
        }
      ]
    }
  ])
}

# Autoscaling is a bit more involved and will require setting up CloudWatch alarms and linking those to ECS service autoscaling policies.
# Here's a basic setup for that:

resource "aws_appautoscaling_target" "ecs_target" {
  service_namespace  = "ecs"
  scalable_dimension = "ecs:service:DesiredCount"
  resource_id        = "service/${aws_ecs_cluster.web_service_cluster.name}/${aws_ecs_service.screener_service.name}"
  min_capacity       = var.autoscale_min_capacity
  max_capacity       = var.autoscale_max_capacity
}

resource "aws_appautoscaling_policy" "ecs_policy_up" {
  name               = "screener-scale-up"
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    target_value = 75.0
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_appautoscaling_policy" "ecs_policy_down" {
  name               = "screener-scale-down"
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    target_value = 25.0
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}

resource "aws_security_group" "ecs_sg" {
  name        = "ecs-sg"
  description = "ECS Security Group"
  vpc_id      = aws_vpc.main.id

  # Ingress rule to allow all traffic temporarily
  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Egress rule to allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1" # allows all
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "ecs-sg"
  }
}


resource "aws_ecs_service" "screener_service" {
  name            = "screener-service"
  cluster         = aws_ecs_cluster.web_service_cluster.id
  task_definition = aws_ecs_task_definition.screener_server.arn
  launch_type     = "FARGATE"
  desired_count   = var.autoscale_min_capacity

  network_configuration {
    subnets          = [aws_subnet.private.id]
    security_groups  = [aws_security_group.ecs_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web_service_tg.arn
    container_name   = "deposit-screener"
    container_port   = 80
  }

  depends_on = [aws_lb_listener.web_service_listener]
}



# Security Group for ALB
resource "aws_security_group" "alb_sg" {
  name        = "alb-sg"
  description = "ALB Security Group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1" # allows all
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "alb-sg"
  }
}

# Application Load Balancer
resource "aws_lb" "web_service_lb" {
  name               = "web-service-lb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = [aws_subnet.public.id, aws_subnet.public2.id]

  enable_deletion_protection = false

  enable_http2 = true

  tags = {
    Name = "web-service-lb"
  }
}

# ALB Listener
resource "aws_lb_listener" "web_service_listener" {
  load_balancer_arn = aws_lb.web_service_lb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web_service_tg.arn
  }
}

# ALB Target Group
resource "aws_lb_target_group" "web_service_tg" {
  name        = "web-service-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    interval            = 30
    path                = "/"
    port                = "80"
    timeout             = 5
    unhealthy_threshold = 2
    healthy_threshold   = 2
    protocol            = "HTTP"
  }
}

resource "aws_wafv2_web_acl" "web_acl_for_app" {
  name        = "app-web-acl"
  description = "Web ACL for protecting the application."
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  custom_response_body {
    // todo: content?
    content      = "{\"error\": \"GEO_BLOCKED\"}"
    content_type = "APPLICATION_JSON"
    key          = "geo_blocked"
  }

  rule {
    name     = "block_us_and_sanctioned_entities"
    priority = 0

    action {
      block {
        custom_response {
          response_code            = "403"
          custom_response_body_key = "geo_blocked"
        }
      }
    }


    statement {
      geo_match_statement {
        country_codes = [
          "US",
          "AF", // Afghanistan
          "BA", // Bosnia and Herzegovina (Balkans region typically refers to several countries in southeastern Europe, but I've listed Bosnia as an example)
          "BY", // Belarus
          "MM", // Burma (Myanmar)
          "CF", // Central African Republic
          "CN", // China (for Chinese Military Companies)
          "CU", // Cuba
          "CD", // Democratic Republic of the Congo
          "ET", // Ethiopia
          "HK", // Hong Kong (Special Administrative Region of China)
          "IR", // Iran
          "IQ", // Iraq
          "LB", // Lebanon
          "LY", // Libya
          "ML", // Mali
          "NI", // Nicaragua
          "KP", // North Korea
          "RU", // Russia (for Russian Harmful Foreign Activities and Ukraine-/Russia-related)
          "SO", // Somalia
          "SS", // South Sudan
          "SD", // Sudan (and Darfur)
          "SY", // Syria
          "UA", // Ukraine (related to Russia sanctions)
          "VE", // Venezuela
          "YE", // Yemen
          "ZW"  // Zimbabwe
        ]
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "block_us_and_sanctioned_entities_metric"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "managed_anonymous_and_hosting_provider_ips"
    priority = 1

    override_action {
      count {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAnonymousIpList"
        vendor_name = "AWS"

        rule_action_override {
          action_to_use {
            allow {
              custom_request_handling {
                insert_header {
                  name  = "X-WAF-AWSManagedRulesAnonymousIpList-AnonymousIPList"
                  value = "true"
                }
              }
            }
          }

          name = "AnonymousIPList"
        }

        rule_action_override {
          action_to_use {
            allow {
              custom_request_handling {
                insert_header {
                  name  = "X-WAF-AWSManagedRulesAnonymousIpList-HostingProviderIPList"
                  value = "true"
                }
              }
            }
          }

          name = "HostingProviderIPList"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = false
      metric_name                = "webacl_rule1_metric"
      sampled_requests_enabled   = false
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = false
    metric_name                = "webacl_overall_metric"
    sampled_requests_enabled   = false
  }
}


resource "aws_wafv2_web_acl_association" "web_acl_association_v2" {
  web_acl_arn  = aws_wafv2_web_acl.web_acl_for_app.arn
  resource_arn = aws_lb.web_service_lb.arn
}
