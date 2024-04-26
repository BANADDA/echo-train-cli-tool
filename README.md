# Echo Train CLI

Echo Train CLI is a command-line tool designed for managing training jobs on the Echo platform, which simplifies interactions with various training environments.

## Table of Contents
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [License](#license)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

## Installation
### Prerequisites
- Node.js
- npm

To install Echo Train CLI:

npm install -g echo-cli-tool

# Configuration

Before using the CLI, you need to set up the following environment variables:

- `API_URL`: The URL of the Echo platform API.
- Other required variables for authentication, such as `USERNAME`, `PASSWORD`, or `TOKEN`.

You can set these environment variables in your shell configuration file (e.g., `.bashrc`, `.bash_profile`, `.zshrc`, or similar) or create a `.env` file in the project directory.

### Example `.env` file:

```plaintext
API_URL=https://example.com/api
USERNAME=your_username
PASSWORD=your_password

# Usage
-----

The Echo Train CLI provides the following commands:

-   `login`: Log in to the Echo platform.
-   `register`: Register a new miner on the Echo platform.
-   `pending-jobs`: Fetch pending training jobs.
-   `job-details`: Fetch details of a specific training job.
-   `start-training`: Start a new training job.

### Example Usage
## Login
`echo-cli-tool login -- -u your_username -p your_password`
## Register Miner
`echo-cli-tool register -- -e your_ethereum_address -u your_username -email your_email`
## Fetch Pending Jobs
`echo-cli-tool pending-jobs`
## Fetch Job Details
`echo-cli-tool job-details -- --docId your_document_id`
## Start Training
`echo-cli-tool start-training -- --docId your_document_id`

Replace `your_username`, `your_password`, `your_ethereum_address`, `your_email`, and `your_document_id` with your actual credentials and document IDs.

For more information and options, you can use the `--help` flag with any command:
`echo-cli-tool login --help`

License
-------

This project is licensed under the ISC License. See the [LICENSE](https://echo.train.com/c/LICENSE) file for details.
