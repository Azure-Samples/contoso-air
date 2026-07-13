# contoso-air

A sample airline booking application used for demos and learning purposes.

This repository is a revived and modernized version of the previously archived [microsoft/ContosoAir](https://github.com/microsoft/ContosoAir) demo project. This version has been rebuilt using using Next.js and TypeScript, and includes new features such as AI-powered virtual travel assistant.

To get started, follow the setup instructions below, which will guide you through configuring the necessary Azure resources and running the application
locally.

## Prerequisites

- Node.js 22.0.0 or later
- Azure CLI
- POSIX-compliant shell (bash or zsh)

## Getting Started

Clone the repository then run the following commands:

```bash
# navigate to web directory
cd src/web

# install dependencies
npm install

# run the app
npm run dev
```

Browse to `http://localhost:3000` to see the app.

### Virtual Travel Assistant

To use the AI-powered virtual travel assistant, you have a few options:

1. Azure OpenAI Service
2. OpenAI API
3. Ollama

#### Azure OpenAI Service

To use Azure OpenAI Service, you need to create an Azure OpenAI resource and deploy a model. You can do this using the Azure CLI.

```bash
# create random resource identifier
RAND=$RANDOM
export RAND
echo "Random resource identifier will be: ${RAND}"

# set resource names
RG_NAME=rg-contosoair$RAND
AOAI_NAME=oai-contosoair$RAND

# choose a region that supports the model of your choice
LOCATION=swedencentral

# create resource group
az group create \
--name $RG_NAME \
--location $LOCATION

# create openai account
AOAI_ID=$(az cognitiveservices account create \
--resource-group $RG_NAME \
--location $LOCATION \
--name $AOAI_NAME \
--custom-domain $AOAI_NAME \
--kind OpenAI \
--sku S0 \
--assign-identity \
--query id -o tsv)

# deploy gpt-5.4-mini model
az cognitiveservices account deployment create \
-n $AOAI_NAME \
-g $RG_NAME \
--deployment-name gpt-5.4-mini \
--model-name gpt-5.4-mini \
--model-version 2026-03-17 \
--model-format OpenAI \
--sku-capacity 200 \
--sku-name GlobalStandard

# create managed identity
MI_ID=$(az identity create \
--name oai-contosoair$RAND-id \
--resource-group $RG_NAME \
--query id -o tsv)

# get managed identity principal id
MI_PRINCIPAL_ID=$(az identity show \
--ids $MI_ID \
--query principalId \
-o tsv)

# assign role to managed identity
az role assignment create \
--role "Cognitive Services OpenAI Contributor" \
--assignee-object-id $MI_PRINCIPAL_ID \
--assignee-principal-type ServicePrincipal \
--scope $AOAI_ID

# assign role to your account too
az role assignment create \
--role "Cognitive Services OpenAI Contributor" \
--assignee-object-id $(az ad signed-in-user show --query id -o tsv) \
--assignee-principal-type User \
--scope $AOAI_ID
```

Set environment variables for the app to use.

```bash
cat <<EOF > .env.local
CHAT_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=$(az cognitiveservices account show -n $AOAI_NAME -g $RG_NAME --query properties.endpoint -o tsv)
AZURE_OPENAI_CLIENTID=$(az identity show --ids $MI_ID --query clientId -o tsv)
AZURE_OPENAI_DEPLOYMENT=gpt-5.4-mini
AZURE_OPENAI_API_VERSION=2025-01-01-preview
EOF
```

When done testing, you can delete the resource group and all resources in it with:

```bash
az group delete --name $RG_NAME --yes --no-wait
```

#### OpenAI API

To use the OpenAI API, you need to create an account and get an API key from [OpenAI](https://platform.openai.com/account/api-keys).

Set environment variables for the app to use.

```bash
cat <<EOF > .env.local
CHAT_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
EOF
```

#### Ollama

To use Ollama, you need to install the Ollama CLI and have an Ollama server running. You can find more information on the [Ollama website](https://ollama.com/docs/installation).

Download a model of your choice, for example:

```bash
ollama pull gpt-oss:20b
```

Set environment variables for the app to use.

```bash
cat <<EOF > .env.local
CHAT_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gpt-oss:20b
EOF
```
