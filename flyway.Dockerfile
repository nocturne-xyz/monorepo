# This dockerfile facilitates our migrations in AWS. It is used in conjunction with
# an ECS task that runs the migrations by using this image. The reason we do it this
# way is because when this dockerfile was created we did not want to expose our database
# to the internet. This dockerfile is not used in local development.

FROM flyway/flyway:9.22-alpine

COPY ./sql /flyway/sql