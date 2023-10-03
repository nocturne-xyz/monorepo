resource "aws_security_group" "redis_sg" {
  name        = "redis-sg"
  description = "Allow inbound traffic for Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 6379 # Redis default port
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"] # Allow traffic only from within VPC
  }

  tags = {
    Name = "redis-sg"
  }
}

resource "aws_elasticache_subnet_group" "redis_subnet_group" {
  name       = "redis-subnet-group"
  subnet_ids = [aws_subnet.private.id]

  tags = {
    Name = "redis-subnet-group"
  }
}

resource "aws_elasticache_cluster" "redis_cluster" {
  cluster_id           = "redis-cluster"
  engine               = "redis"
  node_type            = "cache.t2.micro" # This is the smallest available instance type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  subnet_group_name    = aws_elasticache_subnet_group.redis_subnet_group.name
  security_group_ids   = [aws_security_group.redis_sg.id]

  tags = {
    Name = "redis-cluster"
  }
}
