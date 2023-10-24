#!/bin/bash
####################################
# 
# This script will build and upload a container to ECR
#  flags --package-path | -p path to the package, default to pwd
#  --checks-only | -c if = 1 will just check the registry if the package exists or not
####################################


RUSI_AWS_ECR_ACCOUNT_ID="615693933970"
REPO_NAME="rusi-web-gatsby-devops-ops"
IMAGE_VERSION="latest"
REQ_BUILD=0 #we check local repo to see if image already exists
REQ_UPLOAD=0 #we check the ecr repo to see if already exists


echo "Authenticating with AWS ECR."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity | jq -r .Account)
if [[ -z "$AWS_ACCOUNT_ID" ]]; then
    echo "Unable to get AWS account ID."
    exit 1
fi
if [[ "${AWS_ACCOUNT_ID}" != "${RUSI_AWS_ECR_ACCOUNT_ID}" ]]; then
    echo "You're not logged in to the RUSI aws account."
    exit 1
fi

echo "Checking if repository exists"
#note, we are calling the repository for a given image the same name as the image
#create the repository if it doesn't exist
aws ecr describe-repositories --repository-names "${REPO_NAME}" || aws ecr create-repository --repository-name "${REPO_NAME}"

#check to see if the image version already exists in the repo
echo "Checking if image version already exists in ECR"
if [ -z $(aws ecr list-images --repository-name "${REPO_NAME}" --query imageIds[?imageTag==\'"${IMAGE_VERSION}"\'].imageTag --output text) ];then
    echo "The container will need uploading"
    REQ_UPLOAD="1"
fi
#Forcing until we have unique image versions in place
REQ_UPLOAD="1"

#no need to go any further if image version already in registry
if [ "${REQ_UPLOAD}" == "0" ]; then
    echo "Image version ${IMAGE_VERSION} already in Registry, exiting"
    exit 0
fi

echo "Local ${REPO_NAME}:${IMAGE_VERSION} does not exist, building..."
docker build -t ${REPO_NAME}:${IMAGE_VERSION} .

#upload the image into ECR

aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.eu-west-1.amazonaws.com" &> /dev/null

ECR_IMAGE="${AWS_ACCOUNT_ID}.dkr.ecr.eu-west-1.amazonaws.com/${REPO_NAME}:${IMAGE_VERSION}"

echo "Pushing drupal container to ECR" 

docker tag "${REPO_NAME}:${IMAGE_VERSION}" $ECR_IMAGE

if ! docker push $ECR_IMAGE; then
    echo "Unable to push container to ECR"
    exit 1
fi
