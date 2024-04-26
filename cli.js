#!/usr/bin/env node
const axios = require('axios');
const si = require('systeminformation');
const yargs = require('yargs/yargs')(process.argv.slice(2));
const { hideBin } = require('yargs/helpers');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

let inquirer;

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

async function getSystemDetails() {
    try {
        const cpu = await si.cpu();
        const graphics = await si.graphics();
        const networkInterfaces = await si.networkInterfaces();
        const osInfo = await si.osInfo();

        return {
            cpu: {
                brand: cpu.brand,
                cores: cpu.cores,
                manufacturer: cpu.manufacturer,
                physicalCores: cpu.physicalCores,
                speed: cpu.speed
            },
            graphics: graphics.controllers.map(gpu => ({
                model: gpu.model,
                vram: gpu.vram
            })),
            network: networkInterfaces.map(iface => ({
                iface: iface.ifaceName,
                ip4: iface.ip4,
                mac: iface.mac
            })),
            os: {
                distro: osInfo.distro,
                platform: osInfo.platform,
                release: osInfo.release
            }
        };
    } catch (error) {
        console.error('Failed to get system details:', error);
        return {};
    }
}

const handleRegisterMiner = async () => {
    const { ethereumAddress, username, email } = argv;
    try {
        const response = await axios.post(`${apiUrl}/register-miner`, { ethereumAddress, username, email });
        console.log('Registration successful:', response.data);
    } catch (error) {
        console.error('Registration failed:', error.response?.data?.error || 'Server error');
    }
};

const handleLogin = async () => {
    const { username, password } = argv;
    console.log("Username $ password: ", username, password);
    try {
        const response = await axios.post(`${apiUrl}/login`, { username, password });
        
        // Write the token
        fs.writeFileSync(path.join(__dirname, '.token'), response.data.token);

        // Ensure minerId is a string and write it
        if (response.data.minerId) {
            fs.writeFileSync(path.join(__dirname, '.minerId'), response.data.minerId.toString());
        } else {
            console.error('Miner ID is missing in the response.');
        }

        console.log('Login successful. Token and Miner ID received.');
    } catch (error) {
        console.error('Login failed:', error.response?.data?.error || error);
    }
};

  const handleLogout = () => {
    try {
        // Remove the authentication token file
        const tokenPath = path.join(__dirname, '.token');
        if (fs.existsSync(tokenPath)) {
            fs.unlinkSync(tokenPath);
            console.log('Authentication token removed.');
        }

        // Remove the jobs directory and all its contents
        const jobsDir = path.join(__dirname, 'jobs');
        if (fs.existsSync(jobsDir)) {
            fs.rmdirSync(jobsDir, { recursive: true });
            console.log('Job data directory removed.');
        }

        console.log('Logged out successfully.');
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

const getMinerId = () => {
    try {
        return fs.readFileSync(path.join(__dirname, '.minerId'), 'utf8');
    } catch (error) {
        console.error('Error reading miner ID:', error.message);
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
        console.log('Job details:', response.data);
    } catch (error) {
        console.error('Failed to fetch job details:', error.response?.data?.error || 'Server error');
    }
};
const start_training = async () => {
    const token = getToken();
    const minerId = getMinerId();
    const systemDetails = await getSystemDetails();
    const { docId } = argv;
    if (!token) {
        console.log('Authentication token not found. Please login first.');
        return;
    }

    // Confirmation prompt
    const answers = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmTraining',
        message: 'Starting training will trigger execution of the training job. Do you want to continue?',
        default: false
    }]);

    if (!answers.confirmTraining) {
        console.log('Training start cancelled.');
        return;
    }

    try {
        const response = await axios.post(`${apiUrl}/start-training/${docId}`, {
            systemDetails,
            minerId
        }, {
            headers: { Authorization: `Bearer ${token}`, 
            'X-Miner-ID': minerId  }
        });
        const train_job = response.data;
        console.log('Job details fetched successfully. See details below:');
        console.log(train_job);

        const jobDir = path.join(__dirname, 'jobs', docId);
        if (!fs.existsSync(jobDir)) {
            fs.mkdirSync(jobDir, { recursive: true });
        }

        const detailsPath = path.join(jobDir, 'details.txt');
        fs.writeFileSync(detailsPath, JSON.stringify(train_job, null, 2));
        console.log(`Job details saved to: ${detailsPath}`);

        // Download files using the URLs provided
        await downloadFile(train_job.scriptUrl, path.join(jobDir, 'script.py'));
        await downloadFile(train_job.trainingFileUrl, path.join(jobDir, 'trainingData.xlsx'));
        await downloadFile(train_job.validationFileUrl, path.join(jobDir, 'validationData.xlsx'));

        console.log(`Training job fetched successfully. Check directory: ${jobDir}`);
    } catch (error) {
        console.error('Failed to fetch job details:', error.response?.data?.error || error);
    }
};

