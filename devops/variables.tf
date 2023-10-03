variable "aws_region" {
  description = "The AWS region to deploy the resources in"
  default     = "us-east-2"
  type        = string
}

variable "fargate_cpu" {
  description = "The amount of CPU to allocate for the Fargate task"
  default     = "4096" # 1 vcpu
  type        = string
}

variable "fargate_memory" {
  description = "The amount of memory to allocate for the Fargate task"
  default     = "20480"
  type        = string
}

variable "autoscale_min_capacity" {
  description = "The minimum number of tasks to run for autoscaling"
  default     = 1
  type        = number
}

variable "autoscale_max_capacity" {
  description = "The maximum number of tasks to run for autoscaling"
  default     = 1
  type        = number
}
