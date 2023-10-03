# Devops at Nocturne

We are using Terraform

```
terraform init
terraform workspace select dev
terraform apply
```

make some changes then

```terraform plan```

to see what will happen.

Workspaces will be `dev` and `prod` for now.

## Adding secrets

* Add a key to `kms.tf`
* Add the policy to access the key to the roles that need it
* Add the secret in aws console using the new key for encryption and use plain text mode
* Add the secret to `secrets.tf`
* use in the configuration by reference