// const start_training = async () => {
//     const token = getToken();
//     const minerId = getMinerId();
//     console.log('Gotten miner id: ', minerId);
//     const systemDetails = await getSystemDetails();
//     const { docId } = argv;
//     if (!token) {
//         console.log('Authentication token not found. Please login first.');
//         return;
//     }

//     // Confirmation prompt
//     const answers = await inquirer.prompt([{
//         type: 'confirm',
//         name: 'confirmTraining',
//         message: 'Starting training will trigger execution of the training job. Do you want to continue?',
//         default: false
//     }]);

//     if (!answers.confirmTraining) {
//         console.log('Training start cancelled.');
//         return;
//     }

//     try {
//         const response = await axios.post(`${apiUrl}/start-training/${docId}`, {
//             systemDetails,
//             minerId
//         }, {
//             headers: { Authorization: `Bearer ${token}`, 
//             'X-Miner-ID': minerId  }
//         });
//         const train_job = response.data;
//         console.log('Job details fetched successfully. See details below:');
//         console.log(train_job);

//         const jobDir = path.join(__dirname, 'jobs', docId);
//         if (!fs.existsSync(jobDir)) {
//             fs.mkdirSync(jobDir, { recursive: true });
//         }

//         const detailsPath = path.join(jobDir, 'details.txt');
//         fs.writeFileSync(detailsPath, JSON.stringify(train_job, null, 2));
//         console.log(`Job details saved to: ${detailsPath}`);

//         // Download files using the URLs provided
//         if (train_job.scriptUrl) {
//             await downloadFile(train_job.scriptUrl, path.join(jobDir, 'script.py'));
//             console.log(`Script file downloaded to: ${path.join(jobDir, 'script.py')}`);
//         }
//         if (train_job.trainingFileUrl) {
//             await downloadFile(train_job.trainingFileUrl, path.join(jobDir, 'trainingData.xlsx'));
//             console.log(`Training data file downloaded to: ${path.join(jobDir, 'trainingData.xlsx')}`);
//         }
//         if (train_job.validationFileUrl) {
//             await downloadFile(train_job.validationFileUrl, path.join(jobDir, 'validationData.xlsx'));
//             console.log(`Validation data file downloaded to: ${path.join(jobDir, 'validationData.xlsx')}`);
//         }

//         console.log(`Training job fetched successfully. Check directory: ${jobDir}`);
//     } catch (error) {
//         console.error('Failed to fetch job details:', error.response?.data?.error || error);
//     }
// };


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
(async () => {
    // Load inquirer dynamically
    inquirer = (await import('inquirer')).default;

    // Execute command based on user input
    switch (argv.command) {
        case 'login': 
            await handleLogin(); 
            break;
        case 'register-miner': 
            await handleRegisterMiner(); 
            break;
        case 'fetch-pending-jobs': 
            await handleFetchPendingJobs(); 
            break;
        case 'fetch-job-details': 
            await handleFetchJobDetails(); 
            break;
        case 'train-jobs': 
            await start_training(); 
            break;
        case 'logout': 
            handleLogout(); 
            break;
        default: 
            console.log('Invalid command');
            break;
    }
})();
