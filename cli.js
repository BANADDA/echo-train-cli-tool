#!/usr/bin/env node
const axios = require('axios');
const yargs = require('yargs/yargs')(process.argv.slice(2));
const { hideBin } = require('yargs/helpers');
require('dotenv').config();
  const fs = require('fs');
  const path = require('path');

const apiUrl = process.env.API_URL;

// Setup yargs to define command-line arguments and handle interactive prompts
const argv = yargs
  .usage("Usage: -c <command>")
  .option("c", { alias: "command", describe: "Command to execute", type: "string", demandOption: true })
  .option("username", { alias: "u", describe: "Your username", type: "string" })
  .option("password", { alias: "p", describe: "Your password", type: "string" })
  .option("ethereumAddress", { alias: "e", describe: "Ethereum address", type: "string" })
  .option("email", { alias: "email", describe: "Your email address", type: "string" })
  .option("token", { alias: "t", describe: "Your auth token", type: "string" })
  .option("docId", { alias: "d", describe: "Document ID for job details", type: "string" })
  .help()
  .alias('help', 'h')
  .argv;

  const handleLogin = async () => {
      const { username, password } = argv;
      try {
          const response = await axios.post(`${apiUrl}/login`, { username, password });
          console.log('Login successful. Token received.');
          fs.writeFileSync(path.join(__dirname, '.token'), response.data.token);
      } catch (error) {
          console.error('Login failed:', error.response?.data?.error || 'Server error');
      }
  };

const handleLogout = () => {
    try {
        fs.unlinkSync(path.join(__dirname, '.token'));  // This deletes the token file
        console.log('Logged out successfully. Token removed.');
    } catch (error) {
        console.error('Logout failed:', error.message);
    }
};
  
  const getToken = () => {
    try {
        return fs.readFileSync(path.join(__dirname, '.token'), 'utf8');
    } catch (error) {
        console.error('Error reading token:', error.message);
        return null;
    }
};

const handleFetchPendingJobs = async () => {
    const token = getToken();
    if (!token) {
        console.log('Authentication token not found. Please login first.');
        return;
    }
    try {
        const response = await axios.get(`${apiUrl}/pending-jobs`, { headers: { Authorization: `Bearer ${token}` } });
        console.log('Pending jobs:', response.data);
    } catch (error) {
        console.error('Failed to fetch pending jobs:', error.response?.data?.error || 'Server error');
    }
};

const handleFetchJobDetails = async () => {
    const token = getToken();
    const { docId } = argv;
    if (!token) {
        console.log('Authentication token not found. Please login first.');
        return;
    }
    try {
        const response = await axios.get(`${apiUrl}/job-details/${docId}`, { headers: { Authorization: `Bearer ${token}` } });
        const jobDetails = response.data;
        console.log('Job details fetched successfully. See details below:');
        console.log(jobDetails);

        const jobDir = path.join(__dirname, 'jobs', docId);
        if (!fs.existsSync(jobDir)) {
            fs.mkdirSync(jobDir, { recursive: true });
        }

        const detailsPath = path.join(jobDir, 'details.txt');
        fs.writeFileSync(detailsPath, JSON.stringify(jobDetails, null, 2));
        console.log(`Job details saved to: ${detailsPath}`);

        // Download files using the URLs provided
        if (jobDetails.scriptUrl) {
            await downloadFile(jobDetails.scriptUrl, path.join(jobDir, 'script.py'));
            console.log(`Script file downloaded to: ${path.join(jobDir, 'script.py')}`);
        }
        if (jobDetails.trainingFileUrl) {
            await downloadFile(jobDetails.trainingFileUrl, path.join(jobDir, 'trainingData.xlsx'));
            console.log(`Training data file downloaded to: ${path.join(jobDir, 'trainingData.xlsx')}`);
        }
        if (jobDetails.validationFileUrl) {
            await downloadFile(jobDetails.validationFileUrl, path.join(jobDir, 'validationData.xlsx'));
            console.log(`Validation data file downloaded to: ${path.join(jobDir, 'validationData.xlsx')}`);
        }

        console.log(`Training job fetched successfully. Check directory: ${jobDir}`);
    } catch (error) {
        console.error('Failed to fetch job details:', error.response?.data?.error || 'Server error');
    }
};


const downloadFile = async (fileUrl, outputPath) => {
    try {
        const response = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream'
        });
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('Download failed:', error.message);
    }
};

// Execute command based on user input
switch (argv.command) {
    case 'login': 
        handleLogin(); 
        break;
    case 'register-miner': 
        handleRegisterMiner(); 
        break;
    case 'fetch-pending-jobs': 
        handleFetchPendingJobs(); 
        break;
    case 'fetch-job-details': 
        handleFetchJobDetails(); 
        break;
    case 'logout': 
        handleLogout(); 
        break;
    default: 
        console.log('Invalid command');
        break;
}
